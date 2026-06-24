import type { TeamWeekRawV0Row } from '../adapters/teamWeekRawV0Adapter.js';

/**
 * Deterministic, all-32-team, weeks 1-6 `team_week_raw_v0` **fixture-scaffold** input builder.
 *
 * Purpose (issue #46, upstream-input-first branch): before a full-league
 * `team_environment_forecast_features_v1` fixture can be produced, Teamstate needs an all-32,
 * weeks 1-6 `team_week_raw_v0`-shaped input to feed the existing movement tooling. No such input
 * exists in the repo today (the only weeks 1-6 input is the 2-team DET/PIT 2025 demo). This builder
 * fills that gap **without inventing football truth**:
 *
 * - Every team-week row carries the SAME neutral placeholder stat values (`NEUTRAL_PLACEHOLDER_STATS`).
 *   Because the values are identical across all 32 teams and all 6 weeks, the fixture encodes **zero**
 *   real per-team or per-week football signal. It is shape/coverage scaffolding, not observed data.
 * - The artifact is honestly labeled `provenanceStatus: fixture_scaffold` with explicit `fixture`
 *   governance (never path inference), and is not governed, production-, or PPM-training-ready.
 *
 * It exists purely to exercise full-league coverage width, deterministic ordering, fail-closed
 * missing-team/week checks, and downstream validator behavior. It does NOT generate any
 * `team_environment_forecast_features_v1` artifact, wire PPM, or run a model.
 */

/** Canonical 32 NFL team codes, alphabetically sorted (the deterministic team ordering). */
export const NFL_TEAM_CODES_32 = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
  'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
  'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
  'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS'
] as const;

/** The weeks the scaffold covers. */
export const SCAFFOLD_WEEKS = [1, 2, 3, 4, 5, 6] as const;

/**
 * Default season for the scaffold. **2024** aligns the scaffold with the PPM target path from #44
 * (2024 team context feeding a future 2025 forecast target); it remains an explicit fixture/scaffold,
 * not real observed 2024 data.
 */
export const SCAFFOLD_SEASON_DEFAULT = 2024;

/**
 * Neutral synthetic placeholder stats, identical for every team and every week on purpose. The
 * uniformity is the honesty guarantee: no row claims a real, distinct football outcome. Fantasy-point
 * fields are zeroed (they are dropped by the movement v1 builder and forbidden on the PPM surface).
 */
const NEUTRAL_PLACEHOLDER_STATS = {
  pointsFor: 21,
  pointsAgainst: 21,
  offensivePlays: 64,
  neutralPlays: 44,
  secondsPerPlay: 28,
  passRate: 0.5,
  neutralPassRate: 0.5,
  rushRate: 0.5,
  epaPerPlay: 0,
  passEpaPerPlay: 0,
  rushEpaPerPlay: 0,
  successRate: 0.45,
  explosivePlayRate: 0.1,
  drives: 10,
  pointsPerDrive: 2,
  redZoneTrips: 3,
  redZoneTdRate: 0.6,
  sacksAllowed: 2,
  pressureRateAllowed: 0.28,
  turnovers: 1,
  fantasyPointsForQB: 0,
  fantasyPointsForRB: 0,
  fantasyPointsForWR: 0,
  fantasyPointsForTE: 0,
  fantasyPointsAllowedQB: 0,
  fantasyPointsAllowedRB: 0,
  fantasyPointsAllowedWR: 0,
  fantasyPointsAllowedTE: 0
} as const;

export interface TeamWeekRawV0ScaffoldGovernance {
  governanceStatus: 'fixture';
  governanceSource: 'explicit_marker';
}

export interface TeamWeekRawV0ScaffoldMetadata {
  provenanceStatus: 'fixture_scaffold';
  governance: TeamWeekRawV0ScaffoldGovernance;
  isFullLeague: boolean;
  isFullRegularSeasonCalendar: false;
  expectedTeamCount: number;
  actualTeamGameRows: number;
  seasons: number[];
  weeks: number[];
  note: string;
}

export interface TeamWeekRawV0FullLeagueScaffoldArtifact {
  artifact: 'team_week_raw_v0';
  metadata: TeamWeekRawV0ScaffoldMetadata;
  rows: TeamWeekRawV0Row[];
}

/**
 * Deterministic opponent assignment: a structural rotation among the canonical codes (never the team
 * itself). This is a placeholder pairing, not a claim about a real 2024 schedule.
 */
const opponentFor = (teamIndex: number, week: number): string => {
  const n = NFL_TEAM_CODES_32.length;
  let oppIndex = (teamIndex + week) % n;
  if (oppIndex === teamIndex) oppIndex = (oppIndex + 1) % n;
  return NFL_TEAM_CODES_32[oppIndex]!;
};

/**
 * Build the all-32, weeks 1-6 `team_week_raw_v0` fixture-scaffold artifact deterministically. Rows
 * are emitted in canonical order: team code ascending, then week ascending.
 */
export function buildTeamWeekRawV0FullLeagueScaffold(
  season: number = SCAFFOLD_SEASON_DEFAULT
): TeamWeekRawV0FullLeagueScaffoldArtifact {
  const rows: TeamWeekRawV0Row[] = [];
  NFL_TEAM_CODES_32.forEach((teamCode, teamIndex) => {
    for (const week of SCAFFOLD_WEEKS) {
      rows.push({
        season,
        week,
        teamCode,
        opponentCode: opponentFor(teamIndex, week),
        ...NEUTRAL_PLACEHOLDER_STATS
      });
    }
  });

  return {
    artifact: 'team_week_raw_v0',
    metadata: {
      provenanceStatus: 'fixture_scaffold',
      governance: { governanceStatus: 'fixture', governanceSource: 'explicit_marker' },
      isFullLeague: true,
      isFullRegularSeasonCalendar: false,
      expectedTeamCount: NFL_TEAM_CODES_32.length,
      actualTeamGameRows: rows.length,
      seasons: [season],
      weeks: [...SCAFFOLD_WEEKS],
      note:
        'Synthetic fixture_scaffold input: all 32 NFL teams over weeks 1-6 with identical neutral ' +
        'placeholder values (no per-team or per-week football signal). Deterministically generated by ' +
        'src/fixtures/teamWeekRawV0FullLeagueScaffold.ts. NOT real observed NFL data, not governed, ' +
        'not production- or PPM-training-ready.'
    },
    rows
  };
}
