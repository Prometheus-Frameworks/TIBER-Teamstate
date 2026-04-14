import { NORMALIZATION_BOUNDS, STABILITY_WEIGHTS } from '../config/weights.js';
import type { TeamWeekInputRow } from '../types/teamstate.js';
import { clamp, normalize, weightedAverage } from './utils.js';

export const scoreStability = (input: TeamWeekInputRow) => {
  const redZoneSustainabilityRaw = clamp(100 - Math.abs(input.redZoneTdRate - 0.62) * 200, 0, 100);

  const components = {
    successRate: normalize(input.successRate, NORMALIZATION_BOUNDS.successRate.min, NORMALIZATION_BOUNDS.successRate.max),
    pointsPerDrive: normalize(input.pointsPerDrive, NORMALIZATION_BOUNDS.pointsPerDrive.min, NORMALIZATION_BOUNDS.pointsPerDrive.max),
    epaPerPlay: normalize(input.epaPerPlay, NORMALIZATION_BOUNDS.epaPerPlay.min, NORMALIZATION_BOUNDS.epaPerPlay.max),
    turnoverDiscipline: normalize(input.turnovers, NORMALIZATION_BOUNDS.turnovers.min, NORMALIZATION_BOUNDS.turnovers.max, true),
    sackAvoidance: normalize(input.sacksAllowed, NORMALIZATION_BOUNDS.sacksAllowed.min, NORMALIZATION_BOUNDS.sacksAllowed.max, true),
    pressureAvoidance: normalize(
      input.pressureRateAllowed,
      NORMALIZATION_BOUNDS.pressureRateAllowed.min,
      NORMALIZATION_BOUNDS.pressureRateAllowed.max,
      true
    ),
    redZoneSustainability: redZoneSustainabilityRaw
  };

  const stabilityScore = weightedAverage(components, STABILITY_WEIGHTS);
  const volatilityScore = clamp(
    (100 - stabilityScore) * 0.7 +
      normalize(input.explosivePlayRate, NORMALIZATION_BOUNDS.explosivePlayRate.min, NORMALIZATION_BOUNDS.explosivePlayRate.max) * 0.2 +
      normalize(input.redZoneTdRate, NORMALIZATION_BOUNDS.redZoneTdRate.min, NORMALIZATION_BOUNDS.redZoneTdRate.max) * 0.1,
    0,
    100
  );

  return {
    stabilityScore,
    volatilityScore,
    components
  };
};
