import type { RawTeamWeekRow } from './mapRawTeamWeekToTeamStateInput.js';

type NullableNumber = number | null | undefined;

interface TeamWeekRawV0Row {
  season: number;
  week: number;
  teamCode: string;
  opponentCode: string;
  pointsFor: number;
  pointsAgainst: number;
  offensivePlays: number;
  neutralPlays: number;
  secondsPerPlay: number;
  passRate: number;
  neutralPassRate: number;
  rushRate: number;
  epaPerPlay: number;
  passEpaPerPlay: number;
  rushEpaPerPlay: number;
  successRate: number;
  explosivePlayRate: number;
  drives: number;
  pointsPerDrive: number;
  redZoneTrips: number;
  redZoneTdRate: number;
  sacksAllowed: number;
  pressureRateAllowed: number;
  turnovers: number;
  fantasyPointsForQb: number;
  fantasyPointsForRb: number;
  fantasyPointsForWr: number;
  fantasyPointsForTe: number;
  fantasyPointsAllowedQb: number;
  fantasyPointsAllowedRb: number;
  fantasyPointsAllowedWr: number;
  fantasyPointsAllowedTe: number;
  qbPassAllowed?: NullableNumber;
  qbRushAllowed?: NullableNumber;
  rbRushAllowed?: NullableNumber;
  rbRecAllowed?: NullableNumber;
  wrSlotAllowed?: NullableNumber;
  wrWideAllowed?: NullableNumber;
  teInlineAllowed?: NullableNumber;
  teSplitAllowed?: NullableNumber;
}

interface TeamWeekRawV0Artifact {
  artifact: 'team_week_raw_v0';
  metadata?: { provenanceStatus?: string };
  rows: TeamWeekRawV0Row[];
}

const toOptionalNumber = (value: NullableNumber): number | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid optional split field value: ${String(value)}`);
  }
  return value;
};

const mapRow = (row: TeamWeekRawV0Row): RawTeamWeekRow => ({
  season: row.season,
  week: row.week,
  team_code: row.teamCode,
  opponent_code: row.opponentCode,
  points_for: row.pointsFor,
  points_against: row.pointsAgainst,
  offensive_plays: row.offensivePlays,
  neutral_plays: row.neutralPlays,
  seconds_per_play: row.secondsPerPlay,
  pass_rate: row.passRate,
  neutral_pass_rate: row.neutralPassRate,
  rush_rate: row.rushRate,
  epa_per_play: row.epaPerPlay,
  pass_epa_per_play: row.passEpaPerPlay,
  rush_epa_per_play: row.rushEpaPerPlay,
  success_rate: row.successRate,
  explosive_play_rate: row.explosivePlayRate,
  drives: row.drives,
  points_per_drive: row.pointsPerDrive,
  red_zone_trips: row.redZoneTrips,
  red_zone_td_rate: row.redZoneTdRate,
  sacks_allowed: row.sacksAllowed,
  pressure_rate_allowed: row.pressureRateAllowed,
  turnovers: row.turnovers,
  fantasy_points_for_qb: row.fantasyPointsForQb,
  fantasy_points_for_rb: row.fantasyPointsForRb,
  fantasy_points_for_wr: row.fantasyPointsForWr,
  fantasy_points_for_te: row.fantasyPointsForTe,
  fantasy_points_allowed_qb: row.fantasyPointsAllowedQb,
  fantasy_points_allowed_rb: row.fantasyPointsAllowedRb,
  fantasy_points_allowed_wr: row.fantasyPointsAllowedWr,
  fantasy_points_allowed_te: row.fantasyPointsAllowedTe,
  qb_pass_allowed: toOptionalNumber(row.qbPassAllowed),
  qb_rush_allowed: toOptionalNumber(row.qbRushAllowed),
  rb_rush_allowed: toOptionalNumber(row.rbRushAllowed),
  rb_rec_allowed: toOptionalNumber(row.rbRecAllowed),
  wr_slot_allowed: toOptionalNumber(row.wrSlotAllowed),
  wr_wide_allowed: toOptionalNumber(row.wrWideAllowed),
  te_inline_allowed: toOptionalNumber(row.teInlineAllowed),
  te_split_allowed: toOptionalNumber(row.teSplitAllowed)
});

export const adaptTeamWeekRawV0Artifact = (raw: unknown): { rows: RawTeamWeekRow[]; provenanceStatus: string | null } => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Invalid team_week_raw_v0 artifact: expected object envelope.');
  }

  const artifact = raw as Partial<TeamWeekRawV0Artifact>;
  if (artifact.artifact !== 'team_week_raw_v0') {
    throw new Error(`Invalid artifact literal: expected team_week_raw_v0, received ${String(artifact.artifact)}`);
  }

  if (!Array.isArray(artifact.rows)) {
    throw new Error('Invalid team_week_raw_v0 artifact: rows must be an array.');
  }

  return {
    rows: artifact.rows.map((row, index) => {
      if (typeof row !== 'object' || row === null || Array.isArray(row)) {
        throw new Error(`Invalid team_week_raw_v0 row at index ${index}: expected object.`);
      }
      return mapRow(row as TeamWeekRawV0Row);
    }),
    provenanceStatus: artifact.metadata?.provenanceStatus ?? null
  };
};
