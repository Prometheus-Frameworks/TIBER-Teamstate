/**
 * Governed Forecast Run 2 input artifact emitter (Teamstate issue #66).
 *
 * This is the upstream **evidence packet** that TIBER-Forecast's value-binding readiness gate
 * (Forecast #81) waits for before it is allowed to bind real Teamstate values into the Run 2
 * candidate matrix. It is a read-only, report-oriented superset of the governed readiness boundary
 * ({@link buildTeamWeekRawV0GovernedReadiness}) that additionally records, in machine-readable form:
 *
 * - an explicit-marker governance posture (never inferred from path/name/build/validation/demand),
 * - a recorded forecast cutoff pinned to the 2024 input season (before the 2025 target season),
 * - the team-week row grain and the explicit join posture for later player-season binding,
 * - the Forecast-eligible input columns (null-aware), with pressure and fantasy splits excluded.
 *
 * It deliberately stays Teamstate-owned: it does NOT train, evaluate, score, predict, run Forecast
 * Run 2, bind values into Forecast rows, construct/impute pressure, or emit any fantasy product.
 * The `kind`/`artifact`/governance/readiness/pressure fields are kept byte-identical to the governed
 * readiness boundary so the existing Forecast input boundary continues to accept this artifact, while
 * the added `forecastCutoff` lets Forecast's gate answer "yes" to its recorded-cutoff requirement.
 */

import { loadTeamWeekRawV0Governed } from '../ingest/loadTeamWeekRawV0Governed.js';
import {
  buildTeamWeekRawV0GovernedReadiness,
  type TeamWeekRawV0GovernedReadinessReport
} from './teamWeekRawV0GovernedReadiness.js';
import {
  TEAM_WEEK_RAW_V0_FANTASY_FIELDS,
  type TeamWeekRawGovernedConsumption
} from '../adapters/teamWeekRawV0GovernedAdapter.js';
import {
  REAL_2024_CANDIDATE_COVERAGE_EXPECTATION
} from '../dryrun/teamWeekRawV0CandidateDryRun.js';
import type {
  ByeAwareCoverageExpectation,
  ByeAwareCoverageValidationResult
} from '../validation/teamWeekRawV0Coverage.js';

/** The Teamstate input season this artifact's forecast cutoff is pinned to. */
export const FORECAST_RUN2_INPUT_SEASON = 2024 as const;
/** The Forecast Run 2 target season (2024 input → 2025 target). Never a data source in Teamstate. */
export const FORECAST_RUN2_TARGET_SEASON = 2025 as const;
/**
 * The instant the 2025 Forecast Run 2 target season begins. NFL seasons kick off in early September,
 * so the target-season boundary is pinned to 2025-09-01T00:00:00Z. A recorded forecast cutoff as-of
 * must fall strictly before this instant to be a valid 2024-input → 2025-target cutoff.
 */
export const FORECAST_RUN2_TARGET_SEASON_START = `${FORECAST_RUN2_TARGET_SEASON}-09-01T00:00:00.000Z` as const;
/**
 * Canonical 2024 input-season forecast cutoff as-of: after the full 2024 season concludes (Super Bowl
 * LIX, Feb 2025) and strictly before the 2025 target season starts. Callers (CLI, sample export) pass
 * this deliberately as a real pre-target cutoff; the builder never derives an as-of from the source's
 * build/generated time. Provided as a documented default for callers, not a silent builder fallback.
 */
export const FORECAST_RUN2_DEFAULT_CUTOFF_AS_OF = '2025-03-01T00:00:00.000Z' as const;
/** Team-week grain primary keys Teamstate owns, in stable join order. */
export const TEAM_WEEK_GRAIN_KEYS = ['season', 'week', 'teamCode'] as const;
/**
 * The explicit join keys a downstream player-season binder must supply. Teamstate's `season`/`teamCode`
 * are documented here under their Forecast-side names so the two repos agree without renaming either.
 */
export const FORECAST_PLAYER_SEASON_JOIN_KEYS = [
  'player_input_season_team (team_2024)',
  'input_season'
] as const;

/**
 * Excerpt-scale bye-aware coverage expectation for the committed governed sample fixture (4 governed
 * rows: ATL/BUF/DET/KC, season 2024). Production emission over the real 544-row governed source uses
 * {@link REAL_2024_CANDIDATE_COVERAGE_EXPECTATION} instead — this only lets the small committed sample
 * report a valid, Forecast-consumable `ready_minimal_boundary` for exactly the rows it contains.
 */
export const EXCERPT_GOVERNED_COVERAGE_EXPECTATION: ByeAwareCoverageExpectation = {
  expectedTeams: ['ATL', 'BUF', 'DET', 'KC'],
  expectedWeeks: [1, 4, 9],
  expectedGamesPerTeam: 1,
  expectedSeason: FORECAST_RUN2_INPUT_SEASON
};

export interface ForecastRun2Cutoff {
  /** Recorded forecast cutoff input season; always the 2024 Teamstate input season. */
  inputSeason: typeof FORECAST_RUN2_INPUT_SEASON;
  /** The downstream Forecast target season this 2024 input feeds; never used as a Teamstate source. */
  targetSeason: typeof FORECAST_RUN2_TARGET_SEASON;
  /**
   * The forecast cutoff as-of: the pre-target-season time boundary the artifact claims for Forecast
   * Run 2 use. Validated strictly before {@link FORECAST_RUN2_TARGET_SEASON_START}. This is the cutoff
   * moment the artifact represents — never the source's build/generated time (see `sourceGeneratedAt`).
   */
  asOf: string;
  /** The source/export build (generated) timestamp, recorded for provenance only; never the cutoff. */
  sourceGeneratedAt: string | null;
  /** The target-season boundary the as-of was validated to fall strictly before. */
  targetSeasonStart: typeof FORECAST_RUN2_TARGET_SEASON_START;
  /**
   * Computed from validation: emission only succeeds (and this is `true`) when `asOf` is strictly
   * before `targetSeasonStart`; a non-pre-target as-of fails closed rather than being marked true.
   */
  cutoffBeforeTargetSeason: true;
  safeFor: 'forecast_run2_2024_input_to_2025_target';
}

export interface ForecastRun2WeekCoverage {
  /** Expected regular-season week window (e.g. Weeks 1-18). */
  window: readonly number[];
  expectedGamesPerTeam: number;
  expectedSeason: number;
  /** Bye-aware coverage result computed from the actual rows (never trusted from metadata). */
  coverage: ByeAwareCoverageValidationResult;
  isFullLeague: boolean;
}

export interface ForecastRun2FieldMapping {
  teamstateField: string;
  forecastField: string;
  note: string;
}

export interface ForecastRun2DownstreamBinding {
  teamstateRowGrain: 'team_week';
  teamWeekGrainKeys: readonly string[];
  /** Pinned false: Teamstate emits the evidence packet; it never performs the player-season bind. */
  bindsToForecastHere: false;
  /** Plain-language posture for how team-week aggregates later bind to player-season rows. */
  playerSeasonBinding: string;
  /** Forecast-side join keys a downstream binder must supply (documented mapping, not a rename). */
  joinKeysRequired: readonly string[];
  fieldMapping: ForecastRun2FieldMapping[];
}

export interface ForecastRun2FantasySplitPosture {
  status: 'absent_excluded_from_forecast_use';
  /** The eight fantasy split fields kept absent/excluded from Forecast input use. */
  fields: readonly string[];
  presentInForecastInputColumns: false;
  presentInTeamstateRows: false;
}

export interface TeamWeekRawV0ForecastRun2Artifact extends TeamWeekRawV0GovernedReadinessReport {
  /** Explicit marker that this readiness report is also the governed Forecast Run 2 input artifact. */
  forecastRun2Artifact: true;
  forecastConsumable: true;
  emittedBy: 'teamstate';
  targetSeason: typeof FORECAST_RUN2_TARGET_SEASON;
  forecastCutoff: ForecastRun2Cutoff;
  rowGrain: 'team_week';
  teamCount: number;
  weekCoverage: ForecastRun2WeekCoverage;
  downstreamBinding: ForecastRun2DownstreamBinding;
  /** Forecast-eligible Teamstate input columns (available + partial-null, null-aware). */
  forecastInputColumns: string[];
  /** Forecast-facing pressure posture: unavailable / insufficient_data / deferred / excluded. */
  pressureForecastPosture: 'unavailable_insufficient_data_deferred_excluded';
  fantasySplitPosture: ForecastRun2FantasySplitPosture;
  targetLeakageStatus: 'no_target_future_leakage_fields_emitted_as_input';
  forecastNotes: string[];
}

export interface BuildForecastRun2ArtifactOptions {
  /**
   * The forecast cutoff as-of: the pre-target-season time boundary the artifact claims for Forecast
   * Run 2 use. Required — the builder never defaults it to the source's build/`generatedAt` time. Must
   * be a parseable, timezone-explicit timestamp (ending in `Z` or a numeric `±HH:MM` offset) strictly
   * before {@link FORECAST_RUN2_TARGET_SEASON_START}; offset-less values fail closed. Callers may pass
   * {@link FORECAST_RUN2_DEFAULT_CUTOFF_AS_OF} as the canonical 2024 input-season cutoff.
   */
  asOf?: string;
  /** Bye-aware coverage expectation to validate against. Defaults to the real 2024 544-row shape. */
  coverageExpectation?: ByeAwareCoverageExpectation;
}

const FANTASY_FIELD_SET = new Set<string>(TEAM_WEEK_RAW_V0_FANTASY_FIELDS);
// Substrings that would indicate a target/future/leakage column leaking into Forecast inputs.
const TARGET_LEAKAGE_MARKERS = ['fantasy', 'pressure', 'target', 'label', '2025', 'next', 'future'];

const assertNoLeakage = (columns: readonly string[]): void => {
  for (const column of columns) {
    if (FANTASY_FIELD_SET.has(column)) {
      throw new Error(`Forecast Run 2 artifact refuses fantasy split column ${column} in forecastInputColumns.`);
    }
    if (column === 'pressureRateAllowed') {
      throw new Error('Forecast Run 2 artifact refuses pressureRateAllowed in forecastInputColumns; pressure stays deferred/excluded.');
    }
    const lowered = column.toLowerCase();
    const marker = TARGET_LEAKAGE_MARKERS.find((needle) => lowered.includes(needle));
    if (marker !== undefined) {
      throw new Error(`Forecast Run 2 artifact refuses target/future/leakage column ${column} (matched "${marker}").`);
    }
  }
};

// A cutoff as-of must carry an explicit timezone marker (`Z` or a numeric `±HH:MM` offset) so it
// denotes a deterministic instant. Offset-less ISO strings are rejected: `Date.parse` would interpret
// them in the process-local timezone, which could slip a target-boundary string past the pre-target
// guard in a positive-offset environment.
const TIMEZONE_EXPLICIT_ISO_AS_OF = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Parse a forecast cutoff as-of into a deterministic epoch-ms instant, failing closed on a malformed
 * timestamp or one without an explicit timezone marker (`Z` or a numeric `±HH:MM` offset). Requiring
 * an explicit timezone keeps the leakage-boundary comparison independent of the process-local timezone.
 */
export const parseTimezoneExplicitAsOf = (asOf: string): number => {
  const asOfTime = Date.parse(asOf);
  if (Number.isNaN(asOfTime)) {
    throw new Error(`Forecast Run 2 artifact refuses a malformed forecast cutoff as-of "${asOf}"; expected a parseable ISO-8601 timestamp.`);
  }
  if (!TIMEZONE_EXPLICIT_ISO_AS_OF.test(asOf)) {
    throw new Error(
      `Forecast Run 2 artifact refuses a timezone-ambiguous forecast cutoff as-of "${asOf}"; it must include an explicit timezone marker (Z or a numeric offset such as +00:00 / -05:00) so the leakage boundary is deterministic and independent of the process-local timezone.`
    );
  }
  return asOfTime;
};

/**
 * Emit the governed Forecast Run 2 input artifact from an already-loaded governed consumption.
 * Pure (no I/O). Fails closed when the recorded cutoff cannot be honestly established (non-2024 source
 * season; a missing, malformed, timezone-ambiguous, or target-season/future-looking as-of) or when a
 * pressure / fantasy / target-leakage column would reach Forecast. The forecast cutoff as-of must be
 * supplied explicitly as a real, timezone-explicit pre-target-season boundary; the source's
 * build/`generatedAt` time is never used as the cutoff.
 */
export const buildTeamWeekRawV0ForecastRun2Artifact = (
  consumption: TeamWeekRawGovernedConsumption,
  options: BuildForecastRun2ArtifactOptions = {}
): TeamWeekRawV0ForecastRun2Artifact => {
  if (consumption.upstream.season !== null && consumption.upstream.season !== FORECAST_RUN2_INPUT_SEASON) {
    throw new Error(
      `Forecast Run 2 artifact refuses a ${consumption.upstream.season} governed source: the recorded cutoff is pinned to input season ${FORECAST_RUN2_INPUT_SEASON}.`
    );
  }

  // The forecast cutoff as-of is the pre-target-season time boundary the artifact claims — never the
  // source's build/generatedAt time. It must be supplied explicitly (callers may use the canonical
  // FORECAST_RUN2_DEFAULT_CUTOFF_AS_OF); generatedAt is recorded separately for provenance only.
  const asOf = options.asOf;
  if (asOf === undefined || asOf.trim().length === 0) {
    throw new Error(
      'Forecast Run 2 artifact requires an explicit pre-target forecast cutoff as-of (options.asOf); the source generatedAt/build time is never used as the cutoff. Pass FORECAST_RUN2_DEFAULT_CUTOFF_AS_OF or another pre-target timestamp.'
    );
  }
  // Parse as a deterministic instant: malformed or timezone-ambiguous (offset-less) as-of values fail
  // closed here, so the comparison below never depends on the process-local timezone.
  const asOfTime = parseTimezoneExplicitAsOf(asOf);
  // cutoffBeforeTargetSeason is computed from this validation, not hardcoded: a non-pre-target as-of
  // fails closed rather than being silently marked safe.
  const cutoffBeforeTargetSeason = asOfTime < parseTimezoneExplicitAsOf(FORECAST_RUN2_TARGET_SEASON_START);
  if (!cutoffBeforeTargetSeason) {
    throw new Error(
      `Forecast Run 2 artifact refuses a forecast cutoff as-of "${asOf}" on/after the ${FORECAST_RUN2_TARGET_SEASON} target season start (${FORECAST_RUN2_TARGET_SEASON_START}); the as-of must be a real pre-target cutoff, not a target-season/future-looking or build timestamp.`
    );
  }

  const expectation = options.coverageExpectation ?? REAL_2024_CANDIDATE_COVERAGE_EXPECTATION;
  const readiness = buildTeamWeekRawV0GovernedReadiness(consumption, expectation);

  // Forecast-eligible columns are the available + partial-null metric columns, null-aware. Pressure
  // is deferred (never here) and fantasy splits are stripped upstream; assert both before emitting.
  const forecastInputColumns = [...readiness.availableFields, ...readiness.partialNullFields].sort();
  assertNoLeakage(forecastInputColumns);

  const fantasySplitPosture: ForecastRun2FantasySplitPosture = {
    status: 'absent_excluded_from_forecast_use',
    fields: TEAM_WEEK_RAW_V0_FANTASY_FIELDS,
    presentInForecastInputColumns: false,
    presentInTeamstateRows: false
  };

  const forecastCutoff: ForecastRun2Cutoff = {
    inputSeason: FORECAST_RUN2_INPUT_SEASON,
    targetSeason: FORECAST_RUN2_TARGET_SEASON,
    asOf,
    sourceGeneratedAt: consumption.upstream.generatedAt,
    targetSeasonStart: FORECAST_RUN2_TARGET_SEASON_START,
    cutoffBeforeTargetSeason,
    safeFor: 'forecast_run2_2024_input_to_2025_target'
  };

  const downstreamBinding: ForecastRun2DownstreamBinding = {
    teamstateRowGrain: 'team_week',
    teamWeekGrainKeys: TEAM_WEEK_GRAIN_KEYS,
    bindsToForecastHere: false,
    playerSeasonBinding:
      'Team-week aggregates may later bind to Forecast player-season rows by the player\'s input-season team and the input season; Teamstate does not perform that bind here.',
    joinKeysRequired: FORECAST_PLAYER_SEASON_JOIN_KEYS,
    fieldMapping: [
      { teamstateField: 'season', forecastField: 'input_season', note: 'Teamstate input season binds to the Forecast input season.' },
      { teamstateField: 'teamCode', forecastField: 'player_input_season_team (team_2024)', note: 'Teamstate team code binds to the player\'s input-season team.' },
      { teamstateField: 'week', forecastField: '(aggregated away)', note: 'Team-week rows are aggregated to team-season before player-season binding; week is not a Forecast join key.' }
    ]
  };

  const weekCoverage: ForecastRun2WeekCoverage = {
    window: expectation.expectedWeeks,
    expectedGamesPerTeam: expectation.expectedGamesPerTeam,
    expectedSeason: expectation.expectedSeason,
    coverage: readiness.coverage,
    isFullLeague: readiness.coverage.isFullLeague
  };

  return {
    ...readiness,
    forecastRun2Artifact: true,
    forecastConsumable: true,
    emittedBy: 'teamstate',
    targetSeason: FORECAST_RUN2_TARGET_SEASON,
    forecastCutoff,
    rowGrain: 'team_week',
    teamCount: readiness.coverage.teamCount,
    weekCoverage,
    downstreamBinding,
    forecastInputColumns,
    pressureForecastPosture: 'unavailable_insufficient_data_deferred_excluded',
    fantasySplitPosture,
    targetLeakageStatus: 'no_target_future_leakage_fields_emitted_as_input',
    forecastNotes: [
      'This is the upstream Teamstate evidence packet Forecast #81 waits for before value binding is allowed; it is not Forecast Run 2, training, evaluation, scoring, ranking, or fantasy advice.',
      'Governance is explicit-marker only and is never inferred from file path, file name, validation success, build success, or downstream demand.',
      'forecastCutoff.inputSeason is the recorded 2024 cutoff; it stays strictly before the 2025 target season so no target-season Teamstate values can enter Forecast inputs.',
      'forecastCutoff.asOf is the pre-target-season cutoff boundary the artifact claims; it must be timezone-explicit (Z or a numeric offset) and is validated as a deterministic instant strictly before forecastCutoff.targetSeasonStart. It is distinct from forecastCutoff.sourceGeneratedAt, which is the source/export build time and is never used as the semantic cutoff.',
      'Row grain is team-week; downstream player-season binding uses the player input-season team and input season (Teamstate season/teamCode → Forecast input_season/player_input_season_team).',
      'pressureRateAllowed remains unavailable/insufficient_data/deferred/excluded; no numeric pressure feature is emitted and pressure is never imputed, backfilled, estimated, or zero-filled.',
      'Fantasy split fields stay absent/excluded from Forecast input use; partial-null columns (e.g. redZoneTdRate) remain null-aware and are never zero-filled.'
    ]
  };
};

/** Read-only convenience wrapper: load a governed artifact file and emit the Forecast Run 2 artifact. */
export const buildTeamWeekRawV0ForecastRun2ArtifactFile = (
  filePath: string,
  options?: BuildForecastRun2ArtifactOptions
): TeamWeekRawV0ForecastRun2Artifact =>
  buildTeamWeekRawV0ForecastRun2Artifact(loadTeamWeekRawV0Governed(filePath), options);
