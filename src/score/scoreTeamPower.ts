import { NORMALIZATION_BOUNDS, TEAM_POWER_WEIGHTS } from '../config/weights.js';
import type { TeamWeekInputRow } from '../types/teamstate.js';
import { normalize, weightedAverage } from './utils.js';

export const scoreTeamPower = (input: TeamWeekInputRow) => {
  const components = {
    epaPerPlay: normalize(input.epaPerPlay, NORMALIZATION_BOUNDS.epaPerPlay.min, NORMALIZATION_BOUNDS.epaPerPlay.max),
    successRate: normalize(input.successRate, NORMALIZATION_BOUNDS.successRate.min, NORMALIZATION_BOUNDS.successRate.max),
    pointsPerDrive: normalize(input.pointsPerDrive, NORMALIZATION_BOUNDS.pointsPerDrive.min, NORMALIZATION_BOUNDS.pointsPerDrive.max),
    explosivePlayRate: normalize(input.explosivePlayRate, NORMALIZATION_BOUNDS.explosivePlayRate.min, NORMALIZATION_BOUNDS.explosivePlayRate.max),
    redZoneTdRate: normalize(input.redZoneTdRate, NORMALIZATION_BOUNDS.redZoneTdRate.min, NORMALIZATION_BOUNDS.redZoneTdRate.max),
    turnoverDiscipline: normalize(input.turnovers, NORMALIZATION_BOUNDS.turnovers.min, NORMALIZATION_BOUNDS.turnovers.max, true),
    pressureAvoidance: normalize(
      input.pressureRateAllowed,
      NORMALIZATION_BOUNDS.pressureRateAllowed.min,
      NORMALIZATION_BOUNDS.pressureRateAllowed.max,
      true
    ),
    sackAvoidance: normalize(input.sacksAllowed, NORMALIZATION_BOUNDS.sacksAllowed.min, NORMALIZATION_BOUNDS.sacksAllowed.max, true)
  };

  return {
    score: weightedAverage(components, TEAM_POWER_WEIGHTS),
    components
  };
};
