import type { TeamTag, TeamWeekState } from '../types/teamstate.js';
import { buildPositionalMatchups, buildPositionalOffenseEnvironment } from './positionalEnvironment.js';
import type {
  SeasonToDateAggregateRow,
  SeasonToDateAverages,
  SeasonToDateReports,
  TeamSeasonAggregate
} from './types.js';

const roundScore = (value: number): number => Number(value.toFixed(2));

const aggregateAverage = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

const summarizeTags = (states: TeamWeekState[]): TeamTag[] => {
  const unique = new Set<TeamTag>();
  for (const state of states) {
    for (const tag of state.tags) {
      unique.add(tag);
    }
  }

  return [...unique].sort((a, b) => a.localeCompare(b));
};

const summarizeNarrative = (states: TeamWeekState[]): string => {
  const bySummaryCount = new Map<string, number>();
  for (const state of states) {
    bySummaryCount.set(state.explanation.summary, (bySummaryCount.get(state.explanation.summary) ?? 0) + 1);
  }

  const [summary] = [...bySummaryCount.entries()].sort((a, b) => {
    if (a[1] !== b[1]) {
      return b[1] - a[1];
    }

    return a[0].localeCompare(b[0]);
  })[0] ?? ['No summary available'];

  return summary;
};

const groupByTeamSeason = (states: TeamWeekState[]): Map<string, TeamWeekState[]> => {
  const grouped = new Map<string, TeamWeekState[]>();

  for (const state of states) {
    const key = `${state.season}::${state.team}`;
    const current = grouped.get(key) ?? [];
    current.push(state);
    grouped.set(key, current);
  }

  return grouped;
};

const toAverages = (states: TeamWeekState[]): SeasonToDateAverages => ({
  teamPowerScore: aggregateAverage(states.map((state) => state.scores.teamPowerScore)),
  fantasyEnvironmentScore: aggregateAverage(states.map((state) => state.scores.fantasyEnvironmentScore)),
  matchupEnvironmentScore: aggregateAverage(states.map((state) => state.scores.matchupEnvironmentScore)),
  stabilityScore: aggregateAverage(states.map((state) => state.scores.stabilityScore)),
  volatilityScore: aggregateAverage(states.map((state) => state.scores.volatilityScore)),
  offensivePlays: aggregateAverage(states.map((state) => state.input.offensivePlays)),
  secondsPerPlay: aggregateAverage(states.map((state) => state.input.secondsPerPlay)),
  neutralPassRate: aggregateAverage(states.map((state) => state.input.neutralPassRate)),
  rushRate: aggregateAverage(states.map((state) => state.input.rushRate)),
  redZoneTrips: aggregateAverage(states.map((state) => state.input.redZoneTrips)),
  redZoneTdRate: aggregateAverage(states.map((state) => state.input.redZoneTdRate)),
  explosivePlayRate: aggregateAverage(states.map((state) => state.input.explosivePlayRate)),
  fantasyPointsForQB: aggregateAverage(states.map((state) => state.input.fantasyPointsForQB)),
  fantasyPointsForRB: aggregateAverage(states.map((state) => state.input.fantasyPointsForRB)),
  fantasyPointsForWR: aggregateAverage(states.map((state) => state.input.fantasyPointsForWR)),
  fantasyPointsForTE: aggregateAverage(states.map((state) => state.input.fantasyPointsForTE)),
  fantasyPointsAllowedQB: aggregateAverage(states.map((state) => state.input.fantasyPointsAllowedQB)),
  fantasyPointsAllowedRB: aggregateAverage(states.map((state) => state.input.fantasyPointsAllowedRB)),
  fantasyPointsAllowedWR: aggregateAverage(states.map((state) => state.input.fantasyPointsAllowedWR)),
  fantasyPointsAllowedTE: aggregateAverage(states.map((state) => state.input.fantasyPointsAllowedTE))
});

const buildTeamSeasonAggregates = (states: TeamWeekState[]): TeamSeasonAggregate[] => {
  const grouped = groupByTeamSeason(states);

  return [...grouped.entries()]
    .map(([key, group]) => {
      const [seasonToken, team] = key.split('::');
      const season = Number(seasonToken);
      const latestWeek = Math.max(...group.map((state) => state.week));

      return {
        team,
        season,
        games: group.length,
        latestWeek,
        tags: summarizeTags(group),
        summary: summarizeNarrative(group),
        averages: toAverages(group)
      };
    })
    .sort((a, b) => {
      if (a.season !== b.season) {
        return b.season - a.season;
      }

      if (a.latestWeek !== b.latestWeek) {
        return b.latestWeek - a.latestWeek;
      }

      return a.team.localeCompare(b.team);
    });
};

const rankAggregateRows = (
  aggregates: TeamSeasonAggregate[],
  scoreGetter: (aggregate: TeamSeasonAggregate) => number,
  label: string
): SeasonToDateAggregateRow[] => {
  const ranked = [...aggregates].sort((a, b) => {
    const diff = scoreGetter(b) - scoreGetter(a);
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

  return ranked.map((aggregate, index) => ({
    team: aggregate.team,
    season: aggregate.season,
    latestWeek: aggregate.latestWeek,
    games: aggregate.games,
    score: roundScore(scoreGetter(aggregate)),
    rank: index + 1,
    tags: [...aggregate.tags],
    summary: `${label}: ${aggregate.summary}`
  }));
};

export const buildSeasonToDateReports = (states: TeamWeekState[]): SeasonToDateReports => {
  const aggregates = buildTeamSeasonAggregates(states);

  return {
    aggregates,
    rows: {
      teamPower: rankAggregateRows(aggregates, (aggregate) => aggregate.averages.teamPowerScore, 'Season average team power'),
      fantasyEnvironment: rankAggregateRows(
        aggregates,
        (aggregate) => aggregate.averages.fantasyEnvironmentScore,
        'Season average fantasy environment'
      ),
      matchupEnvironment: rankAggregateRows(
        aggregates,
        (aggregate) => aggregate.averages.matchupEnvironmentScore,
        'Season average matchup environment'
      ),
      qbOffenseEnvironment: buildPositionalOffenseEnvironment(aggregates, 'QB'),
      rbOffenseEnvironment: buildPositionalOffenseEnvironment(aggregates, 'RB'),
      wrOffenseEnvironment: buildPositionalOffenseEnvironment(aggregates, 'WR'),
      teOffenseEnvironment: buildPositionalOffenseEnvironment(aggregates, 'TE'),
      qbMatchups: buildPositionalMatchups(aggregates, 'QB'),
      rbMatchups: buildPositionalMatchups(aggregates, 'RB'),
      wrMatchups: buildPositionalMatchups(aggregates, 'WR'),
      teMatchups: buildPositionalMatchups(aggregates, 'TE')
    }
  };
};
