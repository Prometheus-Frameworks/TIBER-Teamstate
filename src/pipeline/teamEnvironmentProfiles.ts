import type { TeamEnvironmentProfileArtifactV0, TeamEnvironmentProfileV0 } from '../contracts/teamEnvironmentProfile.js';
import type { SeasonToDateReports, TeamSeasonAggregate } from '../reports/types.js';

const OFFENSE_THRESHOLDS = { elite: 85, strong: 70, average: 50 } as const;
const PASS_THRESHOLDS = { passHeavy: 0.57, runHeavy: 0.43 } as const;
const PACE_THRESHOLDS = { fast: 27, slow: 29 } as const;
const VOLATILITY_STABLE_MAX = 45;
const VOLATILITY_VOLATILE_MIN = 60;

const toOffenseTier = (score: number | null | undefined): TeamEnvironmentProfileV0['offenseTier'] => {
  if (typeof score !== 'number' || Number.isNaN(score)) return 'unknown';
  if (score >= OFFENSE_THRESHOLDS.elite) return 'elite';
  if (score >= OFFENSE_THRESHOLDS.strong) return 'strong';
  if (score >= OFFENSE_THRESHOLDS.average) return 'average';
  return 'weak';
};

const toPassEnvironmentTier = (neutralPassRate: number | null | undefined): TeamEnvironmentProfileV0['passEnvironmentTier'] => {
  if (typeof neutralPassRate !== 'number' || Number.isNaN(neutralPassRate)) return 'unknown';
  if (neutralPassRate >= PASS_THRESHOLDS.passHeavy) return 'pass_heavy';
  if (neutralPassRate <= PASS_THRESHOLDS.runHeavy) return 'run_heavy';
  return 'balanced';
};

const toPaceTier = (secondsPerPlay: number | null | undefined): TeamEnvironmentProfileV0['paceTier'] => {
  if (typeof secondsPerPlay !== 'number' || Number.isNaN(secondsPerPlay)) return 'unknown';
  if (secondsPerPlay <= PACE_THRESHOLDS.fast) return 'fast';
  if (secondsPerPlay >= PACE_THRESHOLDS.slow) return 'slow';
  return 'neutral';
};

const toVolatilityTier = (volatilityScore: number | null | undefined): TeamEnvironmentProfileV0['volatilityTier'] => {
  if (typeof volatilityScore !== 'number' || Number.isNaN(volatilityScore)) return 'unknown';
  if (volatilityScore <= VOLATILITY_STABLE_MAX) return 'stable';
  if (volatilityScore >= VOLATILITY_VOLATILE_MIN) return 'volatile';
  return 'unknown';
};

const buildProfile = (aggregate: TeamSeasonAggregate, generatedAt: string, sourceSnapshotAt: string | null): TeamEnvironmentProfileV0 => {
  const warnings: string[] = ['marketTier unknown: no governed market-prior input artifact exists.'];

  const offenseTier = toOffenseTier(aggregate.averages.fantasyEnvironmentScore);
  const passEnvironmentTier = toPassEnvironmentTier(aggregate.averages.neutralPassRate);
  const paceTier = toPaceTier(aggregate.averages.secondsPerPlay);
  const volatilityTier = toVolatilityTier(aggregate.averages.volatilityScore);

  if (offenseTier === 'unknown') warnings.push('offenseTier unknown: fantasy environment score missing from source artifact.');
  if (passEnvironmentTier === 'unknown') warnings.push('passEnvironmentTier unknown: neutral pass rate missing from source artifact.');
  if (paceTier === 'unknown') warnings.push('paceTier unknown: seconds per play missing from source artifact.');
  if (volatilityTier === 'unknown') warnings.push('volatilityTier unknown: volatility score unavailable or in neutral band (45-60).');

  return {
    contractVersion: 'team_environment_profile_v0',
    teamId: aggregate.team,
    teamAbbr: aggregate.team,
    season: aggregate.season,
    generatedAt,
    sourceSnapshotAt,
    marketTier: 'unknown',
    offenseTier,
    passEnvironmentTier,
    paceTier,
    volatilityTier,
    signals: [
      { name: 'fantasyEnvironmentScore', value: Number(aggregate.averages.fantasyEnvironmentScore.toFixed(2)), source: 'season_to_date.fantasy_environment.json' },
      { name: 'neutralPassRate', value: Number(aggregate.averages.neutralPassRate.toFixed(4)), source: 'season_to_date.team_power_aggregates' },
      { name: 'secondsPerPlay', value: Number(aggregate.averages.secondsPerPlay.toFixed(3)), source: 'season_to_date.team_power_aggregates' },
      { name: 'volatilityScore', value: Number(aggregate.averages.volatilityScore.toFixed(2)), source: 'current_snapshot.json' }
    ],
    warnings
  };
};

export const buildTeamEnvironmentProfilesV0 = (
  reports: SeasonToDateReports,
  generatedAt: string,
  sourceSnapshotAt: string | null
): TeamEnvironmentProfileArtifactV0 => ({
  artifact: 'team_environment_profiles_v0',
  generatedAt,
  sourceArtifacts: ['season_to_date.fantasy_environment.json', 'current_snapshot.json', 'teamstate_weekly.json'],
  profiles: [...reports.aggregates]
    .sort((a, b) => (a.season === b.season ? a.team.localeCompare(b.team) : b.season - a.season))
    .map((aggregate) => buildProfile(aggregate, generatedAt, sourceSnapshotAt))
});
