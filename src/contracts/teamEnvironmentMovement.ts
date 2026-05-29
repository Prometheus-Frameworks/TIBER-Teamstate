import type { TeamstateArtifactInputSource, TeamstateProvenanceStatus } from './teamEnvironmentProfile.js';

export type OffenseMovementDirection = 'improving' | 'declining' | 'stable' | 'insufficient_data';
export type PassEnvironmentMovementDirection = 'more_pass_heavy' | 'less_pass_heavy' | 'stable' | 'insufficient_data';
export type PaceMovementDirection = 'faster' | 'slower' | 'stable' | 'insufficient_data';
export type PressureMovementDirection = 'improving' | 'worsening' | 'stable' | 'insufficient_data';
export type VolatilityMovementDirection = 'rising' | 'falling' | 'stable' | 'insufficient_data';

export interface TeamEnvironmentMovementCoverageV0 {
  teamCount: number;
  teams: string[];
  seasons: number[];
  weeks: number[];
  latestWeek: number | null;
  isFullLeague: boolean;
}

export interface TeamEnvironmentMovementMetadataV0 {
  provenanceStatus: TeamstateProvenanceStatus;
  inputSources: TeamstateArtifactInputSource[];
  coverage: TeamEnvironmentMovementCoverageV0;
}

export interface TeamEnvironmentMovementWindowAveragesV0 {
  pointsPerDrive: number | null;
  epaPerPlay: number | null;
  successRate: number | null;
  explosivePlayRate: number | null;
  pressureRateAllowed: number | null;
  secondsPerPlay: number | null;
  neutralPassRate: number | null;
  fantasyPointsForQB: number | null;
  fantasyPointsForRB: number | null;
  fantasyPointsForWR: number | null;
  fantasyPointsForTE: number | null;
  volatilityScore: number | null;
}

export interface TeamEnvironmentMovementWindowV0 {
  weeks: number[];
  games: number;
  averages: TeamEnvironmentMovementWindowAveragesV0;
}

export type TeamEnvironmentMovementDeltasV0 = Omit<TeamEnvironmentMovementWindowAveragesV0, 'volatilityScore'>;

export interface TeamEnvironmentMovementTeamV0 {
  teamId: string;
  teamAbbr: string;
  season: number;
  weeksCovered: number[];
  earlyWindow: TeamEnvironmentMovementWindowV0;
  lateWindow: TeamEnvironmentMovementWindowV0;
  deltas: TeamEnvironmentMovementDeltasV0;
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

export interface TeamEnvironmentMovementArtifactV0 {
  artifact: 'team_environment_movement_v0';
  generatedAt: string;
  metadata: TeamEnvironmentMovementMetadataV0;
  teams: TeamEnvironmentMovementTeamV0[];
}
