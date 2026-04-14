import type { TeamTag, TeamWeekInputRow, TeamScoreBreakdown } from '../types/teamstate.js';

export const deriveTeamTags = (input: TeamWeekInputRow, scores: TeamScoreBreakdown): TeamTag[] => {
  const tags: TeamTag[] = [];

  if (scores.teamPowerScore >= 80) tags.push('elite_real_life_team');
  if (scores.fantasyEnvironmentScore >= 80) tags.push('elite_fantasy_environment');
  if (input.neutralPassRate >= 0.6 && input.rushRate <= 0.42) tags.push('pass_funnel_offense');
  if (input.rushRate >= 0.52 && scores.fantasyEnvironmentScore < 60) tags.push('run_heavy_low_ceiling');
  if (input.redZoneTrips >= 5 && input.redZoneTdRate >= 0.65) tags.push('red_zone_machine');
  if (input.explosivePlayRate >= 0.14 && scores.volatilityScore >= 65) tags.push('explosive_but_volatile');
  if (scores.stabilityScore >= 72 && scores.volatilityScore <= 38) tags.push('stable_environment');
  if (input.redZoneTdRate >= 0.72 && input.pointsPerDrive < 2.0) tags.push('fraudulent_td_environment');
  if (input.fantasyPointsAllowedQB >= 22) tags.push('qb_friendly_matchup');
  if ((input.wrSlotAllowed ?? 0) >= 16 && (input.wrSlotAllowed ?? 0) > (input.wrWideAllowed ?? 0) + 2) {
    tags.push('wr_slot_funnel_defense');
  }
  if (input.fantasyPointsAllowedTE <= 7 && (input.teInlineAllowed ?? 0) <= 4 && (input.teSplitAllowed ?? 0) <= 4) {
    tags.push('te_dead_zone_defense');
  }

  return tags;
};
