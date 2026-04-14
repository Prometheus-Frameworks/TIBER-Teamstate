import { FANTASY_ENVIRONMENT_WEIGHTS, NORMALIZATION_BOUNDS } from '../config/weights.js';
import type { TeamWeekInputRow } from '../types/teamstate.js';
import { normalize, weightedAverage } from './utils.js';

export const scoreFantasyEnvironment = (input: TeamWeekInputRow) => {
  const components = {
    offensivePlays: normalize(input.offensivePlays, NORMALIZATION_BOUNDS.offensivePlays.min, NORMALIZATION_BOUNDS.offensivePlays.max),
    pace: normalize(input.secondsPerPlay, NORMALIZATION_BOUNDS.secondsPerPlay.min, NORMALIZATION_BOUNDS.secondsPerPlay.max, true),
    neutralPassRate: normalize(
      input.neutralPassRate,
      NORMALIZATION_BOUNDS.neutralPassRate.min,
      NORMALIZATION_BOUNDS.neutralPassRate.max
    ),
    redZoneTrips: normalize(input.redZoneTrips, NORMALIZATION_BOUNDS.redZoneTrips.min, NORMALIZATION_BOUNDS.redZoneTrips.max),
    redZoneTdRate: normalize(input.redZoneTdRate, NORMALIZATION_BOUNDS.redZoneTdRate.min, NORMALIZATION_BOUNDS.redZoneTdRate.max),
    explosivePlayRate: normalize(input.explosivePlayRate, NORMALIZATION_BOUNDS.explosivePlayRate.min, NORMALIZATION_BOUNDS.explosivePlayRate.max),
    fantasyPointsForQB: normalize(
      input.fantasyPointsForQB,
      NORMALIZATION_BOUNDS.fantasyPointsForQB.min,
      NORMALIZATION_BOUNDS.fantasyPointsForQB.max
    ),
    fantasyPointsForRB: normalize(
      input.fantasyPointsForRB,
      NORMALIZATION_BOUNDS.fantasyPointsForRB.min,
      NORMALIZATION_BOUNDS.fantasyPointsForRB.max
    ),
    fantasyPointsForWR: normalize(
      input.fantasyPointsForWR,
      NORMALIZATION_BOUNDS.fantasyPointsForWR.min,
      NORMALIZATION_BOUNDS.fantasyPointsForWR.max
    ),
    fantasyPointsForTE: normalize(
      input.fantasyPointsForTE,
      NORMALIZATION_BOUNDS.fantasyPointsForTE.min,
      NORMALIZATION_BOUNDS.fantasyPointsForTE.max
    )
  };

  return {
    score: weightedAverage(components, FANTASY_ENVIRONMENT_WEIGHTS),
    components
  };
};
