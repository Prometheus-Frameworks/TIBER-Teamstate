import type { TeamSeasonAggregate } from './types.js';
import type { Position, PositionalEnvironmentRow, PositionalMatchupRow } from './types.js';

const roundScore = (value: number): number => Number(value.toFixed(2));

const paceBoost = (secondsPerPlay: number): number => Math.max(0, 40 - secondsPerPlay) * 2.5;

const scoreQBOffenseEnvironment = (row: TeamSeasonAggregate): number =>
  row.averages.fantasyPointsForQB * 0.45 +
  row.averages.neutralPassRate * 25 +
  row.averages.offensivePlays * 0.25 +
  paceBoost(row.averages.secondsPerPlay) * 0.3 +
  row.averages.teamPowerScore * 0.15;

const scoreRBOffenseEnvironment = (row: TeamSeasonAggregate): number =>
  row.averages.fantasyPointsForRB * 0.45 +
  row.averages.redZoneTrips * 2.2 +
  row.averages.redZoneTdRate * 20 +
  row.averages.rushRate * 20 +
  row.averages.fantasyEnvironmentScore * 0.15;

const scoreWROffenseEnvironment = (row: TeamSeasonAggregate): number =>
  row.averages.fantasyPointsForWR * 0.5 +
  row.averages.neutralPassRate * 25 +
  row.averages.offensivePlays * 0.2 +
  paceBoost(row.averages.secondsPerPlay) * 0.2 +
  row.averages.explosivePlayRate * 80;

const scoreTEOffenseEnvironment = (row: TeamSeasonAggregate): number =>
  row.averages.fantasyPointsForTE * 0.6 +
  row.averages.redZoneTdRate * 20 +
  row.averages.neutralPassRate * 10 +
  row.averages.stabilityScore * 0.15;

const scoreByPosition: Record<Position, (row: TeamSeasonAggregate) => number> = {
  QB: scoreQBOffenseEnvironment,
  RB: scoreRBOffenseEnvironment,
  WR: scoreWROffenseEnvironment,
  TE: scoreTEOffenseEnvironment
};

const scoreMatchupByPosition = (row: TeamSeasonAggregate, position: Position): number => {
  const lookup: Record<Position, number> = {
    QB: row.averages.fantasyPointsAllowedQB,
    RB: row.averages.fantasyPointsAllowedRB,
    WR: row.averages.fantasyPointsAllowedWR,
    TE: row.averages.fantasyPointsAllowedTE
  };

  return lookup[position];
};

const rankAggregates = (
  aggregates: TeamSeasonAggregate[],
  scoreBuilder: (row: TeamSeasonAggregate) => number,
  rowBuilder: (row: TeamSeasonAggregate, score: number, rank: number) => PositionalEnvironmentRow | PositionalMatchupRow
): PositionalEnvironmentRow[] | PositionalMatchupRow[] => {
  const ranked = [...aggregates].sort((a, b) => {
    const diff = scoreBuilder(b) - scoreBuilder(a);
    if (diff !== 0) {
      return diff;
    }

    if (a.season !== b.season) {
      return b.season - a.season;
    }

    if (a.latestWeek !== b.latestWeek) {
      return b.latestWeek - a.latestWeek;
    }

    return a.team.localeCompare(b.team);
  });

  return ranked.map((row, index) => rowBuilder(row, roundScore(scoreBuilder(row)), index + 1));
};

export const buildPositionalOffenseEnvironment = (
  aggregates: TeamSeasonAggregate[],
  position: Position
): PositionalEnvironmentRow[] =>
  rankAggregates(aggregates, scoreByPosition[position], (row, score, rank) => ({
    team: row.team,
    season: row.season,
    latestWeek: row.latestWeek,
    games: row.games,
    position,
    score,
    rank,
    tags: [...row.tags],
    summary: `${position} offense environment from production + pace/usage context.`
  })) as PositionalEnvironmentRow[];

export const buildPositionalMatchups = (aggregates: TeamSeasonAggregate[], position: Position): PositionalMatchupRow[] =>
  rankAggregates(aggregates, (row) => scoreMatchupByPosition(row, position), (row, score, rank) => ({
    team: row.team,
    season: row.season,
    latestWeek: row.latestWeek,
    games: row.games,
    position,
    score,
    rank,
    tags: [...row.tags],
    summary: `${position} matchup environment based on fantasy points allowed.`
  })) as PositionalMatchupRow[];
