import type { PositionalEnvironmentRow, PositionalMatchupRow, SeasonToDateAggregateRow } from '../reports/types.js';
import type { TeamTag } from '../types/teamstate.js';

export interface CurrentSnapshotRankingRow {
  team: string;
  season: number;
  latestWeek: number;
  score: number;
  rank: number;
  tags: TeamTag[];
  summary: string;
}

export interface CurrentSnapshotScope {
  selectedSeason: number | null;
  selectedWeek: number | null;
  seasonsIncluded: number[];
  latestWeekBySeason: Record<number, number>;
}

export interface CurrentSnapshotContract {
  generatedAt: string;
  scope: CurrentSnapshotScope;
  topTeamPower: CurrentSnapshotRankingRow[];
  topFantasyEnvironment: CurrentSnapshotRankingRow[];
  topMatchupEnvironment: CurrentSnapshotRankingRow[];
  mostStableTeams: CurrentSnapshotRankingRow[];
  mostVolatileTeams: CurrentSnapshotRankingRow[];
  leastVolatileTeams: CurrentSnapshotRankingRow[];
}

export interface CurrentPositionalSnapshotRow {
  team: string;
  season: number;
  latestWeek: number;
  games: number;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  score: number;
  rank: number;
  tags: TeamTag[];
  summary: string;
}

export interface CurrentOffenseEnvironmentsContract {
  generatedAt: string;
  scope: CurrentSnapshotScope;
  qb: CurrentPositionalSnapshotRow[];
  rb: CurrentPositionalSnapshotRow[];
  wr: CurrentPositionalSnapshotRow[];
  te: CurrentPositionalSnapshotRow[];
}

export interface CurrentMatchupEnvironmentsContract {
  generatedAt: string;
  scope: CurrentSnapshotScope;
  qb: CurrentPositionalSnapshotRow[];
  rb: CurrentPositionalSnapshotRow[];
  wr: CurrentPositionalSnapshotRow[];
  te: CurrentPositionalSnapshotRow[];
}

export const toCurrentSnapshotRankingRows = (rows: SeasonToDateAggregateRow[], limit: number): CurrentSnapshotRankingRow[] =>
  rows.slice(0, limit).map((row) => ({
    team: row.team,
    season: row.season,
    latestWeek: row.latestWeek,
    score: row.score,
    rank: row.rank,
    tags: [...row.tags],
    summary: row.summary
  }));

export const toCurrentPositionalRows = (
  rows: PositionalEnvironmentRow[] | PositionalMatchupRow[],
  limit: number
): CurrentPositionalSnapshotRow[] =>
  rows.slice(0, limit).map((row) => ({
    team: row.team,
    season: row.season,
    latestWeek: row.latestWeek,
    games: row.games,
    position: row.position,
    score: row.score,
    rank: row.rank,
    tags: [...row.tags],
    summary: row.summary
  }));
