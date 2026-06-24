import type {
  OffenseMovementDirection,
  PassEnvironmentMovementDirection,
  PaceMovementDirection,
  PressureMovementDirection,
  VolatilityMovementDirection
} from './teamEnvironmentMovement.js';
import type {
  TeamEnvironmentTier,
  PassEnvironmentTier,
  PaceTier,
  VolatilityTier
} from './teamEnvironmentProfile.js';

/**
 * team_environment_forecast_features_v1
 *
 * The first Teamstate-owned, model-legible team-environment feature artifact intended for the
 * Point-prediction-model (PPM). It exposes **pre-cutoff, team-state-only** environment context so
 * PPM can later decide whether those features improve its fantasy-point forecasts after it joins
 * players to teams via TIBER-Data identity/roster truth.
 *
 * Boundary (issue #42): TTS describes team environment context only. It must never carry
 * fantasy-point fields, player-specific outputs, roster advice, or start/sit/trade/drop/waiver
 * language. TTS says "NYG had this observed team environment before the forecast cutoff"; PPM —
 * not TTS — decides whether that helps a forecast.
 *
 * This module is the contract type + a deterministic, fail-closed validator. It does NOT generate
 * data, wire PPM ingestion, or change any model behavior. See
 * docs/contracts/team-environment-forecast-features-v1.md.
 */

export const TEAM_ENVIRONMENT_FORECAST_FEATURES_V1_CONTRACT = 'team_environment_forecast_features_v1' as const;

/**
 * Directional features reuse the existing `team_environment_movement_v1` vocabulary, widened with
 * an explicit `unknown` for pre-population / withheld context. `unknown` is an explicit
 * "no signal", never a fabricated default.
 */
export type ForecastOffenseDirection = OffenseMovementDirection | 'unknown';
export type ForecastPassEnvironmentDirection = PassEnvironmentMovementDirection | 'unknown';
export type ForecastPaceDirection = PaceMovementDirection | 'unknown';
export type ForecastPressureDirection = PressureMovementDirection | 'unknown';
export type ForecastVolatilityDirection = VolatilityMovementDirection | 'unknown';

/**
 * Per-team feature payload. Numeric features are `number | null` (null = absent/withheld, never
 * fabricated). Directional and tier features reuse the existing Teamstate vocabularies and default
 * to `unknown`. Tiers (`*_tier`) are candidate features carried from `team_environment_profiles_v0`.
 *
 * Invariant: this object must contain exactly the feature keys declared in
 * `featureDefinitions[].name`, and must never contain a fantasy-point field.
 */
export interface TeamEnvironmentForecastFeatureValuesV1 {
  points_per_drive: number | null;
  epa_per_play: number | null;
  success_rate: number | null;
  explosive_play_rate: number | null;
  pressure_rate_allowed: number | null;
  seconds_per_play: number | null;
  neutral_pass_rate: number | null;
  volatility_score: number | null;
  offense_direction: ForecastOffenseDirection;
  pass_environment_direction: ForecastPassEnvironmentDirection;
  pace_direction: ForecastPaceDirection;
  pressure_direction: ForecastPressureDirection;
  volatility_direction: ForecastVolatilityDirection;
  offense_tier: TeamEnvironmentTier;
  pass_environment_tier: PassEnvironmentTier;
  pace_tier: PaceTier;
  volatility_tier: VolatilityTier;
}

/** The canonical, ordered set of feature keys for v1. Source of truth for validator alignment. */
export const TEAM_ENVIRONMENT_FORECAST_FEATURE_NAMES_V1 = [
  'points_per_drive',
  'epa_per_play',
  'success_rate',
  'explosive_play_rate',
  'pressure_rate_allowed',
  'seconds_per_play',
  'neutral_pass_rate',
  'volatility_score',
  'offense_direction',
  'pass_environment_direction',
  'pace_direction',
  'pressure_direction',
  'volatility_direction',
  'offense_tier',
  'pass_environment_tier',
  'pace_tier',
  'volatility_tier'
] as const;

export type TeamEnvironmentForecastFeatureName = (typeof TEAM_ENVIRONMENT_FORECAST_FEATURE_NAMES_V1)[number];

export type ForecastFeatureType = 'number' | 'direction' | 'tier';

/**
 * A self-describing feature definition. `allowedInModel` and `allowedInPosthocExplanation` are the
 * PPM-facing usage gates: a feature may be eligible as a model input, a post-hoc explanation field,
 * both, or (for a deprecated/quarantined feature) neither. They are advisory contract metadata —
 * PPM #59's feature-manifest rules remain authoritative.
 */
export interface TeamEnvironmentForecastFeatureDefinitionV1 {
  name: TeamEnvironmentForecastFeatureName;
  type: ForecastFeatureType;
  description: string;
  allowedInModel: boolean;
  allowedInPosthocExplanation: boolean;
}

export type ForecastFeatureCoverageStatus = 'complete' | 'partial' | 'unavailable';

export interface TeamEnvironmentForecastFeatureTeamV1 {
  teamId: string;
  teamAbbr: string;
  /** Feature (pre-cutoff observed) season. Never the target season. */
  season: number;
  /** Forecast cutoff. No fact at or after this instant may inform the feature values. */
  cutoffAt: string;
  features: TeamEnvironmentForecastFeatureValuesV1;
  featureCoverageStatus: ForecastFeatureCoverageStatus;
  /** 0..1 producer confidence in this row's features. Fixture/placeholder rows are 0. */
  confidence: number;
  warnings: string[];
  /** Auditable provenance: source artifact names/paths this row was derived from. */
  sourceDatasetRefs: string[];
}

/**
 * Governance status/source mirror the `team_environment_movement_v1` semantics: governance is
 * declared explicitly and is never inferred from a path alone. Coverage that is not full-league can
 * never be `governed`.
 */
export type ForecastGovernanceStatus = 'governed' | 'fixture' | 'ungoverned' | 'unknown';
export type ForecastGovernanceSource = 'explicit_marker' | 'path_inference' | 'unknown';

export interface TeamEnvironmentForecastGovernanceV1 {
  governanceStatus: ForecastGovernanceStatus;
  governanceSource: ForecastGovernanceSource;
  /** Dataset-level timestamp, mirrors the artifact's top-level `generatedAt`. */
  generatedAt: string;
  promotionNotes?: string[];
}

export interface TeamEnvironmentForecastCoverageV1 {
  teamCount: number;
  expectedTeamCount: number;
  isFullLeague: boolean;
  seasons: number[];
  weeks: number[];
}

export interface TeamEnvironmentForecastFeaturesArtifactV1 {
  artifact: typeof TEAM_ENVIRONMENT_FORECAST_FEATURES_V1_CONTRACT;
  contractVersion: typeof TEAM_ENVIRONMENT_FORECAST_FEATURES_V1_CONTRACT;
  generatedAt: string;
  /** Forecast cutoff. No fact at or after this instant may inform feature values. */
  cutoffAt: string;
  featureSeason: number;
  targetSeason: number;
  owningRepo: 'TIBER-Teamstate';
  intendedConsumer: 'Point-prediction-model';
  outputKind: 'model-legible-team-context';
  governance: TeamEnvironmentForecastGovernanceV1;
  coverage: TeamEnvironmentForecastCoverageV1;
  featureDefinitions: TeamEnvironmentForecastFeatureDefinitionV1[];
  teams: TeamEnvironmentForecastFeatureTeamV1[];
}

/**
 * Fantasy-point field fragments that must NEVER appear anywhere in this artifact. The validator
 * fails closed if any key contains one of these, enforcing the team-state-only boundary at the
 * contract layer rather than trusting producers.
 */
const FORBIDDEN_FANTASY_KEY_FRAGMENTS = ['fantasypoint', 'fantasy_point'];

/**
 * Canonical per-feature value rules for v1. The `type` is the declared `featureDefinitions[].type`
 * each canonical feature must use; `allowed` is the closed set of permitted categorical values for
 * direction/tier features. Numeric features carry no `allowed` set — they accept a finite `number`
 * or `null` only. This is the single source of truth the validator uses to reject malformed feature
 * columns (e.g. `points_per_drive: "n/a"` or `offense_direction: "up"`).
 */
const FEATURE_VALUE_RULES: Record<
  TeamEnvironmentForecastFeatureName,
  { type: ForecastFeatureType; allowed?: readonly string[] }
> = {
  points_per_drive: { type: 'number' },
  epa_per_play: { type: 'number' },
  success_rate: { type: 'number' },
  explosive_play_rate: { type: 'number' },
  pressure_rate_allowed: { type: 'number' },
  seconds_per_play: { type: 'number' },
  neutral_pass_rate: { type: 'number' },
  volatility_score: { type: 'number' },
  offense_direction: { type: 'direction', allowed: ['improving', 'declining', 'stable', 'insufficient_data', 'unknown'] },
  pass_environment_direction: { type: 'direction', allowed: ['more_pass_heavy', 'less_pass_heavy', 'stable', 'insufficient_data', 'unknown'] },
  pace_direction: { type: 'direction', allowed: ['faster', 'slower', 'stable', 'insufficient_data', 'unknown'] },
  pressure_direction: { type: 'direction', allowed: ['improving', 'worsening', 'stable', 'insufficient_data', 'unknown'] },
  volatility_direction: { type: 'direction', allowed: ['rising', 'falling', 'stable', 'insufficient_data', 'unknown'] },
  offense_tier: { type: 'tier', allowed: ['elite', 'strong', 'average', 'weak', 'unknown'] },
  pass_environment_tier: { type: 'tier', allowed: ['pass_heavy', 'balanced', 'run_heavy', 'unknown'] },
  pace_tier: { type: 'tier', allowed: ['fast', 'neutral', 'slow', 'unknown'] },
  volatility_tier: { type: 'tier', allowed: ['stable', 'volatile', 'unknown'] }
};

export interface ForecastValidationResult {
  valid: boolean;
  errors: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectKeysDeep(value: unknown, keys: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectKeysDeep(item, keys);
    return;
  }
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      keys.push(key);
      collectKeysDeep(child, keys);
    }
  }
}

/**
 * Deterministic, fail-closed validator for the `team_environment_forecast_features_v1` contract.
 *
 * It verifies the safety envelope every PPM-facing artifact must carry — cutoff, governance,
 * coverage, feature definitions, and one well-formed row per team — and refuses (fails closed) on:
 * any missing/invalid required field; any fantasy-point field; coverage metadata that disagrees
 * with the actual team rows (e.g. a subset claiming `isFullLeague: true`); a `featureDefinitions`
 * manifest that is not exactly the canonical V1 feature set; any team whose `features` keys do not
 * match that manifest; and any feature value that violates its canonical type (a non-finite/string
 * numeric, or an out-of-vocabulary direction/tier). It does not assert that values are predictively
 * "good"; it asserts the artifact is shaped safely enough to even be considered by PPM.
 */
export function validateTeamEnvironmentForecastFeaturesV1(value: unknown): ForecastValidationResult {
  const errors: string[] = [];

  if (!isObject(value)) {
    return { valid: false, errors: ['artifact must be an object'] };
  }

  // Hard guardrail: no fantasy-point field may appear anywhere in the artifact.
  const allKeys: string[] = [];
  collectKeysDeep(value, allKeys);
  for (const key of allKeys) {
    const normalized = key.toLowerCase().replace(/[^a-z]/g, '');
    if (FORBIDDEN_FANTASY_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment.replace(/[^a-z]/g, '')))) {
      errors.push(`forbidden fantasy-point field present: ${key}`);
    }
  }

  if (value.artifact !== TEAM_ENVIRONMENT_FORECAST_FEATURES_V1_CONTRACT) {
    errors.push(`artifact must be "${TEAM_ENVIRONMENT_FORECAST_FEATURES_V1_CONTRACT}"`);
  }
  if (value.contractVersion !== TEAM_ENVIRONMENT_FORECAST_FEATURES_V1_CONTRACT) {
    errors.push(`contractVersion must be "${TEAM_ENVIRONMENT_FORECAST_FEATURES_V1_CONTRACT}"`);
  }

  for (const field of ['generatedAt', 'cutoffAt'] as const) {
    if (typeof value[field] !== 'string' || (value[field] as string).length === 0) {
      errors.push(`${field} must be a non-empty ISO string`);
    }
  }
  for (const field of ['featureSeason', 'targetSeason'] as const) {
    if (typeof value[field] !== 'number') {
      errors.push(`${field} must be a number`);
    }
  }
  if (value.owningRepo !== 'TIBER-Teamstate') {
    errors.push('owningRepo must be "TIBER-Teamstate"');
  }
  if (value.intendedConsumer !== 'Point-prediction-model') {
    errors.push('intendedConsumer must be "Point-prediction-model"');
  }
  if (value.outputKind !== 'model-legible-team-context') {
    errors.push('outputKind must be "model-legible-team-context"');
  }

  const teamRowCount = Array.isArray(value.teams) ? value.teams.length : null;
  validateGovernance(value.governance, errors);
  validateCoverage(value.coverage, teamRowCount, errors);
  const declaredFeatureNames = validateFeatureDefinitions(value.featureDefinitions, errors);
  validateTeams(value.teams, declaredFeatureNames, errors);

  return { valid: errors.length === 0, errors };
}

function validateGovernance(governance: unknown, errors: string[]): void {
  if (!isObject(governance)) {
    errors.push('governance must be an object');
    return;
  }
  const statuses: ForecastGovernanceStatus[] = ['governed', 'fixture', 'ungoverned', 'unknown'];
  const sources: ForecastGovernanceSource[] = ['explicit_marker', 'path_inference', 'unknown'];
  if (!statuses.includes(governance.governanceStatus as ForecastGovernanceStatus)) {
    errors.push(`governance.governanceStatus must be one of ${statuses.join(', ')}`);
  }
  if (!sources.includes(governance.governanceSource as ForecastGovernanceSource)) {
    errors.push(`governance.governanceSource must be one of ${sources.join(', ')}`);
  }
  if (typeof governance.generatedAt !== 'string' || governance.generatedAt.length === 0) {
    errors.push('governance.generatedAt must be a non-empty ISO string');
  }
}

function validateCoverage(coverage: unknown, teamRowCount: number | null, errors: string[]): void {
  if (!isObject(coverage)) {
    errors.push('coverage must be an object');
    return;
  }
  for (const field of ['teamCount', 'expectedTeamCount'] as const) {
    if (typeof coverage[field] !== 'number') {
      errors.push(`coverage.${field} must be a number`);
    }
  }
  if (typeof coverage.isFullLeague !== 'boolean') {
    errors.push('coverage.isFullLeague must be a boolean');
  }
  for (const field of ['seasons', 'weeks'] as const) {
    if (!Array.isArray(coverage[field])) {
      errors.push(`coverage.${field} must be an array`);
    }
  }

  // Coverage metadata must be derivable from the actual rows — it cannot be self-asserted. A
  // producer that ships a subset of teams but claims teamCount: 32 / isFullLeague: true must fail
  // closed, because full-league coverage is the PPM eligibility gate.
  const { teamCount, expectedTeamCount, isFullLeague } = coverage;
  if (typeof teamCount === 'number' && teamRowCount !== null && teamCount !== teamRowCount) {
    errors.push(`coverage.teamCount (${teamCount}) must equal the number of team rows (${teamRowCount})`);
  }
  if (typeof teamCount === 'number' && typeof expectedTeamCount === 'number' && typeof isFullLeague === 'boolean') {
    const derivedFullLeague = teamCount === expectedTeamCount;
    if (isFullLeague !== derivedFullLeague) {
      errors.push(
        `coverage.isFullLeague (${isFullLeague}) must be ${derivedFullLeague} when teamCount=${teamCount} and expectedTeamCount=${expectedTeamCount}`
      );
    }
  }
}

function validateFeatureDefinitions(featureDefinitions: unknown, errors: string[]): Set<string> {
  const declared = new Set<string>();
  if (!Array.isArray(featureDefinitions) || featureDefinitions.length === 0) {
    errors.push('featureDefinitions must be a non-empty array');
    return declared;
  }
  for (const [index, definition] of featureDefinitions.entries()) {
    if (!isObject(definition)) {
      errors.push(`featureDefinitions[${index}] must be an object`);
      continue;
    }
    if (typeof definition.name !== 'string' || definition.name.length === 0) {
      errors.push(`featureDefinitions[${index}].name must be a non-empty string`);
      continue;
    }
    if (declared.has(definition.name)) {
      errors.push(`featureDefinitions declares "${definition.name}" more than once`);
    }
    declared.add(definition.name);
    // Each canonical feature must be declared with its canonical type; the value rules below depend
    // on this so a manifest can't, e.g., declare neutral_pass_rate as a tier.
    const rule = (FEATURE_VALUE_RULES as Record<string, { type: ForecastFeatureType } | undefined>)[definition.name];
    if (rule && definition.type !== rule.type) {
      errors.push(`featureDefinitions[${index}].type for "${definition.name}" must be "${rule.type}"`);
    } else if (!['number', 'direction', 'tier'].includes(definition.type as string)) {
      errors.push(`featureDefinitions[${index}].type must be one of number, direction, tier`);
    }
    if (typeof definition.description !== 'string' || definition.description.length === 0) {
      errors.push(`featureDefinitions[${index}].description must be a non-empty string`);
    }
    for (const flag of ['allowedInModel', 'allowedInPosthocExplanation'] as const) {
      if (typeof definition[flag] !== 'boolean') {
        errors.push(`featureDefinitions[${index}].${flag} must be a boolean`);
      }
    }
  }

  // The declared manifest must be exactly the canonical V1 feature set — no missing canonical
  // features, no unknown extras. The exported contract fixes these names, so an artifact that drops
  // or invents a feature column must fail closed rather than reach PPM as "valid".
  for (const name of TEAM_ENVIRONMENT_FORECAST_FEATURE_NAMES_V1) {
    if (!declared.has(name)) {
      errors.push(`featureDefinitions is missing canonical feature "${name}"`);
    }
  }
  for (const name of declared) {
    if (!(TEAM_ENVIRONMENT_FORECAST_FEATURE_NAMES_V1 as readonly string[]).includes(name)) {
      errors.push(`featureDefinitions declares unknown feature "${name}"`);
    }
  }
  return declared;
}

function validateTeams(teams: unknown, declaredFeatureNames: Set<string>, errors: string[]): void {
  if (!Array.isArray(teams)) {
    errors.push('teams must be an array');
    return;
  }
  for (const [index, team] of teams.entries()) {
    if (!isObject(team)) {
      errors.push(`teams[${index}] must be an object`);
      continue;
    }
    for (const field of ['teamId', 'teamAbbr', 'cutoffAt'] as const) {
      if (typeof team[field] !== 'string' || (team[field] as string).length === 0) {
        errors.push(`teams[${index}].${field} must be a non-empty string`);
      }
    }
    if (typeof team.season !== 'number') {
      errors.push(`teams[${index}].season must be a number`);
    }
    if (!['complete', 'partial', 'unavailable'].includes(team.featureCoverageStatus as string)) {
      errors.push(`teams[${index}].featureCoverageStatus must be one of complete, partial, unavailable`);
    }
    if (typeof team.confidence !== 'number' || team.confidence < 0 || team.confidence > 1) {
      errors.push(`teams[${index}].confidence must be a number in [0, 1]`);
    }
    if (!Array.isArray(team.warnings)) {
      errors.push(`teams[${index}].warnings must be an array`);
    }
    if (!Array.isArray(team.sourceDatasetRefs)) {
      errors.push(`teams[${index}].sourceDatasetRefs must be an array`);
    }

    if (!isObject(team.features)) {
      errors.push(`teams[${index}].features must be an object`);
      continue;
    }
    // Every team's features must exactly match the declared featureDefinitions — no missing keys,
    // no undeclared extras. This keeps the manifest and the data provably aligned.
    const features = team.features;
    const featureKeys = new Set(Object.keys(features));
    for (const declaredName of declaredFeatureNames) {
      if (!featureKeys.has(declaredName)) {
        errors.push(`teams[${index}].features is missing declared feature "${declaredName}"`);
      }
    }
    for (const key of featureKeys) {
      if (!declaredFeatureNames.has(key)) {
        errors.push(`teams[${index}].features has undeclared feature "${key}"`);
      }
      // Validate the value against its canonical type so malformed columns (a string in a numeric
      // feature, an out-of-vocabulary categorical) fail closed rather than reach PPM as "valid".
      const rule = (FEATURE_VALUE_RULES as Record<string, { type: ForecastFeatureType; allowed?: readonly string[] } | undefined>)[key];
      if (rule) {
        validateFeatureValue(`teams[${index}].features.${key}`, features[key], rule, errors);
      }
    }
  }
}

function validateFeatureValue(
  path: string,
  value: unknown,
  rule: { type: ForecastFeatureType; allowed?: readonly string[] },
  errors: string[]
): void {
  if (rule.type === 'number') {
    // null is an explicit "no signal"; otherwise a finite number only (no NaN/Infinity/strings).
    if (value !== null && !(typeof value === 'number' && Number.isFinite(value))) {
      errors.push(`${path} must be a finite number or null`);
    }
    return;
  }
  // direction / tier: a string drawn from the feature's closed vocabulary.
  if (typeof value !== 'string' || !(rule.allowed ?? []).includes(value)) {
    errors.push(`${path} must be one of ${(rule.allowed ?? []).join(', ')}`);
  }
}
