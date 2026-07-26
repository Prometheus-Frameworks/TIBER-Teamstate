import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  adaptTeamWeekRawV0Governed,
  type TeamWeekRawGovernedRow
} from '../src/adapters/teamWeekRawV0GovernedAdapter.js';
import { loadTeamWeekRawV0Governed } from '../src/ingest/loadTeamWeekRawV0Governed.js';
import { renderPublicReport2024Html } from '../src/reports/publicOffensiveEnvironment2024Html.js';
import {
  buildPublicReport2024Payload,
  computeSha256Hex,
  roundHalfAwayFromZero,
  serializePublicReport2024Payload
} from '../src/reports/publicOffensiveEnvironment2024Report.js';
import {
  validatePublicReport2024,
  type PublicationApprovalRecord,
  type ValidatePublicReport2024Context
} from '../src/reports/publicOffensiveEnvironment2024Validator.js';
import { LIVE_SERVICE_METADATA, type TeamstateServiceMetadata } from '../src/reports/publicReportRegistry.js';
import type { PublicReport2024Payload } from '../src/contracts/teamstatePublicOffensiveEnvironment2024V1.js';

const GOVERNED_SOURCE_PATH = path.resolve(
  process.cwd(),
  'data/governed/team_week_raw_v0_2024_real_source_candidate.json'
);
const GENERATED_AT = '2026-07-17T00:00:00.000Z';

const governedSourceBytes = readFileSync(GOVERNED_SOURCE_PATH);
const governedSourceSha256 = computeSha256Hex(governedSourceBytes);
const consumption = loadTeamWeekRawV0Governed(GOVERNED_SOURCE_PATH);
const payload = buildPublicReport2024Payload(consumption, {
  generatedAt: GENERATED_AT,
  governedInputSha256: governedSourceSha256
});
const html = renderPublicReport2024Html(payload);

const APPROVAL: PublicationApprovalRecord = {
  report_version_id: payload.report_version_id,
  approved_by: 'test-operator',
  approved_at: GENERATED_AT,
  json_sha256: computeSha256Hex(serializePublicReport2024Payload(payload)),
  html_sha256: computeSha256Hex(html)
};

const fullContext: ValidatePublicReport2024Context = {
  governedSourceBytes,
  html,
  registry: LIVE_SERVICE_METADATA,
  approvals: [APPROVAL]
};

const clone = (): PublicReport2024Payload => JSON.parse(JSON.stringify(payload)) as PublicReport2024Payload;

/** Doctored governed source bytes: the committed artifact with its rows transformed. */
const doctoredSourceBytes = (mutateRows: (rows: TeamWeekRawGovernedRow[]) => TeamWeekRawGovernedRow[]): Buffer => {
  const artifact = JSON.parse(governedSourceBytes.toString('utf-8')) as { rows: TeamWeekRawGovernedRow[] };
  artifact.rows = mutateRows(artifact.rows.map((row) => ({ ...row })));
  return Buffer.from(JSON.stringify(artifact), 'utf-8');
};

/** Payload honestly derived from doctored bytes (via the real adapter), pinned checksum kept. */
const buildFromBytes = (bytes: Buffer): PublicReport2024Payload =>
  buildPublicReport2024Payload(adaptTeamWeekRawV0Governed(JSON.parse(bytes.toString('utf-8')), 'doctored.json'), {
    generatedAt: GENERATED_AT,
    governedInputSha256: governedSourceSha256
  });

const codesOf = (result: { rejections: Array<{ code: string }> }): string[] =>
  result.rejections.map((rejection) => rejection.code);

describe('validatePublicReport2024 — §10 fail-closed acceptance matrix', () => {
  it('#1: input row set missing team BUF → E_COVERAGE_TEAM_MISSING, no publication', () => {
    const bytes = doctoredSourceBytes((rows) => rows.filter((row) => row.teamCode !== 'BUF'));
    const doctored = buildFromBytes(bytes);
    const result = validatePublicReport2024(doctored, { governedSourceBytes: bytes, approvals: [APPROVAL] });
    expect(codesOf(result)).toContain('E_COVERAGE_TEAM_MISSING');
    expect(result.publishable).toBe(false);
  });

  it('#2: 543 rows with all 32 teams present → E_COVERAGE_ROW_COUNT_MISMATCH, no publication', () => {
    const bytes = doctoredSourceBytes((rows) => rows.slice(0, -1));
    const doctored = buildFromBytes(bytes);
    expect(new Set(doctored.teams.map((team) => team.team)).size).toBe(32);
    const result = validatePublicReport2024(doctored, { governedSourceBytes: bytes, approvals: [APPROVAL] });
    expect(codesOf(result)).toContain('E_COVERAGE_ROW_COUNT_MISMATCH');
    expect(result.publishable).toBe(false);
  });

  it('#3: one team with 16 rows, another with 18 → E_COVERAGE_ROW_COUNT_MISMATCH, no publication', () => {
    const bytes = doctoredSourceBytes((rows) => {
      const ariRow = rows.find((row) => row.teamCode === 'ARI')!;
      ariRow.teamCode = 'ATL';
      return rows;
    });
    const doctored = buildFromBytes(bytes);
    const result = validatePublicReport2024(doctored, { governedSourceBytes: bytes, approvals: [APPROVAL] });
    expect(codesOf(result)).toContain('E_COVERAGE_ROW_COUNT_MISMATCH');
    expect(result.publishable).toBe(false);
  });

  it('#4: provenance not governed / missing → E_PROVENANCE_NOT_GOVERNED / E_PROVENANCE_MISSING', () => {
    const notGoverned = clone();
    notGoverned.provenance_status = 'partial_real_data';
    expect(codesOf(validatePublicReport2024(notGoverned, { approvals: [APPROVAL] }))).toContain(
      'E_PROVENANCE_NOT_GOVERNED'
    );

    const missing = clone() as unknown as Record<string, unknown>;
    delete missing.provenance_status;
    expect(
      codesOf(validatePublicReport2024(missing as unknown as PublicReport2024Payload, { approvals: [APPROVAL] }))
    ).toContain('E_PROVENANCE_MISSING');

    // Source-side: bytes whose own governance markers fail the adapter also fail closed.
    const badSourceBytes = (() => {
      const artifact = JSON.parse(governedSourceBytes.toString('utf-8')) as {
        metadata: { provenanceStatus: string };
      };
      artifact.metadata.provenanceStatus = 'partial_real_data';
      return Buffer.from(JSON.stringify(artifact), 'utf-8');
    })();
    const sourceResult = validatePublicReport2024(clone(), {
      governedSourceBytes: badSourceBytes,
      approvals: [APPROVAL]
    });
    expect(codesOf(sourceResult)).toContain('E_PROVENANCE_NOT_GOVERNED');
    expect(sourceResult.publishable).toBe(false);
  });

  it('#5: committed governed bytes drifted from the pin → E_GOVERNED_INPUT_CHECKSUM_MISMATCH', () => {
    const driftedBytes = Buffer.concat([governedSourceBytes, Buffer.from('\n')]);
    const result = validatePublicReport2024(clone(), { governedSourceBytes: driftedBytes, approvals: [APPROVAL] });
    expect(codesOf(result)).toContain('E_GOVERNED_INPUT_CHECKSUM_MISMATCH');
    expect(result.publishable).toBe(false);
  });

  it('#5a: an upstream_sources[] entry with checksum: null → E_UPSTREAM_SOURCE_CHECKSUM_MISSING', () => {
    const doctored = clone();
    doctored.upstream_sources[0].checksum = null;
    const result = validatePublicReport2024(doctored, { approvals: [APPROVAL] });
    expect(codesOf(result)).toContain('E_UPSTREAM_SOURCE_CHECKSUM_MISSING');
    expect(result.publishable).toBe(false);
  });

  it('#6: pressureRateAllowed present on a team, even as null → E_WITHHELD_FIELD_PRESENT', () => {
    const doctored = clone();
    (doctored.teams[0] as unknown as Record<string, unknown>).pressureRateAllowed = null;
    const result = validatePublicReport2024(doctored, { approvals: [APPROVAL] });
    expect(codesOf(result)).toContain('E_WITHHELD_FIELD_PRESENT');
    expect(result.publishable).toBe(false);
  });

  it('#7: fantasyPointsForQB: 0 on a team → E_WITHHELD_FIELD_ZERO_FILLED', () => {
    const doctored = clone();
    (doctored.teams[0].observed as unknown as Record<string, unknown>).fantasyPointsForQB = 0;
    const result = validatePublicReport2024(doctored, { approvals: [APPROVAL] });
    expect(codesOf(result)).toContain('E_WITHHELD_FIELD_ZERO_FILLED');
    expect(codesOf(result)).toContain('E_WITHHELD_FIELD_PRESENT');
    expect(result.publishable).toBe(false);
  });

  it('#8: passRate or passEpaPerPlay present by any method → E_APPROXIMATED_DENOMINATOR_UNAUTHORIZED', () => {
    const withPassRate = clone();
    (withPassRate.teams[0].derived as unknown as Record<string, unknown>).passRate = 0.61;
    expect(codesOf(validatePublicReport2024(withPassRate, { approvals: [APPROVAL] }))).toContain(
      'E_APPROXIMATED_DENOMINATOR_UNAUTHORIZED'
    );

    const withPassEpa = clone();
    (withPassEpa.teams[0].derived as unknown as Record<string, unknown>).passEpaPerPlay = 0.12;
    expect(codesOf(validatePublicReport2024(withPassEpa, { approvals: [APPROVAL] }))).toContain(
      'E_APPROXIMATED_DENOMINATOR_UNAUTHORIZED'
    );
  });

  it('#9: neutralPassRate as a plain mean of weekly values → E_UNWEIGHTED_AGGREGATION_USED', () => {
    // Find a team whose unweighted mean differs from the weighted value at 4 decimals.
    const rowsByTeam = new Map<string, TeamWeekRawGovernedRow[]>();
    for (const row of consumption.rows) {
      rowsByTeam.set(row.teamCode, [...(rowsByTeam.get(row.teamCode) ?? []), row]);
    }
    let targetTeam: string | null = null;
    let simpleMean = 0;
    for (const [team, rows] of rowsByTeam) {
      const weekly = rows.map((row) => row.neutralPassRate as number);
      const mean = roundHalfAwayFromZero(weekly.reduce((a, b) => a + b, 0) / weekly.length, 4);
      const published = payload.teams.find((entry) => entry.team === team)!.derived.neutralPassRate;
      if (mean !== published) {
        targetTeam = team;
        simpleMean = mean;
        break;
      }
    }
    expect(targetTeam).not.toBeNull();

    const doctored = clone();
    doctored.teams.find((entry) => entry.team === targetTeam)!.derived.neutralPassRate = simpleMean;
    const result = validatePublicReport2024(doctored, { governedSourceBytes, approvals: [APPROVAL] });
    const rejection = result.rejections.find((entry) => entry.code === 'E_UNWEIGHTED_AGGREGATION_USED');
    expect(rejection).toBeDefined();
    expect(rejection!.detail).toContain('unweighted simple mean');
    expect(result.publishable).toBe(false);
  });

  it('#10: redZoneTripsTotal == 0 with redZoneTdRate: 0 → E_REDZONE_NULL_INVARIANT_VIOLATED', () => {
    const doctored = clone();
    doctored.teams[0].observed.redZoneTripsTotal = 0;
    doctored.teams[0].derived.redZoneTdRate = 0;
    expect(codesOf(validatePublicReport2024(doctored, { approvals: [APPROVAL] }))).toContain(
      'E_REDZONE_NULL_INVARIANT_VIOLATED'
    );
  });

  it('#11: redZoneTripsTotal > 0 with redZoneTdRate: null → E_REDZONE_NULL_INVARIANT_VIOLATED', () => {
    const doctored = clone();
    doctored.teams[0].derived.redZoneTdRate = null;
    expect(codesOf(validatePublicReport2024(doctored, { approvals: [APPROVAL] }))).toContain(
      'E_REDZONE_NULL_INVARIANT_VIOLATED'
    );
  });

  it('#12: data_through absent → E_TEMPORAL_METADATA_MISSING', () => {
    const doctored = clone() as unknown as { declared_scope: Record<string, unknown> };
    delete doctored.declared_scope.data_through;
    expect(
      codesOf(validatePublicReport2024(doctored as unknown as PublicReport2024Payload, { approvals: [APPROVAL] }))
    ).toContain('E_TEMPORAL_METADATA_MISSING');
  });

  it('#13: source_snapshot_at wired to the play-by-play timestamp instead of max() → E_TEMPORAL_METADATA_CONFLATED', () => {
    const doctored = clone();
    doctored.source_snapshot_at = '2026-06-27T13:42:00+00:00';
    const result = validatePublicReport2024(doctored, { approvals: [APPROVAL] });
    expect(codesOf(result)).toContain('E_TEMPORAL_METADATA_CONFLATED');
    expect(result.publishable).toBe(false);
  });

  it('#14: HTML page for the version omits the report_version_id → E_VERSION_IDENTITY_MISSING', () => {
    const htmlWithoutId = html.replace(`<article data-report-version-id="${payload.report_version_id}">`, '<article>');
    const result = validatePublicReport2024(clone(), { html: htmlWithoutId, approvals: [APPROVAL] });
    expect(codesOf(result)).toContain('E_VERSION_IDENTITY_MISSING');
  });

  it('#15: regenerating an already-published version with different values → E_VERSION_IDENTITY_MUTABLE', () => {
    const publishedVariant = clone();
    publishedVariant.teams[0].observed.pointsForTotal += 1;
    const result = validatePublicReport2024(clone(), {
      approvals: [APPROVAL],
      previouslyPublished: { json: serializePublicReport2024Payload(publishedVariant) }
    });
    expect(codesOf(result)).toContain('E_VERSION_IDENTITY_MUTABLE');
  });

  it('#16: payload carrying a supersession_status field at all → E_VERSION_IDENTITY_MUTABLE', () => {
    const doctored = clone() as unknown as Record<string, unknown>;
    doctored.supersession_status = 'current';
    expect(
      codesOf(validatePublicReport2024(doctored as unknown as PublicReport2024Payload, { approvals: [APPROVAL] }))
    ).toContain('E_VERSION_IDENTITY_MUTABLE');
  });

  it('#16a: HTML rendering "This report has been superseded" → E_VERSION_IDENTITY_MUTABLE', () => {
    const doctoredHtml = html.replace('<h1>', '<p>This report has been superseded.</p><h1>');
    const result = validatePublicReport2024(clone(), { html: doctoredHtml, approvals: [APPROVAL] });
    expect(codesOf(result)).toContain('E_VERSION_IDENTITY_MUTABLE');
  });

  it('#17: HTML showing epaPerPlay rounded differently than JSON → E_HTML_JSON_SEMANTIC_MISMATCH', () => {
    const ari = payload.teams.find((team) => team.team === 'ARI')!;
    const differentlyRounded = ari.derived.epaPerPlay.toFixed(2);
    const doctoredHtml = html.replace(
      new RegExp(`(data-team="ARI" data-field="epaPerPlay">)[^<]*<`),
      `$1${differentlyRounded}<`
    );
    expect(doctoredHtml).not.toBe(html);
    const result = validatePublicReport2024(clone(), { html: doctoredHtml, approvals: [APPROVAL] });
    expect(codesOf(result)).toContain('E_HTML_JSON_SEMANTIC_MISMATCH');
    expect(result.publishable).toBe(false);
  });

  it('#18: registry with two status: "current" entries for the same family → E_REGISTRY_STATE_INVALID', () => {
    const registry: TeamstateServiceMetadata = {
      ...LIVE_SERVICE_METADATA,
      public_reports: [
        {
          report_version_id: 'teamstate_public_offensive_environment_2024_v1.r1',
          canonical_url: '/nfl/2024/offensive-environments',
          version_url: '/nfl/2024/offensive-environments/teamstate_public_offensive_environment_2024_v1.r1',
          status: 'current',
          superseded_by: null,
          published_at: GENERATED_AT
        },
        {
          report_version_id: 'teamstate_public_offensive_environment_2024_v1.r2',
          canonical_url: '/nfl/2024/offensive-environments',
          version_url: '/nfl/2024/offensive-environments/teamstate_public_offensive_environment_2024_v1.r2',
          status: 'current',
          superseded_by: null,
          published_at: GENERATED_AT
        }
      ]
    };
    const result = validatePublicReport2024(clone(), { registry, approvals: [APPROVAL] });
    expect(codesOf(result)).toContain('E_REGISTRY_STATE_INVALID');
  });

  it('#19: every invariant passes but no recorded human approval → only E_PUBLICATION_NOT_APPROVED', () => {
    const result = validatePublicReport2024(payload, { ...fullContext, approvals: [] });
    expect(codesOf(result)).toEqual(['E_PUBLICATION_NOT_APPROVED']);
    expect(result.publishable).toBe(false);
    expect(result.binding).toBeNull();
  });

  it('#20: every invariant passes and approval is recorded → publishable, zero rejections, exact binding', () => {
    const result = validatePublicReport2024(payload, fullContext);
    expect(result.rejections).toEqual([]);
    expect(result.publishable).toBe(true);
    // The binding is generated internally and names this exact version and content.
    expect(result.binding).toEqual({
      report_version_id: payload.report_version_id,
      json_sha256: computeSha256Hex(serializePublicReport2024Payload(payload)),
      html_sha256: computeSha256Hex(html)
    });
  });
});

describe('validatePublicReport2024 — mandatory evidence package (fail closed on omission)', () => {
  const omissions: Array<[keyof ValidatePublicReport2024Context, string]> = [
    ['governedSourceBytes', 'E_GOVERNED_INPUT_CHECKSUM_MISMATCH'],
    ['html', 'E_HTML_JSON_SEMANTIC_MISMATCH'],
    ['registry', 'E_REGISTRY_STATE_INVALID']
  ];

  for (const [evidenceKey, expectedCode] of omissions) {
    it(`omitting ${String(evidenceKey)} can never produce publishable: true (${expectedCode})`, () => {
      const partialContext = { ...fullContext };
      delete partialContext[evidenceKey];
      const result = validatePublicReport2024(payload, partialContext);
      expect(codesOf(result)).toContain(expectedCode);
      expect(result.publishable).toBe(false);
      expect(result.binding).toBeNull();
    });
  }

  it('omitting the governed bytes also fails formula conformance closed', () => {
    const partialContext = { ...fullContext };
    delete partialContext.governedSourceBytes;
    expect(codesOf(validatePublicReport2024(payload, partialContext))).toContain('E_UNWEIGHTED_AGGREGATION_USED');
  });

  it('an approval alone (no other evidence) can never produce publishable: true', () => {
    const result = validatePublicReport2024(payload, { approvals: [APPROVAL] });
    expect(result.publishable).toBe(false);
    expect(result.binding).toBeNull();
    expect(codesOf(result)).toEqual(
      expect.arrayContaining([
        'E_GOVERNED_INPUT_CHECKSUM_MISMATCH',
        'E_UNWEIGHTED_AGGREGATION_USED',
        'E_HTML_JSON_SEMANTIC_MISMATCH',
        'E_REGISTRY_STATE_INVALID'
      ])
    );
  });

  it('a caller cannot bypass the immutability comparison with a stale serialization (computed internally)', () => {
    // The candidate serialization is derived from the payload being validated — supplying
    // published bytes that differ from it must reject, with no caller-supplied substitute.
    const mutated = clone();
    mutated.teams[0].observed.pointsForTotal += 1;
    const result = validatePublicReport2024(mutated, {
      ...fullContext,
      html: renderPublicReport2024Html(mutated),
      previouslyPublished: { json: serializePublicReport2024Payload(payload), html }
    });
    expect(codesOf(result)).toContain('E_VERSION_IDENTITY_MUTABLE');
    expect(result.publishable).toBe(false);
  });

  it('an already-registered report_version_id cannot validate without comparison to the stored content', () => {
    const registry: TeamstateServiceMetadata = {
      ...LIVE_SERVICE_METADATA,
      artifact_publication_enabled: true,
      public_reports: [
        {
          report_version_id: payload.report_version_id,
          canonical_url: '/nfl/2024/offensive-environments',
          version_url: `/nfl/2024/offensive-environments/${payload.report_version_id}`,
          status: 'current',
          superseded_by: null,
          published_at: GENERATED_AT
        }
      ]
    };
    // Omitting the stored-content comparison for an already-published version must fail closed.
    const withoutPrior = validatePublicReport2024(payload, { ...fullContext, registry });
    expect(codesOf(withoutPrior)).toContain('E_VERSION_IDENTITY_MUTABLE');
    expect(withoutPrior.publishable).toBe(false);

    // With the actual stored frozen content supplied, the unchanged candidate validates.
    const withPrior = validatePublicReport2024(payload, {
      ...fullContext,
      registry,
      previouslyPublished: { json: serializePublicReport2024Payload(payload), html }
    });
    expect(withPrior.publishable).toBe(true);
  });

  it('published HTML without a candidate render fails closed', () => {
    const result = validatePublicReport2024(payload, {
      governedSourceBytes,
      registry: LIVE_SERVICE_METADATA,
      approvals: [APPROVAL],
      previouslyPublished: { html }
    });
    expect(codesOf(result)).toContain('E_VERSION_IDENTITY_MUTABLE');
  });

  it('rejects malformed or content-mismatched approval records', () => {
    const emptyApprover = validatePublicReport2024(payload, {
      ...fullContext,
      approvals: [{ ...APPROVAL, approved_by: '   ' }]
    });
    expect(codesOf(emptyApprover)).toContain('E_PUBLICATION_NOT_APPROVED');
    expect(emptyApprover.publishable).toBe(false);

    const badTimestamp = validatePublicReport2024(payload, {
      ...fullContext,
      approvals: [{ ...APPROVAL, approved_at: 'yesterday' }]
    });
    expect(codesOf(badTimestamp)).toContain('E_PUBLICATION_NOT_APPROVED');
    expect(badTimestamp.publishable).toBe(false);

    const staleJsonApproval = validatePublicReport2024(payload, {
      ...fullContext,
      approvals: [{ ...APPROVAL, json_sha256: 'a'.repeat(64) }]
    });
    expect(codesOf(staleJsonApproval)).toContain('E_PUBLICATION_NOT_APPROVED');
    expect(staleJsonApproval.publishable).toBe(false);

    const staleHtmlApproval = validatePublicReport2024(payload, {
      ...fullContext,
      approvals: [{ ...APPROVAL, html_sha256: 'b'.repeat(64) }]
    });
    expect(codesOf(staleHtmlApproval)).toContain('E_PUBLICATION_NOT_APPROVED');
    expect(staleHtmlApproval.publishable).toBe(false);
  });
});

describe('validatePublicReport2024 — internal binding of rows/metadata to the hashed bytes', () => {
  it('authentic pinned bytes plus a payload derived from altered rows cannot pass', () => {
    // The prior attack: alter a row's EPA, generate the payload from the altered rows, then
    // supply the authentic committed bytes. Rows are now parsed from the hashed bytes themselves,
    // so the altered-row payload fails formula conformance against the authentic derivation.
    const alteredBytes = doctoredSourceBytes((rows) => {
      rows[0].epaPerPlay = (rows[0].epaPerPlay as number) + 0.5;
      return rows;
    });
    const payloadFromAlteredRows = buildFromBytes(alteredBytes);
    const result = validatePublicReport2024(payloadFromAlteredRows, {
      governedSourceBytes, // authentic committed bytes, authentic checksum
      html: renderPublicReport2024Html(payloadFromAlteredRows),
      registry: LIVE_SERVICE_METADATA,
      approvals: [APPROVAL]
    });
    expect(codesOf(result)).toContain('E_UNWEIGHTED_AGGREGATION_USED');
    expect(result.publishable).toBe(false);
  });

  it('forged upstream source metadata (well-shaped but not the recorded values) cannot pass', () => {
    const forgedRef = clone();
    forgedRef.upstream_sources[0].source_ref = 'nflverse-data:pbp/play_by_play_2023';
    const refResult = validatePublicReport2024(forgedRef, {
      ...fullContext,
      html: renderPublicReport2024Html(forgedRef)
    });
    expect(codesOf(refResult)).toContain('E_UPSTREAM_SOURCE_CHECKSUM_MISSING');
    expect(refResult.publishable).toBe(false);

    const forgedChecksum = clone();
    forgedChecksum.upstream_sources[0].checksum = { algorithm: 'sha256', value: 'ab'.repeat(32) };
    const checksumResult = validatePublicReport2024(forgedChecksum, {
      ...fullContext,
      html: renderPublicReport2024Html(forgedChecksum)
    });
    expect(codesOf(checksumResult)).toContain('E_UPSTREAM_SOURCE_CHECKSUM_MISSING');
    expect(checksumResult.publishable).toBe(false);
  });

  it('a fabricated warning consistent within the payload and HTML still fails recomputation', () => {
    const doctored = clone();
    doctored.teams[0].warnings = ['W_ZERO_REDZONE_OPPORTUNITIES'];
    doctored.warnings = [{ team: doctored.teams[0].team, code: 'W_ZERO_REDZONE_OPPORTUNITIES' }];
    const result = validatePublicReport2024(doctored, {
      ...fullContext,
      html: renderPublicReport2024Html(doctored)
    });
    expect(codesOf(result)).toContain('E_UNWEIGHTED_AGGREGATION_USED');
    expect(result.publishable).toBe(false);
  });
});

describe('validatePublicReport2024 — adversarial full-context payloads (§5 exactness)', () => {
  // Every case here supplies the COMPLETE evidence package and re-renders HTML from the doctored
  // payload (so parity alone cannot catch it) — the payload-level checks must fail closed.
  const doctoredFullContext = (doctored: PublicReport2024Payload): ValidatePublicReport2024Context => ({
    governedSourceBytes,
    html: renderPublicReport2024Html(doctored),
    registry: LIVE_SERVICE_METADATA,
    approvals: [APPROVAL]
  });

  it('an altered derived value with matching HTML still fails closed (formula conformance)', () => {
    const doctored = clone();
    doctored.teams[0].derived.epaPerPlay = 0.9999;
    const result = validatePublicReport2024(doctored, doctoredFullContext(doctored));
    expect(codesOf(result)).toContain('E_UNWEIGHTED_AGGREGATION_USED');
    expect(result.publishable).toBe(false);
  });

  it('altered coverage metadata with matching HTML fails closed against recomputation', () => {
    const doctored = clone();
    doctored.coverage.team_count = 31;
    doctored.coverage.team_game_row_count = 527;
    doctored.coverage.satisfies_declared_scope = false;
    const result = validatePublicReport2024(doctored, doctoredFullContext(doctored));
    expect(codesOf(result)).toContain('E_COVERAGE_ROW_COUNT_MISMATCH');
    expect(result.publishable).toBe(false);
  });

  it('altered artifact/schema identity fails closed', () => {
    const wrongArtifact = clone();
    wrongArtifact.artifact = 'teamstate_public_defensive_environment_2024_v1';
    expect(codesOf(validatePublicReport2024(wrongArtifact, doctoredFullContext(wrongArtifact)))).toContain(
      'E_METHODOLOGY_VERSION_UNKNOWN'
    );

    const wrongSchema = clone();
    wrongSchema.schema_version = '2.0.0';
    expect(codesOf(validatePublicReport2024(wrongSchema, doctoredFullContext(wrongSchema)))).toContain(
      'E_METHODOLOGY_VERSION_UNKNOWN'
    );
  });

  it('altered canonical/version URLs fail closed', () => {
    const wrongCanonical = clone();
    wrongCanonical.canonical_url = '/nfl/2024/offensive-environments-v2.json';
    expect(codesOf(validatePublicReport2024(wrongCanonical, doctoredFullContext(wrongCanonical)))).toContain(
      'E_VERSION_IDENTITY_MISSING'
    );

    const wrongVersionUrl = clone();
    wrongVersionUrl.version_url = '/nfl/2024/offensive-environments/teamstate_public_offensive_environment_2024_v1.r9.json';
    expect(codesOf(validatePublicReport2024(wrongVersionUrl, doctoredFullContext(wrongVersionUrl)))).toContain(
      'E_VERSION_IDENTITY_MISSING'
    );
  });

  it('altered declared scope, excluded lanes, or provenance references fail closed', () => {
    const wrongScope = clone();
    wrongScope.declared_scope.output_meaning = 'current_state_ranking';
    expect(codesOf(validatePublicReport2024(wrongScope, doctoredFullContext(wrongScope)))).toContain(
      'E_UNDOCUMENTED_FIELD_PRESENT'
    );

    const droppedLane = clone();
    droppedLane.excluded_lanes = droppedLane.excluded_lanes.filter((lane) => lane.field !== 'passRate');
    expect(codesOf(validatePublicReport2024(droppedLane, doctoredFullContext(droppedLane)))).toContain(
      'E_UNDOCUMENTED_FIELD_PRESENT'
    );

    const wrongGovernedPath = clone();
    wrongGovernedPath.governed_input.path = 'output/team_environment_profiles_v0.json';
    expect(codesOf(validatePublicReport2024(wrongGovernedPath, doctoredFullContext(wrongGovernedPath)))).toContain(
      'E_GOVERNED_INPUT_CHECKSUM_MISMATCH'
    );

    const wrongValidationRef = clone();
    wrongValidationRef.validation_report.path = 'somewhere/else.json';
    expect(codesOf(validatePublicReport2024(wrongValidationRef, doctoredFullContext(wrongValidationRef)))).toContain(
      'E_UNDOCUMENTED_FIELD_PRESENT'
    );
  });

  it('malformed checksums fail closed: wrong algorithm, short digest, uppercase hex', () => {
    const wrongAlgorithm = clone();
    wrongAlgorithm.governed_input.checksum.algorithm = 'md5';
    expect(codesOf(validatePublicReport2024(wrongAlgorithm, doctoredFullContext(wrongAlgorithm)))).toContain(
      'E_GOVERNED_INPUT_CHECKSUM_MISMATCH'
    );

    const shortDigest = clone();
    shortDigest.upstream_sources[0].checksum = { algorithm: 'sha256', value: 'abc123' };
    expect(codesOf(validatePublicReport2024(shortDigest, doctoredFullContext(shortDigest)))).toContain(
      'E_UPSTREAM_SOURCE_CHECKSUM_MISSING'
    );

    const uppercaseDigest = clone();
    uppercaseDigest.upstream_sources[1].checksum = {
      algorithm: 'sha256',
      value: uppercaseDigest.upstream_sources[1].checksum!.value.toUpperCase()
    };
    expect(codesOf(validatePublicReport2024(uppercaseDigest, doctoredFullContext(uppercaseDigest)))).toContain(
      'E_UPSTREAM_SOURCE_CHECKSUM_MISSING'
    );
  });

  it('undocumented nested fields under contract objects and checksums fail closed', () => {
    const nestedChecksumExtra = clone();
    (nestedChecksumExtra.governed_input.checksum as unknown as Record<string, unknown>).note = 'trust me';
    expect(codesOf(validatePublicReport2024(nestedChecksumExtra, doctoredFullContext(nestedChecksumExtra)))).toContain(
      'E_GOVERNED_INPUT_CHECKSUM_MISMATCH'
    );

    const governedInputExtra = clone();
    (governedInputExtra.governed_input as unknown as Record<string, unknown>).mirror_of = 'somewhere';
    expect(codesOf(validatePublicReport2024(governedInputExtra, doctoredFullContext(governedInputExtra)))).toContain(
      'E_UNDOCUMENTED_FIELD_PRESENT'
    );

    const coverageExtra = clone();
    (coverageExtra.coverage as unknown as Record<string, unknown>).confidence = 'high';
    expect(codesOf(validatePublicReport2024(coverageExtra, doctoredFullContext(coverageExtra)))).toContain(
      'E_UNDOCUMENTED_FIELD_PRESENT'
    );

    const upstreamExtra = clone();
    (upstreamExtra.upstream_sources[0] as unknown as Record<string, unknown>).mirror_url = 'https://example.com';
    expect(codesOf(validatePublicReport2024(upstreamExtra, doctoredFullContext(upstreamExtra)))).toContain(
      'E_UNDOCUMENTED_FIELD_PRESENT'
    );
  });

  it('invalid timestamp strings fail closed instead of passing through Date.parse', () => {
    const badGeneratedAt = clone();
    badGeneratedAt.generated_at = 'not-a-date';
    expect(codesOf(validatePublicReport2024(badGeneratedAt, doctoredFullContext(badGeneratedAt)))).toContain(
      'E_TEMPORAL_METADATA_MISSING'
    );

    const badSnapshot = clone();
    badSnapshot.source_snapshot_at = '2026-13-99T99:99:99+00:00';
    expect(codesOf(validatePublicReport2024(badSnapshot, doctoredFullContext(badSnapshot)))).toContain(
      'E_TEMPORAL_METADATA_MISSING'
    );

    const badUpstreamSnapshot = clone();
    badUpstreamSnapshot.upstream_sources[0].source_snapshot_at = 'last june';
    expect(codesOf(validatePublicReport2024(badUpstreamSnapshot, doctoredFullContext(badUpstreamSnapshot)))).toContain(
      'E_TEMPORAL_METADATA_MISSING'
    );
  });

  it('undocumented top-level payload fields fail closed', () => {
    const doctored = clone() as unknown as Record<string, unknown>;
    doctored.extra_commentary = 'exciting season!';
    const result = validatePublicReport2024(
      doctored as unknown as PublicReport2024Payload,
      doctoredFullContext(doctored as unknown as PublicReport2024Payload)
    );
    expect(codesOf(result)).toContain('E_UNDOCUMENTED_FIELD_PRESENT');
    expect(result.publishable).toBe(false);
  });

  it('visible HTML scope divergence fails closed even when extracted fields agree (byte-exact render)', () => {
    const divergentHtml = html.replace('<span data-scope="season">2024</span>', '<span data-scope="season">2099</span>');
    expect(divergentHtml).not.toBe(html);
    const result = validatePublicReport2024(payload, { ...fullContext, html: divergentHtml });
    expect(codesOf(result)).toContain('E_HTML_JSON_SEMANTIC_MISMATCH');
    expect(result.publishable).toBe(false);
  });

  it('visible HTML provenance divergence fails closed (byte-exact render)', () => {
    const divergentHtml = html.replace('governed_real_data', 'governed_real_data (verified twice)');
    expect(divergentHtml).not.toBe(html);
    const result = validatePublicReport2024(payload, { ...fullContext, html: divergentHtml });
    expect(codesOf(result)).toContain('E_HTML_JSON_SEMANTIC_MISMATCH');
    expect(result.publishable).toBe(false);
  });
});

describe('validatePublicReport2024 — remaining §9 rejection codes', () => {
  it('rejects an unknown methodology_version → E_METHODOLOGY_VERSION_UNKNOWN', () => {
    const doctored = clone();
    doctored.methodology_version = 'teamstate_public_offensive_environment_2024_v2';
    expect(codesOf(validatePublicReport2024(doctored, { approvals: [APPROVAL] }))).toContain(
      'E_METHODOLOGY_VERSION_UNKNOWN'
    );
  });

  it('rejects a field §3 does not define → E_UNDOCUMENTED_FIELD_PRESENT', () => {
    const doctored = clone();
    (doctored.teams[0].derived as unknown as Record<string, unknown>).explosiveDriveRate = 0.2;
    expect(codesOf(validatePublicReport2024(doctored, { approvals: [APPROVAL] }))).toContain(
      'E_UNDOCUMENTED_FIELD_PRESENT'
    );
  });

  it('rejects absent identity fields → E_VERSION_IDENTITY_MISSING', () => {
    const doctored = clone() as unknown as Record<string, unknown>;
    delete doctored.canonical_url;
    expect(
      codesOf(validatePublicReport2024(doctored as unknown as PublicReport2024Payload, { approvals: [APPROVAL] }))
    ).toContain('E_VERSION_IDENTITY_MISSING');
  });

  it('rejects generated_at wired to source_snapshot_at (identical literal) → E_TEMPORAL_METADATA_CONFLATED', () => {
    const doctored = clone();
    doctored.generated_at = doctored.source_snapshot_at;
    const result = validatePublicReport2024(doctored, { approvals: [APPROVAL] });
    expect(codesOf(result)).toContain('E_TEMPORAL_METADATA_CONFLATED');
    expect(result.publishable).toBe(false);
  });

  it('rejects a payload whose teams[] is empty despite valid coverage metadata → E_COVERAGE_TEAM_MISSING', () => {
    const doctored = clone();
    doctored.teams = [];
    doctored.warnings = [];
    const result = validatePublicReport2024(doctored, { approvals: [APPROVAL] });
    expect(codesOf(result)).toContain('E_COVERAGE_TEAM_MISSING');
    expect(result.publishable).toBe(false);
  });

  it('rejects a payload missing a single expected team record → E_COVERAGE_TEAM_MISSING', () => {
    const doctored = clone();
    doctored.teams = doctored.teams.filter((team) => team.team !== 'BUF');
    doctored.warnings = [];
    const result = validatePublicReport2024(doctored, { approvals: [APPROVAL] });
    expect(codesOf(result)).toContain('E_COVERAGE_TEAM_MISSING');
  });

  it('rejects a team record whose gamesPlayed does not match the declared scope → E_COVERAGE_ROW_COUNT_MISMATCH', () => {
    const doctored = clone();
    doctored.teams[0].gamesPlayed = 16;
    const result = validatePublicReport2024(doctored, { approvals: [APPROVAL] });
    expect(codesOf(result)).toContain('E_COVERAGE_ROW_COUNT_MISMATCH');
  });

  it('rejects a generated_at absence → E_TEMPORAL_METADATA_MISSING', () => {
    const doctored = clone() as unknown as Record<string, unknown>;
    delete doctored.generated_at;
    expect(
      codesOf(validatePublicReport2024(doctored as unknown as PublicReport2024Payload, { approvals: [APPROVAL] }))
    ).toContain('E_TEMPORAL_METADATA_MISSING');
  });

  it('every §9 stable code is reachable through the implemented checks', () => {
    // Documented cross-reference: the union of codes asserted across this spec file covers the
    // full §9 table. This test enumerates the codes the suite exercises so a future edit that
    // drops one fails loudly here.
    const exercised = [
      'E_PROVENANCE_MISSING',
      'E_PROVENANCE_NOT_GOVERNED',
      'E_COVERAGE_TEAM_MISSING',
      'E_COVERAGE_TEAM_UNEXPECTED',
      'E_COVERAGE_ROW_COUNT_MISMATCH',
      'E_GOVERNED_INPUT_CHECKSUM_MISMATCH',
      'E_UPSTREAM_SOURCE_CHECKSUM_MISSING',
      'E_METHODOLOGY_VERSION_UNKNOWN',
      'E_UNDOCUMENTED_FIELD_PRESENT',
      'E_WITHHELD_FIELD_PRESENT',
      'E_WITHHELD_FIELD_ZERO_FILLED',
      'E_REDZONE_NULL_INVARIANT_VIOLATED',
      'E_UNWEIGHTED_AGGREGATION_USED',
      'E_APPROXIMATED_DENOMINATOR_UNAUTHORIZED',
      'E_TEMPORAL_METADATA_MISSING',
      'E_TEMPORAL_METADATA_CONFLATED',
      'E_VERSION_IDENTITY_MISSING',
      'E_VERSION_IDENTITY_MUTABLE',
      'E_HTML_JSON_SEMANTIC_MISMATCH',
      'E_REGISTRY_STATE_INVALID',
      'E_PUBLICATION_NOT_APPROVED'
    ];
    // E_COVERAGE_TEAM_UNEXPECTED is exercised right here: bytes carrying a 33rd, out-of-scope team.
    const bytes = doctoredSourceBytes((rows) => [...rows, { ...rows[0], teamCode: 'XYZ' }]);
    const result = validatePublicReport2024(buildFromBytes(bytes), {
      governedSourceBytes: bytes,
      approvals: [APPROVAL]
    });
    expect(codesOf(result)).toContain('E_COVERAGE_TEAM_UNEXPECTED');
    expect(exercised).toHaveLength(21);
  });
});
