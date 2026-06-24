/**
 * Fail-closed full-league / weeks coverage validation for `team_week_raw_v0`-style team-week rows.
 *
 * This is the coverage gate the all-32 weeks 1-6 fixture-scaffold (issue #46) must pass before any
 * downstream full-league `team_environment_forecast_features_v1` step. It is deliberately
 * data-derived: coverage is computed from the actual rows, never trusted from metadata. A row set
 * that is missing a team, missing a week for a team, carries a duplicate (team, week), or contains an
 * unexpected team fails closed.
 */

/** Minimal team-week shape this validator needs (works on adapted `RawTeamWeekRow`s: `team_code`/`week`). */
export interface TeamWeekCoverageRow {
  team_code: string;
  week: number;
  season?: number;
}

export interface FullLeagueCoverageExpectation {
  expectedTeams: readonly string[];
  expectedWeeks: readonly number[];
}

export interface CoverageValidationResult {
  valid: boolean;
  errors: string[];
  /** Distinct team codes actually present in the rows. */
  teamCount: number;
  /** True only when every expected team is present with every expected week, no extras, no duplicates. */
  isFullLeague: boolean;
}

/**
 * Validate that `rows` cover exactly the expected teams, each with exactly the expected weeks. Fails
 * closed (collects every problem) rather than throwing, mirroring the forecast-features validator
 * style so callers can surface all gaps at once.
 */
export function validateTeamWeekFullLeagueCoverage(
  rows: readonly TeamWeekCoverageRow[],
  expectation: FullLeagueCoverageExpectation
): CoverageValidationResult {
  const errors: string[] = [];
  const expectedTeams = [...expectation.expectedTeams];
  const expectedWeeks = [...expectation.expectedWeeks];
  const expectedTeamSet = new Set(expectedTeams);
  const expectedWeekSet = new Set(expectedWeeks);

  // Map each team -> set of weeks seen, flagging duplicate (team, week) pairs.
  const weeksByTeam = new Map<string, Set<number>>();
  for (const row of rows) {
    if (!weeksByTeam.has(row.team_code)) {
      weeksByTeam.set(row.team_code, new Set<number>());
    }
    const weeks = weeksByTeam.get(row.team_code)!;
    if (weeks.has(row.week)) {
      errors.push(`duplicate row for team "${row.team_code}" week ${row.week}`);
    }
    weeks.add(row.week);
  }

  // Every expected team must be present with every expected week.
  for (const team of expectedTeams) {
    const weeks = weeksByTeam.get(team);
    if (!weeks) {
      errors.push(`missing team "${team}" (no rows)`);
      continue;
    }
    for (const week of expectedWeeks) {
      if (!weeks.has(week)) {
        errors.push(`team "${team}" is missing week ${week}`);
      }
    }
  }

  // No unexpected teams.
  for (const team of weeksByTeam.keys()) {
    if (!expectedTeamSet.has(team)) {
      errors.push(`unexpected team "${team}" not in expected set`);
    }
  }

  // No unexpected weeks. Rows outside the expected window (e.g. a week 7 row in a weeks 1-6 gate)
  // must fail closed, otherwise post-window data could leak into downstream feature generation while
  // coverage still reports full-league.
  for (const [team, weeks] of weeksByTeam) {
    for (const week of weeks) {
      if (!expectedWeekSet.has(week)) {
        errors.push(`team "${team}" has unexpected week ${week} (outside expected weeks)`);
      }
    }
  }

  const teamCount = weeksByTeam.size;
  const isFullLeague = errors.length === 0 && teamCount === expectedTeams.length;

  return { valid: errors.length === 0, errors, teamCount, isFullLeague };
}
