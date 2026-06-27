/**
 * Null-aware, candidate-only **rehearsal** report for the real 2024 TIBER-Data `team_week_raw_v0`
 * candidate lane (issue #60, parent #50). This is the bounded "Outcome 2" rehearsal from the #55
 * feasibility review: prove whether a candidate-only derived Teamstate output can be rehearsed
 * honestly *without* using the production scoring path and *without* laundering nulls into zeros.
 *
 * It is deliberately NOT a transform into movement/forecast artifacts. It produces a structured
 * readiness report that, per candidate metric field, says how many rows carry a finite value vs a
 * null, and classifies each field as `available`, `partial_nulls`, or `deferred_insufficient_data`.
 * Pressure is pinned `deferred_insufficient_data` by the #55 posture regardless of row contents, and
 * nothing here ever coerces `null` / `undefined` / `NaN` / non-finite to `0`.
 *
 * Boundary guarantees (all asserted by tests):
 * - Reuses the #58/#59 dry-run coverage lane (`dryRunTeamWeekRawV0CandidateCoverage`) and embeds its
 *   bye-aware coverage result; rehearsal is withheld (fails closed as a report) when coverage is
 *   invalid, never fabricated.
 * - Echoes the artifact's declared `partial_real_data` / `ungoverned` status and preserves the
 *   upstream provenance / governance / deferred-field metadata. Coverage success never upgrades
 *   governance or promotion.
 * - Pins `promoted: false` / `governed: false` and marks the report `rehearsalOnly` /
 *   `productionReady: false` by name and metadata.
 * - Imports nothing from `src/score/` — there is no scoring, ranking, advice, Product, or PPM output.
 *   (A test reads this module's source and asserts the absence of any `score` import.)
 */

import {
  dryRunTeamWeekRawV0CandidateCoverage,
  type TeamWeekRawV0CandidateDryRunReport
} from '../dryrun/teamWeekRawV0CandidateDryRun.js';
import { loadTeamWeekRawV0Candidate } from '../ingest/loadTeamWeekRawV0Candidate.js';
import {
  type TeamWeekRawCandidateConsumption,
  type TeamWeekRawCandidateRow
} from '../adapters/teamWeekRawV0CandidateAdapter.js';
import type { ByeAwareCoverageExpectation } from '../validation/teamWeekRawV0Coverage.js';
import { REAL_2024_CANDIDATE_COVERAGE_EXPECTATION } from '../dryrun/teamWeekRawV0CandidateDryRun.js';

/**
 * Candidate metric fields inspected for readiness. This is the null-bearing surface of a candidate
 * row (everything except the `season`/`week`/`teamCode`/`opponentCode` identity fields). Listed
 * explicitly rather than derived from a row so the rehearsal surface is stable and reviewable.
 */
export const CANDIDATE_METRIC_FIELDS = [
  'pointsFor',
  'pointsAgainst',
  'offensivePlays',
  'neutralPlays',
  'secondsPerPlay',
  'passRate',
  'neutralPassRate',
  'rushRate',
  'epaPerPlay',
  'passEpaPerPlay',
  'rushEpaPerPlay',
  'successRate',
  'explosivePlayRate',
  'drives',
  'pointsPerDrive',
  'redZoneTrips',
  'redZoneTdRate',
  'sacksAllowed',
  'pressureRateAllowed',
  'turnovers',
  'fantasyPointsForQB',
  'fantasyPointsForRB',
  'fantasyPointsForWR',
  'fantasyPointsForTE',
  'fantasyPointsAllowedQB',
  'fantasyPointsAllowedRB',
  'fantasyPointsAllowedWR',
  'fantasyPointsAllowedTE'
] as const satisfies ReadonlyArray<keyof TeamWeekRawCandidateRow>;

/**
 * Pressure-derived fields held at `insufficient_data` by the #55 posture until sourced upstream.
 * These are classified `deferred_insufficient_data` regardless of row contents — pressure is never
 * derived, backfilled, estimated, or zero-filled in this lane.
 */
export const PRESSURE_DEFERRED_FIELDS: ReadonlySet<string> = new Set(['pressureRateAllowed']);

export type CandidateFieldReadinessStatus = 'available' | 'partial_nulls' | 'deferred_insufficient_data';

export interface CandidateFieldReadiness {
  field: string;
  /** Rows whose value is a finite number. Never coerced; non-finite/null values are not counted here. */
  finiteCount: number;
  /** Rows whose value is `null` or otherwise non-finite. Reported honestly, never replaced with 0. */
  nullCount: number;
  status: CandidateFieldReadinessStatus;
}

export interface TeamWeekRawV0CandidateRehearsalReport {
  /** Non-production label by name: this is a rehearsal, not a governed or production artifact. */
  kind: 'team_week_raw_v0_candidate_rehearsal';
  /** Pinned `true`: this object is rehearsal-only and must never be consumed as production truth. */
  rehearsalOnly: true;
  /** Pinned `false`: never production-ready. */
  productionReady: false;
  /** Opaque traceability label from the loaded artifact; never used for acceptance/governance. */
  sourceArtifactPath: string;
  /** Echoed from upstream metadata (e.g. `partial_real_data`); never upgraded here. */
  provenanceStatus: string;
  /** Echoed from upstream metadata (e.g. `ungoverned`); never upgraded here. */
  governanceStatus: string;
  /** Echoed from upstream metadata (e.g. `not_set`). */
  governanceSource: string;
  /** Pinned `false`: rehearsal never promotes. */
  promoted: false;
  /** Pinned `false`: rehearsal never governs. */
  governed: false;
  rowCount: number;
  /** Deferred-null fields declared by upstream metadata, preserved verbatim. */
  deferredFields: string[];
  /** #55 posture: pressure stays insufficient_data until sourced upstream. Fixed label, never read. */
  pressurePosture: 'insufficient_data';
  /** Embedded bye-aware coverage result from the reused #58/#59 dry-run lane. */
  coverage: TeamWeekRawV0CandidateDryRunReport['coverage'];
  /**
   * `rehearsed` when coverage is valid; `withheld_invalid_coverage` when it is not — in the latter
   * case the report still returns (fails closed) but signals that no derivation should be attempted.
   */
  rehearsalStatus: 'rehearsed' | 'withheld_invalid_coverage';
  /** Per-field null/finite readiness; honest inspection, computed regardless of coverage validity. */
  fieldReadiness: CandidateFieldReadiness[];
  /** Fields with a finite value on every row (candidate-derivable once governed upstream). */
  availableFields: string[];
  /** Fields deferred / insufficient (declared-deferred or pressure-posture). */
  deferredInsufficientFields: string[];
  /** Fields with a finite value on some but not all rows (e.g. `redZoneTdRate` on zero-trip rows). */
  partialNullFields: string[];
  /** Human-readable rehearsal notes (why pressure is insufficient, coverage outcome, etc.). */
  notes: string[];
}

const classifyField = (
  field: string,
  rows: readonly TeamWeekRawCandidateRow[],
  declaredDeferred: ReadonlySet<string>
): CandidateFieldReadiness => {
  let finiteCount = 0;
  for (const row of rows) {
    const value = (row as unknown as Record<string, unknown>)[field];
    // Count finite numbers only. `null`, `undefined`, `NaN`, and ±Infinity all fall through to
    // nullCount — they are never coerced to 0.
    if (typeof value === 'number' && Number.isFinite(value)) {
      finiteCount += 1;
    }
  }
  const nullCount = rows.length - finiteCount;

  let status: CandidateFieldReadinessStatus;
  if (PRESSURE_DEFERRED_FIELDS.has(field) || declaredDeferred.has(field)) {
    status = 'deferred_insufficient_data';
  } else if (rows.length > 0 && nullCount === 0) {
    status = 'available';
  } else {
    status = 'partial_nulls';
  }

  return { field, finiteCount, nullCount, status };
};

/**
 * Rehearse a candidate-only Teamstate readiness report from an already-loaded candidate consumption.
 * Pure (no I/O). Reuses the dry-run coverage lane, preserves candidate status and nulls, and never
 * touches the production scoring path.
 */
export const rehearseTeamWeekRawV0Candidate = (
  consumption: TeamWeekRawCandidateConsumption,
  expectation: ByeAwareCoverageExpectation = REAL_2024_CANDIDATE_COVERAGE_EXPECTATION
): TeamWeekRawV0CandidateRehearsalReport => {
  const dryRun = dryRunTeamWeekRawV0CandidateCoverage(consumption, expectation);
  const declaredDeferred = new Set(consumption.upstream.deferredFields);

  const fieldReadiness = CANDIDATE_METRIC_FIELDS.map((field) =>
    classifyField(field, consumption.rows, declaredDeferred)
  );

  const availableFields = fieldReadiness.filter((f) => f.status === 'available').map((f) => f.field);
  const deferredInsufficientFields = fieldReadiness
    .filter((f) => f.status === 'deferred_insufficient_data')
    .map((f) => f.field);
  const partialNullFields = fieldReadiness
    .filter((f) => f.status === 'partial_nulls')
    .map((f) => f.field);

  const rehearsalStatus = dryRun.coverage.valid ? 'rehearsed' : 'withheld_invalid_coverage';

  const notes: string[] = [
    'Rehearsal/report only: not governed, not promoted, not production truth.',
    'Pressure (pressureRateAllowed and any pressure-derived feature) stays insufficient_data until sourced upstream (#55); never backfilled, estimated, or zero-filled.',
    'Null metric values are reported honestly and never coerced to 0.'
  ];
  if (rehearsalStatus === 'withheld_invalid_coverage') {
    notes.push(
      `Coverage is invalid (${dryRun.coverage.errors.length} error(s)); rehearsal withheld — no candidate derivation should be attempted from this report.`
    );
  }

  return {
    kind: 'team_week_raw_v0_candidate_rehearsal',
    rehearsalOnly: true,
    productionReady: false,
    sourceArtifactPath: dryRun.sourceArtifactPath,
    provenanceStatus: dryRun.provenanceStatus,
    governanceStatus: dryRun.governanceStatus,
    governanceSource: dryRun.governanceSource,
    promoted: false,
    governed: false,
    rowCount: dryRun.rowCount,
    deferredFields: dryRun.deferredFields,
    pressurePosture: 'insufficient_data',
    coverage: dryRun.coverage,
    rehearsalStatus,
    fieldReadiness,
    availableFields,
    deferredInsufficientFields,
    partialNullFields,
    notes
  };
};

/**
 * Read-only convenience wrapper: load a candidate artifact file via the existing candidate loader
 * (which gates on declared provenance/governance and preserves nulls) and produce the rehearsal
 * report. The file is never written to or mutated.
 */
export const rehearseTeamWeekRawV0CandidateFile = (
  filePath: string,
  expectation: ByeAwareCoverageExpectation = REAL_2024_CANDIDATE_COVERAGE_EXPECTATION
): TeamWeekRawV0CandidateRehearsalReport =>
  rehearseTeamWeekRawV0Candidate(loadTeamWeekRawV0Candidate(filePath), expectation);
