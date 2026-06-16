import type { TeamWeekState } from '../types/teamstate.js';
import type {
  TeamEnvironmentMovementDeltasV0,
  TeamEnvironmentMovementWindowV0
} from '../contracts/teamEnvironmentMovement.js';
import type {
  TeamEnvironmentMovementArtifactV1,
  TeamEnvironmentMovementDeltasV1,
  TeamEnvironmentMovementWindowV1
} from '../contracts/teamEnvironmentMovementV1.js';
import { buildTeamEnvironmentMovementV0 } from './teamEnvironmentMovement.js';

/**
 * Builds the team-state-only `team_environment_movement_v1` artifact.
 *
 * v1 is derived from the v0 computation so movement labels stay identical and there is a single
 * source of truth for the movement logic. The only difference is that the legacy fantasy-point
 * fields (`fantasyPointsForQB/RB/WR/TE`) are omitted from the window averages and deltas — they
 * never drove any movement label, so dropping them changes nothing about the directional output.
 */

const toV1Window = (window: TeamEnvironmentMovementWindowV0): TeamEnvironmentMovementWindowV1 => ({
  weeks: window.weeks,
  games: window.games,
  averages: {
    pointsPerDrive: window.averages.pointsPerDrive,
    epaPerPlay: window.averages.epaPerPlay,
    successRate: window.averages.successRate,
    explosivePlayRate: window.averages.explosivePlayRate,
    pressureRateAllowed: window.averages.pressureRateAllowed,
    secondsPerPlay: window.averages.secondsPerPlay,
    neutralPassRate: window.averages.neutralPassRate,
    volatilityScore: window.averages.volatilityScore
  }
});

const toV1Deltas = (deltas: TeamEnvironmentMovementDeltasV0): TeamEnvironmentMovementDeltasV1 => ({
  pointsPerDrive: deltas.pointsPerDrive,
  epaPerPlay: deltas.epaPerPlay,
  successRate: deltas.successRate,
  explosivePlayRate: deltas.explosivePlayRate,
  pressureRateAllowed: deltas.pressureRateAllowed,
  secondsPerPlay: deltas.secondsPerPlay,
  neutralPassRate: deltas.neutralPassRate
});

export const buildTeamEnvironmentMovementV1 = (
  teamStates: TeamWeekState[],
  generatedAt: string,
  sourceInputPath?: string,
  sourceProvenanceStatus?: string | null
): TeamEnvironmentMovementArtifactV1 => {
  const v0 = buildTeamEnvironmentMovementV0(teamStates, generatedAt, sourceInputPath, sourceProvenanceStatus);

  return {
    artifact: 'team_environment_movement_v1',
    generatedAt: v0.generatedAt,
    metadata: v0.metadata,
    teams: v0.teams.map((team) => ({
      teamId: team.teamId,
      teamAbbr: team.teamAbbr,
      season: team.season,
      weeksCovered: team.weeksCovered,
      earlyWindow: toV1Window(team.earlyWindow),
      lateWindow: toV1Window(team.lateWindow),
      deltas: toV1Deltas(team.deltas),
      movement: team.movement,
      warnings: team.warnings
    }))
  };
};
