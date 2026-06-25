import type {
  TeamEnvironmentMovementArtifactV1,
  TeamEnvironmentMovementTeamV1
} from '../contracts/teamEnvironmentMovementV1.js';
import {
  TEAM_ENVIRONMENT_FORECAST_FEATURES_V1_CONTRACT,
  type ForecastFeatureCoverageStatus,
  type ForecastGovernanceSource,
  type ForecastGovernanceStatus,
  type TeamEnvironmentForecastFeatureDefinitionV1,
  type TeamEnvironmentForecastFeatureTeamV1,
  type TeamEnvironmentForecastFeatureValuesV1,
  type TeamEnvironmentForecastFeaturesArtifactV1
} from '../contracts/teamEnvironmentForecastFeaturesV1.js';

/**
 * Minimal, deterministic `team_environment_movement_v1` -> `team_environment_forecast_features_v1`
 * builder (issue #48).
 *
 * It is a **shape bridge**, not a data producer: it re-expresses the movement artifact's already
 * team-state-only signals in the PPM-facing forecast-features envelope so the #43 contract gate can
 * be exercised at full-league width. It introduces no new football values of its own:
 *
 * - numeric features  <- the movement artifact's most-recent pre-cutoff window (`lateWindow`)
 *   team-state averages (`pointsPerDrive` -> `points_per_drive`, ... `volatilityScore` ->
 *   `volatility_score`). Whatever the movement builder computed (for the #47 scaffold: uniform
 *   neutral placeholders) flows through unchanged.
 * - directional features <- the movement labels (`offenseDirection` -> `offense_direction`, ...).
 *   The movement direction vocabularies are a subset of the forecast vocabularies, so this is a
 *   safe pass-through; nothing is fabricated.
 * - tier features <- explicit `unknown`. Profile tiers are NOT derived here (no safe, honest
 *   fixture-compatible mapping), so they stay an explicit "no signal", never invented.
 *
 * Rows carry `confidence: 0` and a scaffold warning when the source is a fixture/scaffold; the
 * caller sets governance (default `fixture` / `explicit_marker`). This builder does not read or
 * write files, wire PPM, or change model behavior.
 */

/** Canonical v1 feature definitions, kept in lockstep with the contract's feature names/types. */
const FEATURE_DEFINITIONS: TeamEnvironmentForecastFeatureDefinitionV1[] = [
  { name: 'points_per_drive', type: 'number', description: 'Pre-cutoff team points scored per offensive drive.', allowedInModel: true, allowedInPosthocExplanation: true },
  { name: 'epa_per_play', type: 'number', description: 'Pre-cutoff team offensive EPA per play.', allowedInModel: true, allowedInPosthocExplanation: true },
  { name: 'success_rate', type: 'number', description: 'Pre-cutoff team offensive success rate.', allowedInModel: true, allowedInPosthocExplanation: true },
  { name: 'explosive_play_rate', type: 'number', description: 'Pre-cutoff team explosive-play rate.', allowedInModel: true, allowedInPosthocExplanation: true },
  { name: 'pressure_rate_allowed', type: 'number', description: 'Pre-cutoff rate of pressures allowed by the team offense.', allowedInModel: true, allowedInPosthocExplanation: true },
  { name: 'seconds_per_play', type: 'number', description: 'Pre-cutoff team pace, in seconds per offensive play.', allowedInModel: true, allowedInPosthocExplanation: true },
  { name: 'neutral_pass_rate', type: 'number', description: 'Pre-cutoff team neutral-script pass rate.', allowedInModel: true, allowedInPosthocExplanation: true },
  { name: 'volatility_score', type: 'number', description: 'Pre-cutoff Teamstate stability/volatility score (team-state metric, not a fantasy output).', allowedInModel: true, allowedInPosthocExplanation: true },
  { name: 'offense_direction', type: 'direction', description: "Directional change in the team's offensive environment across the pre-cutoff window.", allowedInModel: true, allowedInPosthocExplanation: true },
  { name: 'pass_environment_direction', type: 'direction', description: "Directional change in the team's pass-script lean across the pre-cutoff window.", allowedInModel: true, allowedInPosthocExplanation: true },
  { name: 'pace_direction', type: 'direction', description: "Directional change in the team's pace across the pre-cutoff window.", allowedInModel: true, allowedInPosthocExplanation: true },
  { name: 'pressure_direction', type: 'direction', description: 'Directional change in pressure allowed by the team offense across the pre-cutoff window.', allowedInModel: true, allowedInPosthocExplanation: true },
  { name: 'volatility_direction', type: 'direction', description: "Directional change in the team's volatility across the pre-cutoff window.", allowedInModel: true, allowedInPosthocExplanation: true },
  { name: 'offense_tier', type: 'tier', description: 'Candidate categorical offensive-environment tier (from team_environment_profiles_v0).', allowedInModel: false, allowedInPosthocExplanation: true },
  { name: 'pass_environment_tier', type: 'tier', description: 'Candidate categorical pass-environment tier (from team_environment_profiles_v0).', allowedInModel: false, allowedInPosthocExplanation: true },
  { name: 'pace_tier', type: 'tier', description: 'Candidate categorical pace tier (from team_environment_profiles_v0).', allowedInModel: false, allowedInPosthocExplanation: true },
  { name: 'volatility_tier', type: 'tier', description: 'Candidate categorical volatility tier (from team_environment_profiles_v0).', allowedInModel: false, allowedInPosthocExplanation: true }
];

export interface ForecastFeaturesGovernanceInput {
  governanceStatus: ForecastGovernanceStatus;
  governanceSource: ForecastGovernanceSource;
  promotionNotes?: string[];
}

export interface BuildForecastFeaturesOptions {
  /** ISO timestamp; mirrored to top-level and governance `generatedAt`. */
  generatedAt: string;
  /** Forecast cutoff; no fact at/after this instant may inform the features. */
  cutoffAt: string;
  /** Season the observed features describe (e.g. 2024). */
  featureSeason: number;
  /** Season PPM forecasts into (e.g. 2025). Carried for join/audit only. */
  targetSeason: number;
  /** Expected league size; defaults to 32 (or `expectedTeams.length` when provided). */
  expectedTeamCount?: number;
  /**
   * Canonical expected team set for the feature season. When provided, the builder fails closed on
   * any team outside this set, and full-league coverage is derived against it.
   */
  expectedTeams?: readonly string[];
  /** Auditable lineage refs attached to every row. */
  sourceDatasetRefs?: string[];
  /** Per-row coverage status; defaults to `partial` (scaffold / weeks-subset). */
  featureCoverageStatus?: ForecastFeatureCoverageStatus;
  /** Per-row producer confidence; defaults to 0 (placeholder / non-source-backed). */
  confidence?: number;
  /** Per-row warnings appended to each team row. */
  rowWarnings?: string[];
  /** Dataset governance; defaults to fixture / explicit_marker. */
  governance?: ForecastFeaturesGovernanceInput;
}

const toFeatureValues = (team: TeamEnvironmentMovementTeamV1): TeamEnvironmentForecastFeatureValuesV1 => {
  const averages = team.lateWindow.averages;
  return {
    points_per_drive: averages.pointsPerDrive,
    epa_per_play: averages.epaPerPlay,
    success_rate: averages.successRate,
    explosive_play_rate: averages.explosivePlayRate,
    pressure_rate_allowed: averages.pressureRateAllowed,
    seconds_per_play: averages.secondsPerPlay,
    neutral_pass_rate: averages.neutralPassRate,
    volatility_score: averages.volatilityScore,
    offense_direction: team.movement.offenseDirection,
    pass_environment_direction: team.movement.passEnvironmentDirection,
    pace_direction: team.movement.paceDirection,
    pressure_direction: team.movement.pressureDirection,
    volatility_direction: team.movement.volatilityDirection,
    // Profile tiers are not derived in this bridge — explicit "no signal", never invented.
    offense_tier: 'unknown',
    pass_environment_tier: 'unknown',
    pace_tier: 'unknown',
    volatility_tier: 'unknown'
  };
};

/**
 * Build a `team_environment_forecast_features_v1` artifact from a `team_environment_movement_v1`
 * artifact. Fails closed on cross-season rows (leakage guard), duplicate teams, and — when
 * `expectedTeams` is given — unexpected teams, so coverage reflects a clean one-row-per-team set.
 * Output teams are sorted deterministically by `teamId` then `teamAbbr`. Coverage is derived from
 * the actual rows (weeks from the union of `weeksCovered`); `isFullLeague` is true only when the
 * (now-unique) team count equals `expectedTeamCount`.
 */
export function buildTeamEnvironmentForecastFeaturesV1(
  movement: TeamEnvironmentMovementArtifactV1,
  options: BuildForecastFeaturesOptions
): TeamEnvironmentForecastFeaturesArtifactV1 {
  const expectedTeamCount = options.expectedTeams?.length ?? options.expectedTeamCount ?? 32;
  const featureCoverageStatus = options.featureCoverageStatus ?? 'partial';
  const confidence = options.confidence ?? 0;
  const rowWarnings = options.rowWarnings ?? [];
  const sourceDatasetRefs = options.sourceDatasetRefs ?? [];
  const governance: ForecastFeaturesGovernanceInput =
    options.governance ?? { governanceStatus: 'fixture', governanceSource: 'explicit_marker' };

  // Fail closed on input that cannot be honestly expressed in this single-feature-season,
  // one-row-per-team envelope. These guards keep coverage derivable from a clean unique team set
  // rather than a raw row count, and prevent cross-season (post-cutoff/target-season) leakage.
  const offSeason = movement.teams.filter((team) => team.season !== options.featureSeason);
  if (offSeason.length > 0) {
    const seasons = Array.from(new Set(offSeason.map((team) => team.season)))
      .sort((a, b) => a - b)
      .join(', ');
    throw new Error(
      `buildTeamEnvironmentForecastFeaturesV1: movement contains season(s) ${seasons} not matching ` +
        `featureSeason ${options.featureSeason}; refusing to publish cross-season rows under one ` +
        `feature-season envelope.`
    );
  }
  const seenTeamIds = new Set<string>();
  for (const team of movement.teams) {
    if (seenTeamIds.has(team.teamId)) {
      throw new Error(`buildTeamEnvironmentForecastFeaturesV1: duplicate team "${team.teamId}" in movement input.`);
    }
    seenTeamIds.add(team.teamId);
  }
  if (options.expectedTeams) {
    const expectedSet = new Set(options.expectedTeams);
    for (const teamId of seenTeamIds) {
      if (!expectedSet.has(teamId)) {
        throw new Error(
          `buildTeamEnvironmentForecastFeaturesV1: unexpected team "${teamId}" not in the expected ` +
            `team set for season ${options.featureSeason}.`
        );
      }
    }
  }

  const teams: TeamEnvironmentForecastFeatureTeamV1[] = movement.teams
    .map((team) => ({
      teamId: team.teamId,
      teamAbbr: team.teamAbbr,
      season: team.season,
      cutoffAt: options.cutoffAt,
      features: toFeatureValues(team),
      featureCoverageStatus,
      confidence,
      warnings: [...rowWarnings],
      sourceDatasetRefs: [...sourceDatasetRefs]
    }))
    .sort((a, b) => a.teamId.localeCompare(b.teamId) || a.teamAbbr.localeCompare(b.teamAbbr));

  const weeks = Array.from(new Set(movement.teams.flatMap((team) => team.weeksCovered))).sort(
    (a, b) => a - b
  );
  const seasons = Array.from(new Set(movement.teams.map((team) => team.season))).sort((a, b) => a - b);
  const teamCount = teams.length;

  return {
    artifact: TEAM_ENVIRONMENT_FORECAST_FEATURES_V1_CONTRACT,
    contractVersion: TEAM_ENVIRONMENT_FORECAST_FEATURES_V1_CONTRACT,
    generatedAt: options.generatedAt,
    cutoffAt: options.cutoffAt,
    featureSeason: options.featureSeason,
    targetSeason: options.targetSeason,
    owningRepo: 'TIBER-Teamstate',
    intendedConsumer: 'Point-prediction-model',
    outputKind: 'model-legible-team-context',
    governance: {
      governanceStatus: governance.governanceStatus,
      governanceSource: governance.governanceSource,
      generatedAt: options.generatedAt,
      ...(governance.promotionNotes ? { promotionNotes: governance.promotionNotes } : {})
    },
    coverage: {
      teamCount,
      expectedTeamCount,
      isFullLeague: teamCount === expectedTeamCount,
      seasons,
      weeks
    },
    featureDefinitions: FEATURE_DEFINITIONS.map((definition) => ({ ...definition })),
    teams
  };
}
