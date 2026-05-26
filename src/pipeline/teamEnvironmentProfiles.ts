import path from 'node:path';
import type { TeamEnvironmentProfileArtifactV0, TeamEnvironmentProfileV0, TeamstateArtifactInputSource, TeamstateArtifactMetadataV0, TeamstateProvenanceStatus } from '../contracts/teamEnvironmentProfile.js';
import type { SeasonToDateReports, TeamSeasonAggregate } from '../reports/types.js';

const OFFENSE_THRESHOLDS = { elite: 85, strong: 70, average: 50 } as const;
const PASS_THRESHOLDS = { passHeavy: 0.57, runHeavy: 0.43 } as const;
const PACE_THRESHOLDS = { fast: 27, slow: 29 } as const;
const VOLATILITY_STABLE_MAX = 45;
const VOLATILITY_VOLATILE_MIN = 60;
const EXPECTED_NFL_TEAM_COUNT = 32;
const NFL_TEAM_ABBRS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
  'LV', 'LAC', 'LAR', 'MIA', 'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS'
] as const;

const isFiniteNumber = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value);

const toRoundedSignalValue = (value: number | null | undefined, digits: number): number | null => {
  if (!isFiniteNumber(value)) return null;
  return Number(value.toFixed(digits));
};

const toOffenseTier = (score: number | null | undefined): TeamEnvironmentProfileV0['offenseTier'] => {
  if (!isFiniteNumber(score)) return 'unknown';
  if (score >= OFFENSE_THRESHOLDS.elite) return 'elite';
  if (score >= OFFENSE_THRESHOLDS.strong) return 'strong';
  if (score >= OFFENSE_THRESHOLDS.average) return 'average';
  return 'weak';
};

const toPassEnvironmentTier = (neutralPassRate: number | null | undefined): TeamEnvironmentProfileV0['passEnvironmentTier'] => {
  if (!isFiniteNumber(neutralPassRate)) return 'unknown';
  if (neutralPassRate >= PASS_THRESHOLDS.passHeavy) return 'pass_heavy';
  if (neutralPassRate <= PASS_THRESHOLDS.runHeavy) return 'run_heavy';
  return 'balanced';
};

const toPaceTier = (secondsPerPlay: number | null | undefined): TeamEnvironmentProfileV0['paceTier'] => {
  if (!isFiniteNumber(secondsPerPlay)) return 'unknown';
  if (secondsPerPlay <= PACE_THRESHOLDS.fast) return 'fast';
  if (secondsPerPlay >= PACE_THRESHOLDS.slow) return 'slow';
  return 'neutral';
};

const toVolatilityTier = (volatilityScore: number | null | undefined): TeamEnvironmentProfileV0['volatilityTier'] => {
  if (!isFiniteNumber(volatilityScore)) return 'unknown';
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
      { name: 'fantasyEnvironmentScore', value: toRoundedSignalValue(aggregate.averages.fantasyEnvironmentScore, 2), source: 'season_to_date.fantasy_environment.json' },
      { name: 'neutralPassRate', value: toRoundedSignalValue(aggregate.averages.neutralPassRate, 4), source: 'season_to_date.team_power.json' },
      { name: 'secondsPerPlay', value: toRoundedSignalValue(aggregate.averages.secondsPerPlay, 3), source: 'season_to_date.team_power.json' },
      { name: 'volatilityScore', value: toRoundedSignalValue(aggregate.averages.volatilityScore, 2), source: 'season_to_date.team_power.json' }
    ],
    warnings
  };
};

export const buildTeamEnvironmentProfilesV0 = (
  reports: SeasonToDateReports,
  generatedAt: string,
  sourceSnapshotAt: string | null,
  sourceInputPath?: string,
  repositoryRootPath: string = process.cwd()
): TeamEnvironmentProfileArtifactV0 => {
  const profiles = [...reports.aggregates]
    .sort((a, b) => (a.season === b.season ? a.team.localeCompare(b.team) : b.season - a.season))
    .map((aggregate) => buildProfile(aggregate, generatedAt, sourceSnapshotAt));

  const presentTeams = [...new Set(profiles.map((profile) => profile.teamAbbr))].sort((a, b) => a.localeCompare(b));
  const missingTeams = NFL_TEAM_ABBRS.filter((team) => !presentTeams.includes(team));
  const weeks = [...new Set(reports.aggregates.map((aggregate) => aggregate.latestWeek))].sort((a, b) => a - b);
  const seasons = [...new Set(reports.aggregates.map((aggregate) => aggregate.season))].sort((a, b) => a - b);
  const gamesPerTeam = reports.aggregates.map((aggregate) => aggregate.games);

  const normalizedSourceInputPath = (() => {
    if (!sourceInputPath) {
      return undefined;
    }

    const relative = path.relative(repositoryRootPath, sourceInputPath);
    if (relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)) {
      return relative;
    }

    return sourceInputPath;
  })();

  const inputSourceType: TeamstateArtifactInputSource['type'] =
    normalizedSourceInputPath === undefined ? 'unknown' : normalizedSourceInputPath.includes('sample') ? 'sample' : normalizedSourceInputPath.includes('fixture') ? 'fixture' : 'unknown';

  const provenanceStatus: TeamstateProvenanceStatus =
    inputSourceType === 'fixture' ? 'fixture_scaffold'
      : inputSourceType === 'sample' ? 'fixture_scaffold'
        : inputSourceType === 'unknown' ? 'unknown_provenance'
          : 'partial_real_data';

  const provenanceNotes: string[] = [];
  if (inputSourceType === 'sample' || inputSourceType === 'fixture') {
    provenanceNotes.push('Input path indicates sample/fixture scaffold data; artifact is not governed production truth.');
  }
  if (inputSourceType === 'unknown') {
    provenanceNotes.push('Input source path was not available or did not match sample/fixture/governed patterns.');
  }
  if (normalizedSourceInputPath !== undefined && path.isAbsolute(normalizedSourceInputPath)) {
    provenanceNotes.push('Input source path is outside repository root and is stored as absolute path.');
  }
  if (presentTeams.length < EXPECTED_NFL_TEAM_COUNT) {
    provenanceNotes.push('Coverage is incomplete (<32 NFL teams); artifact cannot be governed_real_data.');
  }

  const metadata: TeamstateArtifactMetadataV0 = {
    provenanceStatus,
    provenanceNotes,
    generatedAt,
    inputSources: [{ path: normalizedSourceInputPath ?? 'unknown', type: inputSourceType }],
    coverage: {
      teamCount: presentTeams.length,
      expectedTeamCount: EXPECTED_NFL_TEAM_COUNT,
      isFullLeague: presentTeams.length === EXPECTED_NFL_TEAM_COUNT,
      presentTeams,
      missingTeams,
      seasons,
      weeks,
      latestWeek: weeks.length > 0 ? weeks[weeks.length - 1] : null,
      gamesPerTeamMin: gamesPerTeam.length > 0 ? Math.min(...gamesPerTeam) : null,
      gamesPerTeamMax: gamesPerTeam.length > 0 ? Math.max(...gamesPerTeam) : null
    }
  };

  return {
    artifact: 'team_environment_profiles_v0',
    generatedAt,
    sourceArtifacts: ['season_to_date.fantasy_environment.json', 'season_to_date.team_power.json', 'teamstate_weekly.json'],
    metadata,
    profiles
  };
};
