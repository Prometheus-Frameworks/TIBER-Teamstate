export const TEAM_POWER_WEIGHTS = {
  epaPerPlay: 0.2,
  successRate: 0.18,
  pointsPerDrive: 0.18,
  explosivePlayRate: 0.1,
  redZoneTdRate: 0.1,
  turnoverDiscipline: 0.1,
  pressureAvoidance: 0.07,
  sackAvoidance: 0.07
} as const;

export const FANTASY_ENVIRONMENT_WEIGHTS = {
  offensivePlays: 0.17,
  pace: 0.12,
  neutralPassRate: 0.1,
  redZoneTrips: 0.12,
  redZoneTdRate: 0.1,
  explosivePlayRate: 0.1,
  fantasyPointsForQB: 0.08,
  fantasyPointsForRB: 0.08,
  fantasyPointsForWR: 0.08,
  fantasyPointsForTE: 0.05
} as const;

export const MATCHUP_ENVIRONMENT_WEIGHTS = {
  fantasyPointsAllowedQB: 0.22,
  fantasyPointsAllowedRB: 0.22,
  fantasyPointsAllowedWR: 0.24,
  fantasyPointsAllowedTE: 0.16,
  splitAllowanceBoost: 0.16
} as const;

export const STABILITY_WEIGHTS = {
  successRate: 0.2,
  pointsPerDrive: 0.16,
  epaPerPlay: 0.16,
  turnoverDiscipline: 0.16,
  sackAvoidance: 0.12,
  pressureAvoidance: 0.1,
  redZoneSustainability: 0.1
} as const;

export const NORMALIZATION_BOUNDS = {
  epaPerPlay: { min: -0.3, max: 0.4 },
  successRate: { min: 0.3, max: 0.6 },
  pointsPerDrive: { min: 1.0, max: 3.5 },
  explosivePlayRate: { min: 0.04, max: 0.2 },
  redZoneTdRate: { min: 0.3, max: 0.8 },
  turnovers: { min: 0, max: 4 },
  pressureRateAllowed: { min: 0.12, max: 0.45 },
  sacksAllowed: { min: 0, max: 6 },
  offensivePlays: { min: 45, max: 80 },
  secondsPerPlay: { min: 22, max: 34 },
  neutralPassRate: { min: 0.35, max: 0.7 },
  redZoneTrips: { min: 1, max: 7 },
  fantasyPointsForQB: { min: 8, max: 30 },
  fantasyPointsForRB: { min: 8, max: 35 },
  fantasyPointsForWR: { min: 12, max: 45 },
  fantasyPointsForTE: { min: 2, max: 20 },
  fantasyPointsAllowedQB: { min: 8, max: 30 },
  fantasyPointsAllowedRB: { min: 8, max: 38 },
  fantasyPointsAllowedWR: { min: 12, max: 50 },
  fantasyPointsAllowedTE: { min: 3, max: 24 },
  splitAllowance: { min: 0, max: 22 }
} as const;
