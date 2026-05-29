import type { TeamEnvironmentMovementArtifactV0, TeamEnvironmentMovementDeltasV0, TeamEnvironmentMovementMetadataV0, TeamEnvironmentMovementTeamV0, TeamEnvironmentMovementWindowAveragesV0, TeamEnvironmentMovementWindowV0 } from '../contracts/teamEnvironmentMovement.js';
import type { TeamstateArtifactInputSource, TeamstateProvenanceStatus } from '../contracts/teamEnvironmentProfile.js';
import type { TeamWeekState } from '../types/teamstate.js';

const EXPECTED_NFL_TEAM_COUNT = 32;
const NFL_TEAM_ABBRS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
  'LV', 'LAC', 'LAR', 'MIA', 'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS'
] as const;
const NFL_TEAM_ABBR_SET = new Set<string>(NFL_TEAM_ABBRS);

const MOVEMENT_METRICS = [
  'pointsPerDrive',
  'epaPerPlay',
  'successRate',
  'explosivePlayRate',
  'pressureRateAllowed',
  'secondsPerPlay',
  'neutralPassRate',
  'fantasyPointsForQB',
  'fantasyPointsForRB',
  'fantasyPointsForWR',
  'fantasyPointsForTE'
] as const satisfies ReadonlyArray<keyof TeamEnvironmentMovementDeltasV0>;

const round = (value: number | null, digits: number): number | null => {
  if (value === null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
};

const average = (values: number[]): number | null => {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length === 0) return null;
  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
};

const toNormalizedSourcePath = (sourceInputPath: string | undefined): string | null => {
  if (!sourceInputPath) return null;
  const normalizedPath = sourceInputPath.replaceAll('\\', '/').replace(/^\.\//, '');
  const sampleMarker = '/data/sample/';
  const fixtureMarker = '/fixtures/';

  const sampleIndex = normalizedPath.indexOf(sampleMarker);
  if (sampleIndex >= 0) return normalizedPath.slice(sampleIndex + 1);

  const fixtureIndex = normalizedPath.indexOf(fixtureMarker);
  if (fixtureIndex >= 0) return normalizedPath.slice(fixtureIndex + 1);

  return normalizedPath;
};

const toInputSourceType = (sourceInputPath: string | undefined): TeamstateArtifactInputSource['type'] => {
  const normalizedPath = toNormalizedSourcePath(sourceInputPath);
  if (!normalizedPath) return 'unknown';
  if (normalizedPath.startsWith('data/sample/')) return 'sample';
  if (normalizedPath.startsWith('fixtures/') || normalizedPath.includes('/fixtures/')) return 'fixture';
  return 'unknown';
};

const toProvenanceStatus = (
  sourceInputPath: string | undefined,
  sourceProvenanceStatus: string | null | undefined,
  isFullLeague: boolean
): TeamstateProvenanceStatus => {
  if (sourceProvenanceStatus === 'fixture_scaffold') return 'fixture_scaffold';
  if (sourceProvenanceStatus === 'sample') return 'sample';
  if (sourceProvenanceStatus === 'governed_real_data') return isFullLeague ? 'governed_real_data' : 'partial_real_data';
  if (sourceProvenanceStatus === 'partial_real_data') return 'partial_real_data';
  if (sourceProvenanceStatus === 'unknown_provenance') return 'unknown_provenance';

  const inputSourceType = toInputSourceType(sourceInputPath);
  if (inputSourceType === 'fixture' || inputSourceType === 'sample') return 'fixture_scaffold';
  return inputSourceType === 'unknown' ? 'unknown_provenance' : 'partial_real_data';
};

const buildMetadata = (
  teamStates: TeamWeekState[],
  sourceInputPath: string | undefined,
  sourceProvenanceStatus: string | null | undefined
): TeamEnvironmentMovementMetadataV0 => {
  const teams = [...new Set(teamStates.map((state) => state.team))].sort((a, b) => a.localeCompare(b));
  const seasons = [...new Set(teamStates.map((state) => state.season))].sort((a, b) => a - b);
  const weeks = [...new Set(teamStates.map((state) => state.week))].sort((a, b) => a - b);
  const isFullLeague = teams.length === EXPECTED_NFL_TEAM_COUNT && teams.every((team) => NFL_TEAM_ABBR_SET.has(team));
  const normalizedSourcePath = toNormalizedSourcePath(sourceInputPath);

  return {
    provenanceStatus: toProvenanceStatus(sourceInputPath, sourceProvenanceStatus, isFullLeague),
    inputSources: [{ path: normalizedSourcePath ?? 'unknown', type: toInputSourceType(sourceInputPath) }],
    coverage: {
      teamCount: teams.length,
      teams,
      seasons,
      weeks,
      latestWeek: weeks.length > 0 ? weeks[weeks.length - 1] : null,
      isFullLeague
    }
  };
};

const buildWindowAverages = (states: TeamWeekState[]): TeamEnvironmentMovementWindowAveragesV0 => ({
  pointsPerDrive: round(average(states.map((state) => state.input.pointsPerDrive)), 3),
  epaPerPlay: round(average(states.map((state) => state.input.epaPerPlay)), 4),
  successRate: round(average(states.map((state) => state.input.successRate)), 4),
  explosivePlayRate: round(average(states.map((state) => state.input.explosivePlayRate)), 4),
  pressureRateAllowed: round(average(states.map((state) => state.input.pressureRateAllowed)), 4),
  secondsPerPlay: round(average(states.map((state) => state.input.secondsPerPlay)), 3),
  neutralPassRate: round(average(states.map((state) => state.input.neutralPassRate)), 4),
  fantasyPointsForQB: round(average(states.map((state) => state.input.fantasyPointsForQB)), 2),
  fantasyPointsForRB: round(average(states.map((state) => state.input.fantasyPointsForRB)), 2),
  fantasyPointsForWR: round(average(states.map((state) => state.input.fantasyPointsForWR)), 2),
  fantasyPointsForTE: round(average(states.map((state) => state.input.fantasyPointsForTE)), 2),
  volatilityScore: round(average(states.map((state) => state.scores.volatilityScore)), 2)
});

const buildWindow = (states: TeamWeekState[]): TeamEnvironmentMovementWindowV0 => ({
  weeks: states.map((state) => state.week),
  games: states.length,
  averages: buildWindowAverages(states)
});

const buildNullDeltas = (): TeamEnvironmentMovementDeltasV0 => ({
  pointsPerDrive: null,
  epaPerPlay: null,
  successRate: null,
  explosivePlayRate: null,
  pressureRateAllowed: null,
  secondsPerPlay: null,
  neutralPassRate: null,
  fantasyPointsForQB: null,
  fantasyPointsForRB: null,
  fantasyPointsForWR: null,
  fantasyPointsForTE: null
});

const buildDeltas = (earlyWindow: TeamEnvironmentMovementWindowV0, lateWindow: TeamEnvironmentMovementWindowV0): TeamEnvironmentMovementDeltasV0 => {
  const deltas = buildNullDeltas();
  for (const metric of MOVEMENT_METRICS) {
    const earlyValue = earlyWindow.averages[metric];
    const lateValue = lateWindow.averages[metric];
    deltas[metric] = earlyValue === null || lateValue === null ? null : round(lateValue - earlyValue, 4);
  }
  return deltas;
};

const compareHigherIsBetter = (delta: number | null, threshold: number): 'improving' | 'declining' | 'stable' | 'insufficient_data' => {
  if (delta === null) return 'insufficient_data';
  if (delta >= threshold) return 'improving';
  if (delta <= -threshold) return 'declining';
  return 'stable';
};

const buildOffenseDirection = (deltas: TeamEnvironmentMovementDeltasV0): 'improving' | 'declining' | 'stable' | 'insufficient_data' => {
  const signals = [
    compareHigherIsBetter(deltas.pointsPerDrive, 0.25),
    compareHigherIsBetter(deltas.epaPerPlay, 0.03),
    compareHigherIsBetter(deltas.successRate, 0.025),
    compareHigherIsBetter(deltas.explosivePlayRate, 0.015)
  ].filter((signal) => signal !== 'insufficient_data');

  if (signals.length === 0) return 'insufficient_data';
  const improving = signals.filter((signal) => signal === 'improving').length;
  const declining = signals.filter((signal) => signal === 'declining').length;
  if (declining >= 2 || (declining >= 1 && improving === 0)) return 'declining';
  if (improving >= 2 || (improving >= 1 && declining === 0)) return 'improving';
  return 'stable';
};

const buildPassDirection = (delta: number | null) => {
  if (delta === null) return 'insufficient_data' as const;
  if (delta >= 0.03) return 'more_pass_heavy' as const;
  if (delta <= -0.03) return 'less_pass_heavy' as const;
  return 'stable' as const;
};

const buildPaceDirection = (delta: number | null) => {
  if (delta === null) return 'insufficient_data' as const;
  if (delta >= 0.5) return 'slower' as const;
  if (delta <= -0.5) return 'faster' as const;
  return 'stable' as const;
};

const buildPressureDirection = (delta: number | null) => {
  if (delta === null) return 'insufficient_data' as const;
  if (delta >= 0.03) return 'worsening' as const;
  if (delta <= -0.03) return 'improving' as const;
  return 'stable' as const;
};

const buildVolatilityDirection = (earlyWindow: TeamEnvironmentMovementWindowV0, lateWindow: TeamEnvironmentMovementWindowV0) => {
  const earlyValue = earlyWindow.averages.volatilityScore;
  const lateValue = lateWindow.averages.volatilityScore;
  if (earlyValue === null || lateValue === null) return 'insufficient_data' as const;
  const delta = lateValue - earlyValue;
  if (delta >= 5) return 'rising' as const;
  if (delta <= -5) return 'falling' as const;
  return 'stable' as const;
};

const buildVerdict = (movement: Omit<TeamEnvironmentMovementTeamV0['movement'], 'verdict'>): string => {
  if (movement.offenseDirection === 'insufficient_data') return 'insufficient_data';
  if (movement.offenseDirection === 'declining' && movement.pressureDirection === 'worsening') return 'offensive_environment_declining_pressure_worsening';
  if (movement.offenseDirection === 'declining') return 'offensive_environment_declining';
  if (movement.offenseDirection === 'improving' && movement.pressureDirection !== 'worsening') return 'offensive_environment_improving';
  if (movement.volatilityDirection === 'rising') return 'environment_volatility_rising';
  return 'environment_stable';
};

const selectWindowSize = (weekCount: number): number | null => {
  if (weekCount >= 6) return 3;
  if (weekCount >= 4) return 2;
  return null;
};

const buildMovementTeam = (states: TeamWeekState[]): TeamEnvironmentMovementTeamV0 => {
  const sortedStates = [...states].sort((a, b) => a.week - b.week);
  const weeksCovered = sortedStates.map((state) => state.week);
  const windowSize = selectWindowSize(sortedStates.length);
  const warnings: string[] = [];

  if (windowSize === null) {
    warnings.push('insufficient_data: fewer than 4 weeks available for deterministic temporal windows.');
    const emptyEarlyWindow = buildWindow([]);
    const emptyLateWindow = buildWindow([]);
    return {
      teamId: sortedStates[0]?.team ?? 'unknown',
      teamAbbr: sortedStates[0]?.team ?? 'unknown',
      season: sortedStates[0]?.season ?? 0,
      weeksCovered,
      earlyWindow: emptyEarlyWindow,
      lateWindow: emptyLateWindow,
      deltas: buildNullDeltas(),
      movement: {
        offenseDirection: 'insufficient_data',
        passEnvironmentDirection: 'insufficient_data',
        paceDirection: 'insufficient_data',
        pressureDirection: 'insufficient_data',
        volatilityDirection: 'insufficient_data',
        verdict: 'insufficient_data'
      },
      warnings
    };
  }

  const earlyWindow = buildWindow(sortedStates.slice(0, windowSize));
  const lateWindow = buildWindow(sortedStates.slice(-windowSize));
  const deltas = buildDeltas(earlyWindow, lateWindow);
  const movementWithoutVerdict = {
    offenseDirection: buildOffenseDirection(deltas),
    passEnvironmentDirection: buildPassDirection(deltas.neutralPassRate),
    paceDirection: buildPaceDirection(deltas.secondsPerPlay),
    pressureDirection: buildPressureDirection(deltas.pressureRateAllowed),
    volatilityDirection: buildVolatilityDirection(earlyWindow, lateWindow)
  };

  return {
    teamId: sortedStates[0].team,
    teamAbbr: sortedStates[0].team,
    season: sortedStates[0].season,
    weeksCovered,
    earlyWindow,
    lateWindow,
    deltas,
    movement: {
      ...movementWithoutVerdict,
      verdict: buildVerdict(movementWithoutVerdict)
    },
    warnings
  };
};

const groupByTeamSeason = (teamStates: TeamWeekState[]): TeamWeekState[][] => {
  const groups = new Map<string, TeamWeekState[]>();
  for (const state of teamStates) {
    const key = `${state.season}:${state.team}`;
    const group = groups.get(key) ?? [];
    group.push(state);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => {
    const firstA = a[0];
    const firstB = b[0];
    if (!firstA || !firstB) return 0;
    return firstA.season === firstB.season ? firstA.team.localeCompare(firstB.team) : firstB.season - firstA.season;
  });
};

export const buildTeamEnvironmentMovementV0 = (
  teamStates: TeamWeekState[],
  generatedAt: string,
  sourceInputPath?: string,
  sourceProvenanceStatus?: string | null
): TeamEnvironmentMovementArtifactV0 => ({
  artifact: 'team_environment_movement_v0',
  generatedAt,
  metadata: buildMetadata(teamStates, sourceInputPath, sourceProvenanceStatus),
  teams: groupByTeamSeason(teamStates).map(buildMovementTeam)
});
