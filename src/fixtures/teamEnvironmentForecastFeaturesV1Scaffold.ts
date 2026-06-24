import { adaptTeamWeekRawV0Artifact } from '../adapters/teamWeekRawV0Adapter.js';
import { mapRawTeamWeekToTeamStateInput } from '../adapters/mapRawTeamWeekToTeamStateInput.js';
import { validateTeamWeekInputRow } from '../ingest/loadTeamWeekInputs.js';
import { buildTeamWeekStates } from '../transform/buildTeamWeekState.js';
import { buildTeamEnvironmentMovementV1 } from '../pipeline/teamEnvironmentMovementV1.js';
import { buildTeamEnvironmentForecastFeaturesV1 } from '../pipeline/teamEnvironmentForecastFeaturesV1.js';
import { buildTeamWeekRawV0FullLeagueScaffold } from './teamWeekRawV0FullLeagueScaffold.js';
import type { TeamEnvironmentForecastFeaturesArtifactV1 } from '../contracts/teamEnvironmentForecastFeaturesV1.js';

/**
 * Deterministic all-32, weeks 1-6 `team_environment_forecast_features_v1` **fixture-scaffold**
 * builder (issue #48). It runs the real pipeline chain end to end, in memory:
 *
 *   buildTeamWeekRawV0FullLeagueScaffold(2024)        (the merged #47 upstream input, in memory)
 *     -> adaptTeamWeekRawV0Artifact                   (team_week_raw_v0 -> RawTeamWeekRow)
 *     -> mapRawTeamWeekToTeamStateInput + validate    (-> TeamWeekInputRow)
 *     -> buildTeamWeekStates                          (-> TeamWeekState[])
 *     -> buildTeamEnvironmentMovementV1               (-> team_environment_movement_v1)
 *     -> buildTeamEnvironmentForecastFeaturesV1       (-> team_environment_forecast_features_v1)
 *
 * Because the upstream input is uniform neutral placeholders, the derived movement deltas are ~0 and
 * the directional labels resolve to stable/insufficient-data: the fixture proves envelope, coverage,
 * typing and ordering at full-league width, NOT real movement. It is honestly labeled
 * `fixture` governance, `confidence: 0`, and is not source-backed, governed, production-, or
 * PPM-training-ready. Nothing here is hand-filled; every value traces to the generator + pipeline.
 */

/** Lineage path of the committed upstream scaffold input (for `sourceDatasetRefs`). */
export const FORECAST_FEATURES_SCAFFOLD_INPUT_PATH =
  'data/fixtures/team_week_raw/team_week_raw_v0.all32_weeks1to6.scaffold.json';

/** Fixed deterministic timestamps so the committed fixture is reproducible. */
export const FORECAST_FEATURES_SCAFFOLD_GENERATED_AT = '2026-06-24T00:00:00.000Z';
/** Forecast cutoff at the start of the 2025 season: 2024 context is strictly pre-cutoff. */
export const FORECAST_FEATURES_SCAFFOLD_CUTOFF_AT = '2025-09-01T00:00:00.000Z';

export const FORECAST_FEATURES_SCAFFOLD_FEATURE_SEASON = 2024;
export const FORECAST_FEATURES_SCAFFOLD_TARGET_SEASON = 2025;

const SCAFFOLD_ROW_WARNING =
  'Scaffold-derived from the all-32 weeks 1-6 team_week_raw_v0 fixture-scaffold (#47), whose inputs ' +
  'are identical neutral placeholders. Feature values carry no real per-team signal; not ' +
  'source-backed, not PPM-training-ready.';

/**
 * Build the all-32, weeks 1-6 forecast-features fixture-scaffold deterministically from the #47
 * upstream scaffold input.
 */
export function buildAll32ForecastFeaturesScaffold(): TeamEnvironmentForecastFeaturesArtifactV1 {
  const rawArtifact = buildTeamWeekRawV0FullLeagueScaffold(FORECAST_FEATURES_SCAFFOLD_FEATURE_SEASON);
  const adapted = adaptTeamWeekRawV0Artifact(rawArtifact);
  const inputRows = mapRawTeamWeekToTeamStateInput(adapted.rows).map(validateTeamWeekInputRow);
  const teamStates = buildTeamWeekStates(inputRows);

  const movement = buildTeamEnvironmentMovementV1(
    teamStates,
    FORECAST_FEATURES_SCAFFOLD_GENERATED_AT,
    FORECAST_FEATURES_SCAFFOLD_INPUT_PATH,
    adapted.provenanceStatus
  );

  return buildTeamEnvironmentForecastFeaturesV1(movement, {
    generatedAt: FORECAST_FEATURES_SCAFFOLD_GENERATED_AT,
    cutoffAt: FORECAST_FEATURES_SCAFFOLD_CUTOFF_AT,
    featureSeason: FORECAST_FEATURES_SCAFFOLD_FEATURE_SEASON,
    targetSeason: FORECAST_FEATURES_SCAFFOLD_TARGET_SEASON,
    expectedTeamCount: 32,
    sourceDatasetRefs: [FORECAST_FEATURES_SCAFFOLD_INPUT_PATH, 'team_environment_movement_v1'],
    featureCoverageStatus: 'partial',
    confidence: 0,
    rowWarnings: [SCAFFOLD_ROW_WARNING],
    governance: {
      governanceStatus: 'fixture',
      governanceSource: 'explicit_marker',
      promotionNotes: [
        'Shape/coverage scaffold derived from a neutral-placeholder upstream input. Proves the v1 ' +
          'envelope at full-league width; not source-backed, not governed, not PPM-training-ready.'
      ]
    }
  });
}
