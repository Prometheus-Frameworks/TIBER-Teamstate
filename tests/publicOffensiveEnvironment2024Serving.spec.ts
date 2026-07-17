import { readFileSync } from 'node:fs';
import { type AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { loadTeamWeekRawV0Governed } from '../src/ingest/loadTeamWeekRawV0Governed.js';
import { renderPublicReport2024Html } from '../src/reports/publicOffensiveEnvironment2024Html.js';
import {
  buildPublicReport2024Payload,
  computeSha256Hex,
  serializePublicReport2024Payload
} from '../src/reports/publicOffensiveEnvironment2024Report.js';
import { validatePublicReport2024 } from '../src/reports/publicOffensiveEnvironment2024Validator.js';
import {
  LIVE_SERVICE_METADATA,
  applyPublicReportPublication
} from '../src/reports/publicReportRegistry.js';
import {
  LIVE_PUBLIC_REPORT_SERVING_STATE,
  createTeamstateServer,
  type PublicReportServingState
} from '../src/server.js';

const GOVERNED_SOURCE_PATH = path.resolve(
  process.cwd(),
  'data/governed/team_week_raw_v0_2024_real_source_candidate.json'
);
const CANONICAL_HTML = '/nfl/2024/offensive-environments';
const CANONICAL_JSON = '/nfl/2024/offensive-environments.json';

const governedSourceBytes = readFileSync(GOVERNED_SOURCE_PATH);
const governedSourceSha256 = computeSha256Hex(governedSourceBytes);
const consumption = loadTeamWeekRawV0Governed(GOVERNED_SOURCE_PATH);

const buildVersion = (revision: number) => {
  const payload = buildPublicReport2024Payload(consumption, {
    generatedAt: `2026-07-1${revision}T00:00:00.000Z`,
    governedInputSha256: governedSourceSha256,
    revision
  });
  return {
    payload,
    json: serializePublicReport2024Payload(payload),
    html: renderPublicReport2024Html(payload)
  };
};

const r1 = buildVersion(1);
const r2 = buildVersion(2);
const R1_ID = r1.payload.report_version_id;
const R2_ID = r2.payload.report_version_id;

// Publish through the real gate: each version is validated end-to-end (complete evidence package)
// against the pre-publication registry, and only its case-#20 result + a well-formed exact-version
// approval can flip the registry — the same path production publication must take.
const publishedState = (versions: Array<(typeof r1)>): PublicReportServingState => {
  let metadata = LIVE_SERVICE_METADATA;
  const frozenReports = new Map<string, { json: string; html: string }>();
  for (const version of versions) {
    const approval = {
      report_version_id: version.payload.report_version_id,
      approved_by: 'test-operator',
      approved_at: '2026-07-17T00:00:00.000Z'
    };
    const validation = validatePublicReport2024(version.payload, {
      governedSourceBytes,
      sourceRows: consumption.rows,
      html: version.html,
      registry: metadata,
      approvals: [approval]
    });
    expect(validation.publishable).toBe(true);
    metadata = applyPublicReportPublication(
      metadata,
      {
        report_version_id: version.payload.report_version_id,
        canonical_url: CANONICAL_HTML,
        version_url: `${CANONICAL_HTML}/${version.payload.report_version_id}`,
        published_at: '2026-07-17T00:00:00.000Z'
      },
      { validation, approval }
    );
    frozenReports.set(version.payload.report_version_id, { json: version.json, html: version.html });
  }
  return { serviceMetadata: metadata, frozenReports };
};

describe('public report serving (§6 identities, fail-closed pre-approval)', () => {
  let server: ReturnType<typeof createTeamstateServer> | undefined;

  afterEach(async () => {
    if (server === undefined) return;
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  });

  const startServer = async (state?: PublicReportServingState): Promise<string> => {
    server = state === undefined ? createTeamstateServer() : createTeamstateServer(state);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    return `http://127.0.0.1:${address.port}`;
  };

  it('live default state fails closed: every report route is 404 and metadata stays the scaffold', async () => {
    const base = await startServer();
    for (const route of [
      CANONICAL_HTML,
      CANONICAL_JSON,
      `${CANONICAL_HTML}/${R1_ID}`,
      `${CANONICAL_HTML}/${R1_ID}.json`
    ]) {
      const res = await fetch(`${base}${route}`);
      expect(res.status).toBe(404);
    }
    const metadata = await (await fetch(`${base}/service-metadata.json`)).json();
    expect(metadata).toEqual({
      service: 'tiber-teamstate',
      status: 'deployment_scaffold',
      public_reports: [],
      artifact_publication_enabled: false
    });
    expect(LIVE_PUBLIC_REPORT_SERVING_STATE.frozenReports.size).toBe(0);
  });

  it('fails closed when frozen content exists but publication is disabled', async () => {
    const state = publishedState([r1]);
    const disabled: PublicReportServingState = {
      serviceMetadata: { ...state.serviceMetadata, artifact_publication_enabled: false },
      frozenReports: state.frozenReports
    };
    const base = await startServer(disabled);
    for (const route of [CANONICAL_HTML, CANONICAL_JSON, `${CANONICAL_HTML}/${R1_ID}`, `${CANONICAL_HTML}/${R1_ID}.json`]) {
      expect((await fetch(`${base}${route}`)).status).toBe(404);
    }
  });

  it('fails closed when the registry names a version whose frozen content is missing', async () => {
    const state = publishedState([r1]);
    const base = await startServer({ serviceMetadata: state.serviceMetadata, frozenReports: new Map() });
    expect((await fetch(`${base}${CANONICAL_JSON}`)).status).toBe(404);
    expect((await fetch(`${base}${CANONICAL_HTML}/${R1_ID}.json`)).status).toBe(404);
  });

  it('never serves frozen content that has no registry entry (candidate/fixture content unreachable)', async () => {
    const state = publishedState([r1]);
    const withUnregisteredContent: PublicReportServingState = {
      serviceMetadata: state.serviceMetadata,
      frozenReports: new Map([...state.frozenReports, [R2_ID, { json: r2.json, html: r2.html }]])
    };
    const base = await startServer(withUnregisteredContent);
    expect((await fetch(`${base}${CANONICAL_HTML}/${R2_ID}`)).status).toBe(404);
    expect((await fetch(`${base}${CANONICAL_HTML}/${R2_ID}.json`)).status).toBe(404);
  });

  it('serves the current version at the canonical alias and the exact frozen bytes at version URLs', async () => {
    const base = await startServer(publishedState([r1]));

    const canonicalJsonRes = await fetch(`${base}${CANONICAL_JSON}`);
    expect(canonicalJsonRes.status).toBe(200);
    expect(canonicalJsonRes.headers.get('content-type')).toContain('application/json');
    expect(await canonicalJsonRes.text()).toBe(r1.json);

    const canonicalHtmlRes = await fetch(`${base}${CANONICAL_HTML}`);
    expect(canonicalHtmlRes.status).toBe(200);
    expect(canonicalHtmlRes.headers.get('content-type')).toContain('text/html');
    expect(await canonicalHtmlRes.text()).toBe(r1.html);

    expect(await (await fetch(`${base}${CANONICAL_HTML}/${R1_ID}.json`)).text()).toBe(r1.json);
    expect(await (await fetch(`${base}${CANONICAL_HTML}/${R1_ID}`)).text()).toBe(r1.html);

    expect((await fetch(`${base}${CANONICAL_HTML}/unknown-version.json`)).status).toBe(404);
  });

  it('keeps immutable version content byte-identical across a registry supersession flip (§8 inv. 9)', async () => {
    const singleVersionBase = await startServer(publishedState([r1]));
    const beforeFlipJson = await (await fetch(`${singleVersionBase}${CANONICAL_HTML}/${R1_ID}.json`)).text();
    const beforeFlipHtml = await (await fetch(`${singleVersionBase}${CANONICAL_HTML}/${R1_ID}`)).text();
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;

    const base = await startServer(publishedState([r1, r2]));

    // Canonical alias now resolves to r2 (directly, not via redirect).
    expect(await (await fetch(`${base}${CANONICAL_JSON}`)).text()).toBe(r2.json);
    expect(await (await fetch(`${base}${CANONICAL_HTML}`)).text()).toBe(r2.html);

    // The superseded r1 version URL still serves the exact same frozen bytes as before the flip.
    expect(await (await fetch(`${base}${CANONICAL_HTML}/${R1_ID}.json`)).text()).toBe(beforeFlipJson);
    expect(await (await fetch(`${base}${CANONICAL_HTML}/${R1_ID}`)).text()).toBe(beforeFlipHtml);
    expect(beforeFlipJson).toBe(r1.json);
    expect(beforeFlipHtml).toBe(r1.html);

    // The registry reflects the atomic flip in served metadata.
    const metadata = (await (await fetch(`${base}/service-metadata.json`)).json()) as {
      public_reports: Array<{ report_version_id: string; status: string; superseded_by: string | null }>;
    };
    expect(metadata.public_reports).toHaveLength(2);
    expect(metadata.public_reports[0]).toMatchObject({ report_version_id: R1_ID, status: 'superseded', superseded_by: R2_ID });
    expect(metadata.public_reports[1]).toMatchObject({ report_version_id: R2_ID, status: 'current', superseded_by: null });
  });

  it('fails closed on an invalid registry (two currents): no report route serves anything', async () => {
    const state = publishedState([r1, r2]);
    const corrupted: PublicReportServingState = {
      serviceMetadata: {
        ...state.serviceMetadata,
        public_reports: state.serviceMetadata.public_reports.map((entry) => ({
          ...entry,
          status: 'current' as const,
          superseded_by: null
        }))
      },
      frozenReports: state.frozenReports
    };
    const base = await startServer(corrupted);
    for (const route of [CANONICAL_HTML, CANONICAL_JSON, `${CANONICAL_HTML}/${R1_ID}`, `${CANONICAL_HTML}/${R2_ID}.json`]) {
      expect((await fetch(`${base}${route}`)).status).toBe(404);
    }
  });

  it("never serves another report family's registry entry through these routes", async () => {
    const state = publishedState([r1]);
    const foreignId = 'some_other_family_report_v1.r1';
    const withForeignEntry: PublicReportServingState = {
      serviceMetadata: {
        ...state.serviceMetadata,
        public_reports: [
          ...state.serviceMetadata.public_reports,
          {
            report_version_id: foreignId,
            canonical_url: '/nfl/2023/some-other-report',
            version_url: `/nfl/2023/some-other-report/${foreignId}`,
            status: 'current',
            superseded_by: null,
            published_at: '2026-07-17T00:00:00.000Z'
          }
        ]
      },
      frozenReports: new Map([...state.frozenReports, [foreignId, { json: r2.json, html: r2.html }]])
    };
    const base = await startServer(withForeignEntry);
    // The foreign entry is structurally valid and has frozen content, but it belongs to another
    // canonical_url family — the offensive-environments identity must not serve it.
    expect((await fetch(`${base}${CANONICAL_HTML}/${foreignId}`)).status).toBe(404);
    expect((await fetch(`${base}${CANONICAL_HTML}/${foreignId}.json`)).status).toBe(404);
    // The family's own version stays served.
    expect((await fetch(`${base}${CANONICAL_HTML}/${R1_ID}.json`)).status).toBe(200);
  });

  it('does not treat nested or malformed version paths as servable', async () => {
    const base = await startServer(publishedState([r1]));
    for (const route of [
      `${CANONICAL_HTML}//`,
      `${CANONICAL_HTML}/${R1_ID}/extra`,
      `${CANONICAL_HTML}/.json`,
      `${CANONICAL_HTML}.jsonx`
    ]) {
      expect((await fetch(`${base}${route}`)).status).toBe(404);
    }
  });

  it('HTML and JSON at both identities never render supersession status content', async () => {
    const base = await startServer(publishedState([r1, r2]));
    for (const route of [CANONICAL_HTML, `${CANONICAL_HTML}/${R1_ID}`, `${CANONICAL_HTML}/${R2_ID}`]) {
      const body = await (await fetch(`${base}${route}`)).text();
      expect(body).not.toMatch(/supersed/i);
    }
    const versionJson = await (await fetch(`${base}${CANONICAL_HTML}/${R1_ID}.json`)).json();
    expect(versionJson).not.toHaveProperty('supersession_status');
    expect(versionJson).not.toHaveProperty('superseded_by');
    expect(versionJson).not.toHaveProperty('status');
  });
});
