import {
  type CurrentMatchupEnvironmentsContract,
  type CurrentOffenseEnvironmentsContract,
  type CurrentSnapshotContract,
  type CurrentSnapshotScope,
  toCurrentPositionalRows,
  toCurrentSnapshotRankingRows
} from '../contracts/currentSnapshot.js';
import type { SeasonToDateReports } from '../reports/types.js';

const TOP_LIMIT = 10;

const toScope = (
  selectedSeason: number | null,
  selectedWeek: number | null,
  seasonsIncluded: number[],
  latestWeekBySeason: Record<number, number>
): CurrentSnapshotScope => ({
  selectedSeason,
  selectedWeek,
  seasonsIncluded,
  latestWeekBySeason
});

export const buildCurrentSnapshotArtifacts = (
  reports: SeasonToDateReports,
  generatedAt: string,
  selectedSeason: number | null,
  selectedWeek: number | null,
  seasonsIncluded: number[],
  latestWeekBySeason: Record<number, number>
): {
  currentSnapshot: CurrentSnapshotContract;
  currentOffenseEnvironments: CurrentOffenseEnvironmentsContract;
  currentMatchupEnvironments: CurrentMatchupEnvironmentsContract;
} => {
  const scope = toScope(selectedSeason, selectedWeek, seasonsIncluded, latestWeekBySeason);

  const stableRows = [...reports.aggregates]
    .sort((a, b) => {
      const diff = b.averages.stabilityScore - a.averages.stabilityScore;
      if (diff !== 0) {
        return diff;
      }

      if (a.season !== b.season) {
        return b.season - a.season;
      }

      return a.team.localeCompare(b.team);
    })
    .map((aggregate, index) => ({
      team: aggregate.team,
      season: aggregate.season,
      latestWeek: aggregate.latestWeek,
      score: Number(aggregate.averages.stabilityScore.toFixed(2)),
      rank: index + 1,
      tags: [...aggregate.tags],
      summary: `Season average stability: ${aggregate.summary}`
    }));

  const volatileRows = [...reports.aggregates]
    .sort((a, b) => {
      const diff = b.averages.volatilityScore - a.averages.volatilityScore;
      if (diff !== 0) {
        return diff;
      }

      if (a.season !== b.season) {
        return b.season - a.season;
      }

      return a.team.localeCompare(b.team);
    })
    .map((aggregate, index) => ({
      team: aggregate.team,
      season: aggregate.season,
      latestWeek: aggregate.latestWeek,
      score: Number(aggregate.averages.volatilityScore.toFixed(2)),
      rank: index + 1,
      tags: [...aggregate.tags],
      summary: `Season average volatility: ${aggregate.summary}`
    }));

  const leastVolatileRows = [...reports.aggregates]
    .sort((a, b) => {
      const diff = a.averages.volatilityScore - b.averages.volatilityScore;
      if (diff !== 0) {
        return diff;
      }

      if (a.season !== b.season) {
        return b.season - a.season;
      }

      return a.team.localeCompare(b.team);
    })
    .map((aggregate, index) => ({
      team: aggregate.team,
      season: aggregate.season,
      latestWeek: aggregate.latestWeek,
      score: Number(aggregate.averages.volatilityScore.toFixed(2)),
      rank: index + 1,
      tags: [...aggregate.tags],
      summary: `Season average volatility: ${aggregate.summary}`
    }));

  const currentSnapshot: CurrentSnapshotContract = {
    generatedAt,
    scope,
    topTeamPower: toCurrentSnapshotRankingRows(reports.rows.teamPower, TOP_LIMIT),
    topFantasyEnvironment: toCurrentSnapshotRankingRows(reports.rows.fantasyEnvironment, TOP_LIMIT),
    topMatchupEnvironment: toCurrentSnapshotRankingRows(reports.rows.matchupEnvironment, TOP_LIMIT),
    mostStableTeams: stableRows.slice(0, TOP_LIMIT),
    mostVolatileTeams: volatileRows.slice(0, TOP_LIMIT),
    leastVolatileTeams: leastVolatileRows.slice(0, TOP_LIMIT)
  };

  const currentOffenseEnvironments: CurrentOffenseEnvironmentsContract = {
    generatedAt,
    scope,
    qb: toCurrentPositionalRows(reports.rows.qbOffenseEnvironment, TOP_LIMIT),
    rb: toCurrentPositionalRows(reports.rows.rbOffenseEnvironment, TOP_LIMIT),
    wr: toCurrentPositionalRows(reports.rows.wrOffenseEnvironment, TOP_LIMIT),
    te: toCurrentPositionalRows(reports.rows.teOffenseEnvironment, TOP_LIMIT)
  };

  const currentMatchupEnvironments: CurrentMatchupEnvironmentsContract = {
    generatedAt,
    scope,
    qb: toCurrentPositionalRows(reports.rows.qbMatchups, TOP_LIMIT),
    rb: toCurrentPositionalRows(reports.rows.rbMatchups, TOP_LIMIT),
    wr: toCurrentPositionalRows(reports.rows.wrMatchups, TOP_LIMIT),
    te: toCurrentPositionalRows(reports.rows.teMatchups, TOP_LIMIT)
  };

  return {
    currentSnapshot,
    currentOffenseEnvironments,
    currentMatchupEnvironments
  };
};
