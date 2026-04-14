import { MATCHUP_ENVIRONMENT_WEIGHTS, NORMALIZATION_BOUNDS } from '../config/weights.js';
import type { TeamWeekInputRow } from '../types/teamstate.js';
import { normalize, safeNumber, weightedAverage } from './utils.js';

export const scoreMatchupEnvironment = (input: TeamWeekInputRow) => {
  const splitFields = [
    input.qbPassAllowed,
    input.qbRushAllowed,
    input.rbRushAllowed,
    input.rbRecAllowed,
    input.wrSlotAllowed,
    input.wrWideAllowed,
    input.teInlineAllowed,
    input.teSplitAllowed
  ].filter((value): value is number => Number.isFinite(value));

  const splitAverage = splitFields.length
    ? splitFields.reduce((sum, value) => sum + safeNumber(value), 0) / splitFields.length
    : 0;

  const components = {
    fantasyPointsAllowedQB: normalize(
      input.fantasyPointsAllowedQB,
      NORMALIZATION_BOUNDS.fantasyPointsAllowedQB.min,
      NORMALIZATION_BOUNDS.fantasyPointsAllowedQB.max
    ),
    fantasyPointsAllowedRB: normalize(
      input.fantasyPointsAllowedRB,
      NORMALIZATION_BOUNDS.fantasyPointsAllowedRB.min,
      NORMALIZATION_BOUNDS.fantasyPointsAllowedRB.max
    ),
    fantasyPointsAllowedWR: normalize(
      input.fantasyPointsAllowedWR,
      NORMALIZATION_BOUNDS.fantasyPointsAllowedWR.min,
      NORMALIZATION_BOUNDS.fantasyPointsAllowedWR.max
    ),
    fantasyPointsAllowedTE: normalize(
      input.fantasyPointsAllowedTE,
      NORMALIZATION_BOUNDS.fantasyPointsAllowedTE.min,
      NORMALIZATION_BOUNDS.fantasyPointsAllowedTE.max
    ),
    splitAllowanceBoost: normalize(splitAverage, NORMALIZATION_BOUNDS.splitAllowance.min, NORMALIZATION_BOUNDS.splitAllowance.max)
  };

  return {
    score: weightedAverage(components, MATCHUP_ENVIRONMENT_WEIGHTS),
    components
  };
};
