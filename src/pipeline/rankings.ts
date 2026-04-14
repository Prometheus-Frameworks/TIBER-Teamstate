import type { TeamTag, TeamWeekState } from '../types/teamstate.js';

export type ScoreKey =
  | 'teamPowerScore'
  | 'fantasyEnvironmentScore'
  | 'matchupEnvironmentScore'
  | 'stabilityScore'
  | 'volatilityScore';

type AllowedPointsKey =
  | 'fantasyPointsAllowedQB'
  | 'fantasyPointsAllowedRB'
  | 'fantasyPointsAllowedWR'
  | 'fantasyPointsAllowedTE';

export interface RankingRow {
  team: string;
  season: number;
  week: number;
  score: number;
  rank: number;
  tags: TeamTag[];
  summary: string;
}

const roundScore = (value: number): number => Number(value.toFixed(2));

const toRankingRow = (state: TeamWeekState, score: number, rank: number): RankingRow => ({
  team: state.team,
  season: state.season,
  week: state.week,
  score: roundScore(score),
  rank,
  tags: [...state.tags],
  summary: state.explanation.summary
});

export const rankByScore = (states: TeamWeekState[], scoreKey: ScoreKey, order: 'desc' | 'asc' = 'desc'): RankingRow[] => {
  const ranked = [...states].sort((a, b) => {
    const scoreA = a.scores[scoreKey];
    const scoreB = b.scores[scoreKey];

    if (scoreA !== scoreB) {
      return order === 'desc' ? scoreB - scoreA : scoreA - scoreB;
    }

    if (a.season !== b.season) {
      return b.season - a.season;
    }

    if (a.week !== b.week) {
      return b.week - a.week;
    }

    return a.team.localeCompare(b.team);
  });

  return ranked.map((state, index) => toRankingRow(state, state.scores[scoreKey], index + 1));
};

export const rankMatchupsByAllowedPoints = (
  states: TeamWeekState[],
  position: 'QB' | 'RB' | 'WR' | 'TE'
): RankingRow[] => {
  const scoreKeyByPosition: Record<'QB' | 'RB' | 'WR' | 'TE', AllowedPointsKey> = {
    QB: 'fantasyPointsAllowedQB',
    RB: 'fantasyPointsAllowedRB',
    WR: 'fantasyPointsAllowedWR',
    TE: 'fantasyPointsAllowedTE'
  };

  const key = scoreKeyByPosition[position];

  const ranked = [...states].sort((a, b) => {
    const diff = b.input[key] - a.input[key];
    if (diff !== 0) {
      return diff;
    }

    if (a.season !== b.season) {
      return b.season - a.season;
    }

    if (a.week !== b.week) {
      return b.week - a.week;
    }

    return a.team.localeCompare(b.team);
  });

  return ranked.map((state, index) => toRankingRow(state, state.input[key], index + 1));
};
