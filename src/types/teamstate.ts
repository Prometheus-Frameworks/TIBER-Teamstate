export interface TeamWeekInputRow {
  season: number;
  week: number;
  team: string;
  opponent: string;

  pointsFor: number;
  pointsAgainst: number;

  offensivePlays: number;
  neutralPlays: number;
  secondsPerPlay: number;

  passRate: number;
  neutralPassRate: number;
  rushRate: number;

  epaPerPlay: number;
  passEpaPerPlay: number;
  rushEpaPerPlay: number;

  successRate: number;
  explosivePlayRate: number;

  drives: number;
  pointsPerDrive: number;

  redZoneTrips: number;
  redZoneTdRate: number;

  sacksAllowed: number;
  pressureRateAllowed: number;
  turnovers: number;

  fantasyPointsForQB: number;
  fantasyPointsForRB: number;
  fantasyPointsForWR: number;
  fantasyPointsForTE: number;

  fantasyPointsAllowedQB: number;
  fantasyPointsAllowedRB: number;
  fantasyPointsAllowedWR: number;
  fantasyPointsAllowedTE: number;

  qbPassAllowed?: number;
  qbRushAllowed?: number;
  rbRushAllowed?: number;
  rbRecAllowed?: number;
  wrSlotAllowed?: number;
  wrWideAllowed?: number;
  teInlineAllowed?: number;
  teSplitAllowed?: number;
}

export interface TeamScoreBreakdown {
  teamPowerScore: number;
  fantasyEnvironmentScore: number;
  matchupEnvironmentScore: number;
  stabilityScore: number;
  volatilityScore: number;
}

export interface TeamScoreComponents {
  teamPower: Record<string, number>;
  fantasyEnvironment: Record<string, number>;
  matchupEnvironment: Record<string, number>;
  stability: Record<string, number>;
}

export interface TeamExplanation {
  summary: string;
  strengths: string[];
  risks: string[];
  tags: TeamTag[];
}

export type TeamTag =
  | 'elite_real_life_team'
  | 'elite_fantasy_environment'
  | 'pass_funnel_offense'
  | 'run_heavy_low_ceiling'
  | 'red_zone_machine'
  | 'explosive_but_volatile'
  | 'stable_environment'
  | 'fraudulent_td_environment'
  | 'qb_friendly_matchup'
  | 'wr_slot_funnel_defense'
  | 'te_dead_zone_defense';

export interface TeamWeekState {
  season: number;
  week: number;
  team: string;
  opponent: string;
  input: TeamWeekInputRow;
  scores: TeamScoreBreakdown;
  components: TeamScoreComponents;
  tags: TeamTag[];
  explanation: TeamExplanation;
}
