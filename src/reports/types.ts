import type { TeamTag } from '../types/teamstate.js';

export type Position = 'QB' | 'RB' | 'WR' | 'TE';

export interface ReportRowBase {
  team: string;
  season: number;
  score: number;
  rank: number;
  tags: TeamTag[];
  summary: string;
}

export interface LatestWeekRankingRow extends ReportRowBase {
  week: number;
}

export interface SeasonToDateAverages {
  teamPowerScore: number;
  fantasyEnvironmentScore: number;
  matchupEnvironmentScore: number;
  stabilityScore: number;
  volatilityScore: number;
  offensivePlays: number;
  neutralPassRate: number;
  redZoneTrips: number;
  redZoneTdRate: number;
  fantasyPointsForQB: number;
  fantasyPointsForRB: number;
  fantasyPointsForWR: number;
  fantasyPointsForTE: number;
  fantasyPointsAllowedQB: number;
  fantasyPointsAllowedRB: number;
  fantasyPointsAllowedWR: number;
  fantasyPointsAllowedTE: number;
}

export interface TeamSeasonAggregate {
  team: string;
  season: number;
  games: number;
  latestWeek: number;
  tags: TeamTag[];
  summary: string;
  averages: SeasonToDateAverages;
}

export interface SeasonToDateAggregateRow extends ReportRowBase {
  latestWeek: number;
  games: number;
}

export interface PositionalEnvironmentRow extends ReportRowBase {
  latestWeek: number;
  games: number;
  position: Position;
}

export interface PositionalMatchupRow extends ReportRowBase {
  latestWeek: number;
  games: number;
  position: Position;
}

export interface LatestWeekReports {
  latestWeekBySeason: Record<number, number>;
  rows: {
    teamPower: LatestWeekRankingRow[];
    fantasyEnvironment: LatestWeekRankingRow[];
    matchupEnvironment: LatestWeekRankingRow[];
    qbMatchups: LatestWeekRankingRow[];
    rbMatchups: LatestWeekRankingRow[];
    wrMatchups: LatestWeekRankingRow[];
    teMatchups: LatestWeekRankingRow[];
  };
}

export interface SeasonToDateReports {
  aggregates: TeamSeasonAggregate[];
  rows: {
    teamPower: SeasonToDateAggregateRow[];
    fantasyEnvironment: SeasonToDateAggregateRow[];
    matchupEnvironment: SeasonToDateAggregateRow[];
    qbOffenseEnvironment: PositionalEnvironmentRow[];
    rbOffenseEnvironment: PositionalEnvironmentRow[];
    wrOffenseEnvironment: PositionalEnvironmentRow[];
    teOffenseEnvironment: PositionalEnvironmentRow[];
    qbMatchups: PositionalMatchupRow[];
    rbMatchups: PositionalMatchupRow[];
    wrMatchups: PositionalMatchupRow[];
    teMatchups: PositionalMatchupRow[];
  };
}
