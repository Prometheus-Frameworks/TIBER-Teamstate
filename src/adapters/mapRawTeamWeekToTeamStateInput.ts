import type { TeamWeekInputRow } from '../types/teamstate.js';

export interface RawTeamWeekRow {
  season: number;
  week: number;
  team_code: string;
  opponent_code: string;
  points_for: number;
  points_against: number;
  offensive_plays: number;
  neutral_plays: number;
  seconds_per_play: number;
  pass_rate: number;
  neutral_pass_rate: number;
  rush_rate: number;
  epa_per_play: number;
  pass_epa_per_play: number;
  rush_epa_per_play: number;
  success_rate: number;
  explosive_play_rate: number;
  drives: number;
  points_per_drive: number;
  red_zone_trips: number;
  red_zone_td_rate: number;
  sacks_allowed: number;
  pressure_rate_allowed: number;
  turnovers: number;
  fantasy_points_for_qb: number;
  fantasy_points_for_rb: number;
  fantasy_points_for_wr: number;
  fantasy_points_for_te: number;
  fantasy_points_allowed_qb: number;
  fantasy_points_allowed_rb: number;
  fantasy_points_allowed_wr: number;
  fantasy_points_allowed_te: number;
  qb_pass_allowed?: number;
  qb_rush_allowed?: number;
  rb_rush_allowed?: number;
  rb_rec_allowed?: number;
  wr_slot_allowed?: number;
  wr_wide_allowed?: number;
  te_inline_allowed?: number;
  te_split_allowed?: number;
}

const toNumberOrUndefined = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return value;
};

const mapRawRow = (raw: RawTeamWeekRow): TeamWeekInputRow => ({
  season: raw.season,
  week: raw.week,
  team: raw.team_code,
  opponent: raw.opponent_code,
  pointsFor: raw.points_for,
  pointsAgainst: raw.points_against,
  offensivePlays: raw.offensive_plays,
  neutralPlays: raw.neutral_plays,
  secondsPerPlay: raw.seconds_per_play,
  passRate: raw.pass_rate,
  neutralPassRate: raw.neutral_pass_rate,
  rushRate: raw.rush_rate,
  epaPerPlay: raw.epa_per_play,
  passEpaPerPlay: raw.pass_epa_per_play,
  rushEpaPerPlay: raw.rush_epa_per_play,
  successRate: raw.success_rate,
  explosivePlayRate: raw.explosive_play_rate,
  drives: raw.drives,
  pointsPerDrive: raw.points_per_drive,
  redZoneTrips: raw.red_zone_trips,
  redZoneTdRate: raw.red_zone_td_rate,
  sacksAllowed: raw.sacks_allowed,
  pressureRateAllowed: raw.pressure_rate_allowed,
  turnovers: raw.turnovers,
  fantasyPointsForQB: raw.fantasy_points_for_qb,
  fantasyPointsForRB: raw.fantasy_points_for_rb,
  fantasyPointsForWR: raw.fantasy_points_for_wr,
  fantasyPointsForTE: raw.fantasy_points_for_te,
  fantasyPointsAllowedQB: raw.fantasy_points_allowed_qb,
  fantasyPointsAllowedRB: raw.fantasy_points_allowed_rb,
  fantasyPointsAllowedWR: raw.fantasy_points_allowed_wr,
  fantasyPointsAllowedTE: raw.fantasy_points_allowed_te,
  qbPassAllowed: toNumberOrUndefined(raw.qb_pass_allowed),
  qbRushAllowed: toNumberOrUndefined(raw.qb_rush_allowed),
  rbRushAllowed: toNumberOrUndefined(raw.rb_rush_allowed),
  rbRecAllowed: toNumberOrUndefined(raw.rb_rec_allowed),
  wrSlotAllowed: toNumberOrUndefined(raw.wr_slot_allowed),
  wrWideAllowed: toNumberOrUndefined(raw.wr_wide_allowed),
  teInlineAllowed: toNumberOrUndefined(raw.te_inline_allowed),
  teSplitAllowed: toNumberOrUndefined(raw.te_split_allowed)
});

export const mapRawTeamWeekToTeamStateInput = (rows: RawTeamWeekRow[]): TeamWeekInputRow[] => rows.map(mapRawRow);
