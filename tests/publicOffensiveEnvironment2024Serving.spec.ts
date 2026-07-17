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
import { LIVE_SERVICE_METADATA } from '../src/reports/publicReportRegistry.js';
import {
  FrozenPublicReportStore,
  LIVE_PUBLIC_REPORT_SERVING_STATE,
  createTeamstateServer,
  publishPublicReportVersion,
  type PublicReportServingState
} from '../src/server.js';

const GOVERNED_SOURCE_PATH = path.resolve(
  process.cwd(),
  'data/governed/team_week_raw_v0_2024_real_source_candidate.json'
);
const CANONICAL_HTML = '/nfl/2024/offensive-environments';
const CANONICAL_JSON = '/nfl/2024/offensive-environments.json';
const PUBLISHED_AT = '2026-07-17T00:00:00.000Z';

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

const approvalFor = (version: typeof r1) => ({
  report_version_id: version.payload.report_version_id,
  approved_by: 'test-operator',
  approved_at: PUBLISHED_AT
});

const EMPTY_STATE: PublicReportServingState = {
  serviceMetadata: LIVE_SERVICE_METADATA,
  frozenReports: new FrozenPublicReportStore()
};

// Publish through the ONLY publication path: the publisher validates the raw materials
// internally (there is no caller-suppliable validation result) and derives the registry
// identities from the contract — the same path production publication must take.
const publish = (state: PublicReportServingState, version: typeof r1): PublicReportServingState =>
  publishPublicReportVersion(state, {
    payload: version.payload,
    html: version.html,
    governedSourceBytes,
    approval: approvalFor(version),
    publishedAt: PUBLISHED_AT
  });

const publishedState = (versions: Array<(typeof r1)>): PublicReportServingState =>
  versions.reduce(publish, EMPTY_STATE);

const frozenRecordFor = (reportVersionId: string, version: typeof r1) => ({
  reportVersionId,
  json: version.json,
  html: version.html,
  jsonSha256: computeSha256Hex(version.json),
  htmlSha256: computeSha256Hex(version.html)
});

describe('publishPublicReportVersion — internal validation is the only publication path', () => {
  it('publishes a genuinely valid version and enables publication atomically', () => {
    const state = publish(EMPTY_STATE, r1);
    expect(state.serviceMetadata.artifact_publication_enabled).toBe(true);
    expect(state.serviceMetadata.public_reports).toEqual([
      {
        report_version_id: R1_ID,
        canonical_url: CANONICAL_HTML,
        version_url: `${CANONICAL_HTML}/${R1_ID}`,
        status: 'current',
        superseded_by: null,
        published_at: PUBLISHED_AT
      }
    ]);
    expect(state.frozenReports.resolve(R1_ID)?.json).toBe(r1.json);
    // Input state is untouched (pure step) and the live scaffold remains disabled.
    expect(EMPTY_STATE.serviceMetadata.artifact_publication_enabled).toBe(false);
    expect(EMPTY_STATE.frozenReports.size).toBe(0);
  });

  it('flips current → superseded atomically when publishing a successor', () => {
    const state = publishedState([r1, r2]);
    const [first, second] = state.serviceMetadata.public_reports;
    expect(first).toMatchObject({ report_version_id: R1_ID, status: 'superseded', superseded_by: R2_ID });
    expect(second).toMatchObject({ report_version_id: R2_ID, status: 'current', superseded_by: null });
  });

  it('refuses unvalidated content: a doctored payload cannot be published no matter what the caller asserts', () => {
    const doctored = JSON.parse(JSON.stringify(r1.payload)) as typeof r1.payload;
    doctored.teams[0].derived.epaPerPlay = 0.9999;
    expect(() =>
      publishPublicReportVersion(EMPTY_STATE, {
        payload: doctored,
        html: renderPublicReport2024Html(doctored),
        governedSourceBytes,
        approval: approvalFor(r1),
        publishedAt: PUBLISHED_AT
      })
    ).toThrow(/internal validation rejected .*E_UNWEIGHTED_AGGREGATION_USED/);
    expect(EMPTY_STATE.serviceMetadata.artifact_publication_enabled).toBe(false);
  });

  it('refuses publication without a real approval for the exact version', () => {
    expect(() =>
      publishPublicReportVersion(EMPTY_STATE, {
        payload: r1.payload,
        html: r1.html,
        governedSourceBytes,
        approval: approvalFor(r2), // approval names r2, payload is r1
        publishedAt: PUBLISHED_AT
      })
    ).toThrow(/E_PUBLICATION_NOT_APPROVED/);
  });

  it('refuses re-publication of an already-registered report_version_id', () => {
    const state = publish(EMPTY_STATE, r1);
    expect(() => publish(state, r1)).toThrow(/already exists|already registered/);
  });

  it('refuses a malformed publishedAt timestamp', () => {
    expect(() =>
      publishPublicReportVersion(EMPTY_STATE, {
        payload: r1.payload,
        html: r1.html,
        governedSourceBytes,
        approval: approvalFor(r1),
        publishedAt: 'sometime last week'
      })
    ).toThrow(/not a valid ISO-8601 timestamp/);
  });

  it('always registers under the contract family — route identities are not caller inputs', () => {
    // There is no canonical_url/version_url input at all; the published entry's identities are
    // derived from the contract constants, so a validated report can never be registered under
    // another canonical family.
    const state = publish(EMPTY_STATE, r1);
    expect(state.serviceMetadata.public_reports[0].canonical_url).toBe(CANONICAL_HTML);
    expect(state.serviceMetadata.public_reports[0].version_url).toBe(`${CANONICAL_HTML}/${R1_ID}`);
  });
});

describe('FrozenPublicReportStore — encapsulated, digest-verified, immutable', () => {
  it('refuses registration whose bytes do not match the validated digests', () => {
    const store = new FrozenPublicReportStore();
    expect(() =>
      store.register({ ...frozenRecordFor(R1_ID, r1), jsonSha256: 'a'.repeat(64) })
    ).toThrow(/do not match the validated digest/);
    expect(() =>
      store.register({ ...frozenRecordFor(R1_ID, r1), htmlSha256: 'b'.repeat(64) })
    ).toThrow(/do not match the validated digest/);
  });

  it('never overwrites an already-registered version', () => {
    const store = new FrozenPublicReportStore();
    store.register(frozenRecordFor(R1_ID, r1));
    expect(() => store.register(frozenRecordFor(R1_ID, r1))).toThrow(/never overwritten/);
  });

  it('exposes only frozen records — stored content cannot be mutated after publication', () => {
    const store = new FrozenPublicReportStore();
    store.register(frozenRecordFor(R1_ID, r1));
    const record = store.resolve(R1_ID)!;
    expect(Object.isFrozen(record)).toBe(true);
    expect(() => {
      (record as { json: string }).json = r2.json;
    }).toThrow();
    expect(store.resolve(R1_ID)!.json).toBe(r1.json);
  });

  it('resolve() fails closed when content does not declare the requested version', () => {
    // Simulate a corrupted/bypassed store: r2 bytes registered under the r1 key with internally
    // consistent digests — the content-identity re-verification still refuses to serve it.
    const store = new FrozenPublicReportStore();
    store.register(frozenRecordFor(R1_ID, r2));
    expect(store.resolve(R1_ID)).toBeNull();
  });
});

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
    const base = await startServer({ serviceMetadata: state.serviceMetadata, frozenReports: new FrozenPublicReportStore() });
    expect((await fetch(`${base}${CANONICAL_JSON}`)).status).toBe(404);
    expect((await fetch(`${base}${CANONICAL_HTML}/${R1_ID}.json`)).status).toBe(404);
  });

  it('never serves frozen content that has no registry entry (candidate/fixture content unreachable)', async () => {
    const state = publishedState([r1]);
    const withUnregisteredContent: PublicReportServingState = {
      serviceMetadata: state.serviceMetadata,
      frozenReports: state.frozenReports.withRegistered(frozenRecordFor(R2_ID, r2))
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
            published_at: PUBLISHED_AT
          }
        ]
      },
      frozenReports: state.frozenReports.withRegistered(frozenRecordFor(foreignId, r2))
    };
    const base = await startServer(withForeignEntry);
    // The foreign entry is structurally valid and has frozen content, but it belongs to another
    // canonical_url family — the offensive-environments identity must not serve it.
    expect((await fetch(`${base}${CANONICAL_HTML}/${foreignId}`)).status).toBe(404);
    expect((await fetch(`${base}${CANONICAL_HTML}/${foreignId}.json`)).status).toBe(404);
    // The family's own version stays served.
    expect((await fetch(`${base}${CANONICAL_HTML}/${R1_ID}.json`)).status).toBe(200);
  });

  it('frozen r2 bytes stored under the r1 key are never served (content-identity verification)', async () => {
    const state = publishedState([r1]);
    const corrupted: PublicReportServingState = {
      serviceMetadata: state.serviceMetadata,
      // Simulate a corrupted/bypassed store: r2 content sitting under the r1 key.
      frozenReports: new FrozenPublicReportStore().withRegistered(frozenRecordFor(R1_ID, r2))
    };
    const base = await startServer(corrupted);
    expect((await fetch(`${base}${CANONICAL_HTML}/${R1_ID}`)).status).toBe(404);
    expect((await fetch(`${base}${CANONICAL_HTML}/${R1_ID}.json`)).status).toBe(404);
    expect((await fetch(`${base}${CANONICAL_HTML}`)).status).toBe(404);
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
