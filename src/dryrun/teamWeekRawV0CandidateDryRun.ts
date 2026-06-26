/**
 * Dry-run coverage check for the real 2024 TIBER-Data `team_week_raw_v0` candidate lane (issue #58).
 *
 * This is the smallest Teamstate-side step that connects the read-only candidate intake path
 * (`adaptTeamWeekRawV0Candidate` / `loadTeamWeekRawV0Candidate`) to the bye-aware coverage validator
 * added in #56/#57. Its only job is to *inspect* the candidate's team/week coverage and echo its
 * declared candidate status. It deliberately does NOT:
 *
 * - promote the artifact or mark anything governed (the report pins `promoted` / `governed` to
 *   `false` and echoes the artifact's declared `ungoverned` / `partial_real_data` status verbatim);
 * - infer governance from path, filename, coverage success, or downstream usefulness;
 * - synthesize bye-week rows or fabricate any missing field (it reads only `teamCode`/`week`/`season`
 *   for the coverage check and never touches metric values);
 * - route candidate rows through `src/score/`, the movement/forecast pipeline, or any PPM/Product/
 *   ranking/advice output;
 * - mutate the TIBER-Data artifact or change its contract.
 *
 * Pressure stays `insufficient_data` (#55 posture): the report carries that posture as an explicit,
 * fixed label rather than ever reading a pressure value, since pressure is deferred-null upstream.
 *
 * On the fantasy-point fields specifically: this lane runs through the candidate adapter, which
 * already accepts the eight deferred-null `fantasyPoints*` fields as `null`. So the
 * finite-number requirement that the non-candidate `teamWeekRawV0Adapter` imposes is simply not on
 * this path — the narrow real-lane relaxation already lives in the separate candidate adapter, and
 * no fantasy field is added to (or required of) the team-state source contract here.
 */

import {
  validateTeamWeekByeAwareCoverage,
  type ByeAwareCoverageExpectation,
  type ByeAwareCoverageValidationResult,
  type TeamWeekCoverageRow
} from '../validation/teamWeekRawV0Coverage.js';
import {
  loadTeamWeekRawV0Candidate
} from '../ingest/loadTeamWeekRawV0Candidate.js';
import {
  type TeamWeekRawCandidateConsumption,
  type TeamWeekRawCandidateRow
} from '../adapters/teamWeekRawV0CandidateAdapter.js';
import { NFL_TEAM_CODES_32 } from '../fixtures/teamWeekRawV0FullLeagueScaffold.js';

/** The real 2024 regular-season week window: Weeks 1-18 (a per-team schedule has one bye inside it). */
export const REGULAR_SEASON_WEEKS_1_TO_18: readonly number[] = Array.from({ length: 18 }, (_, i) => i + 1);

/**
 * The expected bye-aware coverage shape for the real 2024 candidate: 32 teams, Weeks 1-18, exactly
 * 17 game rows per team (one bye each), season 2024 → 544 total rows. This is the only coverage mode
 * invoked on the real candidate lane; the dense-grid scaffold validator is never used here and is
 * unchanged by this module.
 */
export const REAL_2024_CANDIDATE_COVERAGE_EXPECTATION: ByeAwareCoverageExpectation = {
  expectedTeams: NFL_TEAM_CODES_32,
  expectedWeeks: REGULAR_SEASON_WEEKS_1_TO_18,
  expectedGamesPerTeam: 17,
  expectedSeason: 2024
};

export interface TeamWeekRawV0CandidateDryRunReport {
  /** Opaque traceability label carried through from the loaded artifact; never used for acceptance. */
  sourceArtifactPath: string;
  /** Echoed from the artifact's declared metadata (e.g. `partial_real_data`); never upgraded here. */
  provenanceStatus: string;
  /** Echoed from the artifact's declared metadata (e.g. `ungoverned`); never upgraded here. */
  governanceStatus: string;
  /** Echoed from the artifact's declared metadata (e.g. `not_set`). */
  governanceSource: string;
  /** Pinned `false`: this dry-run never promotes the candidate. */
  promoted: false;
  /** Pinned `false`: this dry-run never marks anything governed. */
  governed: false;
  /** Number of candidate rows inspected (`consumption.rows.length`). */
  rowCount: number;
  /** Deferred-null fields echoed from upstream metadata (e.g. `pressureRateAllowed`, fantasy fields). */
  deferredFields: string[];
  /** #55 posture: pressure stays insufficient_data until sourced upstream. Fixed label, never read. */
  pressurePosture: 'insufficient_data';
  /** Result of the explicitly-invoked bye-aware coverage validator (never the dense-grid validator). */
  coverage: ByeAwareCoverageValidationResult;
}

/** Map a null-preserving candidate row to the minimal `(team_code, week, season)` coverage shape. */
const toCoverageRow = (row: TeamWeekRawCandidateRow): TeamWeekCoverageRow => ({
  team_code: row.teamCode,
  week: row.week,
  season: row.season
});

/**
 * Run the bye-aware coverage dry-run over an already-loaded candidate consumption. Pure (no I/O):
 * it validates coverage and echoes the artifact's declared candidate status, pinning promotion and
 * governance to `false`. It never throws on a coverage gap — coverage problems are reported in
 * `coverage.errors` / `coverage.valid` (fail-closed reporting), not raised.
 */
export const dryRunTeamWeekRawV0CandidateCoverage = (
  consumption: TeamWeekRawCandidateConsumption,
  expectation: ByeAwareCoverageExpectation = REAL_2024_CANDIDATE_COVERAGE_EXPECTATION
): TeamWeekRawV0CandidateDryRunReport => {
  const coverageRows = consumption.rows.map(toCoverageRow);
  const coverage = validateTeamWeekByeAwareCoverage(coverageRows, expectation);

  return {
    sourceArtifactPath: consumption.upstream.sourceArtifactPath,
    provenanceStatus: consumption.upstream.provenanceStatus,
    governanceStatus: consumption.upstream.governanceStatus,
    governanceSource: consumption.upstream.governanceSource,
    promoted: false,
    governed: false,
    rowCount: consumption.rows.length,
    deferredFields: consumption.upstream.deferredFields,
    pressurePosture: 'insufficient_data',
    coverage
  };
};

/**
 * Read-only convenience wrapper: load a candidate artifact file via the existing candidate loader
 * (which gates on declared provenance/governance and preserves null fields) and run the dry-run
 * coverage check. The file is never written to or mutated.
 */
export const dryRunTeamWeekRawV0CandidateFile = (
  filePath: string,
  expectation: ByeAwareCoverageExpectation = REAL_2024_CANDIDATE_COVERAGE_EXPECTATION
): TeamWeekRawV0CandidateDryRunReport =>
  dryRunTeamWeekRawV0CandidateCoverage(loadTeamWeekRawV0Candidate(filePath), expectation);
