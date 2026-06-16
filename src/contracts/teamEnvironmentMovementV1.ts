import type {
  OffenseMovementDirection,
  PassEnvironmentMovementDirection,
  PaceMovementDirection,
  PressureMovementDirection,
  VolatilityMovementDirection,
  TeamEnvironmentMovementMetadataV0
} from './teamEnvironmentMovement.js';

/**
 * team_environment_movement_v1
 *
 * The team-state-only successor to `team_environment_movement_v0`. v1 deliberately drops the
 * legacy fantasy-point fields (`fantasyPointsForQB/RB/WR/TE`) from the window averages and deltas,
 * keeping Teamstate's movement artifact within the TTS v1 boundary (observed NFL team state, not
 * fantasy outputs). See docs/contracts/team-environment-movement-v1.md and issue #34.
 *
 * Movement labels are unchanged from v0: they were always derived solely from team-state fields,
 * so v1 is the clean projection of the same computation with the inert fantasy-point passengers
 * removed. The shared metadata/provenance contract is reused from v0.
 */

export interface TeamEnvironmentMovementWindowAveragesV1 {
  pointsPerDrive: number | null;
  epaPerPlay: number | null;
  successRate: number | null;
  explosivePlayRate: number | null;
  pressureRateAllowed: number | null;
  secondsPerPlay: number | null;
  neutralPassRate: number | null;
  volatilityScore: number | null;
}

export interface TeamEnvironmentMovementWindowV1 {
  weeks: number[];
  games: number;
  averages: TeamEnvironmentMovementWindowAveragesV1;
}

export type TeamEnvironmentMovementDeltasV1 = Omit<TeamEnvironmentMovementWindowAveragesV1, 'volatilityScore'>;

export interface TeamEnvironmentMovementTeamV1 {
  teamId: string;
  teamAbbr: string;
  season: number;
  weeksCovered: number[];
  earlyWindow: TeamEnvironmentMovementWindowV1;
  lateWindow: TeamEnvironmentMovementWindowV1;
  deltas: TeamEnvironmentMovementDeltasV1;
  movement: {
    offenseDirection: OffenseMovementDirection;
    passEnvironmentDirection: PassEnvironmentMovementDirection;
    paceDirection: PaceMovementDirection;
    pressureDirection: PressureMovementDirection;
    volatilityDirection: VolatilityMovementDirection;
    verdict: string;
  };
  warnings: string[];
}

export interface TeamEnvironmentMovementArtifactV1 {
  artifact: 'team_environment_movement_v1';
  generatedAt: string;
  metadata: TeamEnvironmentMovementMetadataV0;
  teams: TeamEnvironmentMovementTeamV1[];
}
