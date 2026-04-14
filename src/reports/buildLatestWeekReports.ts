import type { TeamWeekState } from '../types/teamstate.js';
import type { LatestWeekRankingRow, LatestWeekReports } from './types.js';

const roundScore = (value: number): number => Number(value.toFixed(2));

const getLatestWeekBySeason = (states: TeamWeekState[]): Record<number, number> => {
  const result: Record<number, number> = {};

  for (const state of states) {
    const current = result[state.season];
    if (current === undefined || state.week > current) {
      result[state.season] = state.week;
    }
  }

  return result;
};

const filterLatestWeekStates = (states: TeamWeekState[]): TeamWeekState[] => {
  const latestWeekBySeason = getLatestWeekBySeason(states);
  return states.filter((state) => state.week === latestWeekBySeason[state.season]);
};

const rankLatestWeek = (states: TeamWeekState[], scoreGetter: (state: TeamWeekState) => number): LatestWeekRankingRow[] => {
  const ranked = [...states].sort((a, b) => {
    const diff = scoreGetter(b) - scoreGetter(a);
    if (diff !== 0) {
      return diff;
    }

    if (a.season !== b.season) {
      return b.season - a.season;
    }

    return a.team.localeCompare(b.team);
  });

  return ranked.map((state, index) => ({
    team: state.team,
    season: state.season,
    week: state.week,
    score: roundScore(scoreGetter(state)),
    rank: index + 1,
    tags: [...state.tags],
    summary: state.explanation.summary
  }));
};

export const buildLatestWeekReports = (states: TeamWeekState[]): LatestWeekReports => {
  const latestWeekStates = filterLatestWeekStates(states);
  const latestWeekBySeason = getLatestWeekBySeason(states);

  return {
    latestWeekBySeason,
    rows: {
      teamPower: rankLatestWeek(latestWeekStates, (state) => state.scores.teamPowerScore),
      fantasyEnvironment: rankLatestWeek(latestWeekStates, (state) => state.scores.fantasyEnvironmentScore),
      matchupEnvironment: rankLatestWeek(latestWeekStates, (state) => state.scores.matchupEnvironmentScore),
      qbMatchups: rankLatestWeek(latestWeekStates, (state) => state.input.fantasyPointsAllowedQB),
      rbMatchups: rankLatestWeek(latestWeekStates, (state) => state.input.fantasyPointsAllowedRB),
      wrMatchups: rankLatestWeek(latestWeekStates, (state) => state.input.fantasyPointsAllowedWR),
      teMatchups: rankLatestWeek(latestWeekStates, (state) => state.input.fantasyPointsAllowedTE)
    }
  };
};
