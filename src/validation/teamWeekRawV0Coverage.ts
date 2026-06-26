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

/**
 * Fail-closed bye-aware coverage validation for real NFL regular-season `team_week_raw_v0`-style
 * team-week rows (e.g. the 2024 candidate: 32 teams, Weeks 1-18, 17 game rows per team, 544 total
 * rows). This is a **separate, explicitly-invoked mode** from
 * {@link validateTeamWeekFullLeagueCoverage} — it never substitutes for the dense-grid validator and
 * the dense-grid validator's behavior is unchanged by this addition.
 *
 * Unlike the dense grid (which requires every expected team to have a row for every expected week),
 * a real season has exactly one bye week per team somewhere inside the expected week window. This
 * validator never requires a row for a team's bye week and never synthesizes one — it only asserts
 * that, within the expected week window, each expected team has **exactly** `expectedGamesPerTeam`
 * game rows, with no duplicates, no unexpected teams, and no rows outside the window.
 */
export interface ByeAwareCoverageExpectation {
  expectedTeams: readonly string[];
  /** The full regular-season week window (e.g. 1-18), not a per-team schedule. */
  expectedWeeks: readonly number[];
  /** Expected game rows per team within the window (e.g. 17 for an 18-week season with one bye). */
  expectedGamesPerTeam: number;
  /**
   * The single season this candidate must represent (e.g. 2024). Required and checked against every
   * row's `season`: without this, a row from a different season sharing a `(team_code, week)` pair
   * with a missing 2024 row would satisfy the team/week/count checks and let a mixed-season artifact
   * report `isFullLeague: true`.
   */
  expectedSeason: number;
}

export interface ByeAwareCoverageValidationResult {
  valid: boolean;
  errors: string[];
  /** Distinct team codes actually present in the rows. */
  teamCount: number;
  /** Total row count across all teams (`rows.length`). */
  totalRowCount: number;
  /** True only when every expected team is present with exactly `expectedGamesPerTeam` rows, no extras, no duplicates, no out-of-window rows. */
  isFullLeague: boolean;
}

/**
 * Validate that `rows` cover exactly the expected teams, each with exactly `expectedGamesPerTeam`
 * game rows inside the expected week window — never requiring or synthesizing a row for a team's bye
 * week. Fails closed (collects every problem) rather than throwing, mirroring
 * {@link validateTeamWeekFullLeagueCoverage}'s style so callers can surface all gaps at once.
 *
 * Failure messages are deliberately distinct from the dense-grid validator's `"is missing week N"`
 * message: a missing bye week is never itself an error here, so failures are phrased in terms of a
 * team's total game-row count (e.g. `"has 16 game row(s), expected exactly 17"`), not a specific
 * missing week.
 *
 * Every row's `season` is also checked against `expectedSeason`: without this, a row from a
 * different season sharing a `(team_code, week)` pair with a missing expected-season row would
 * satisfy the team/week/count checks and let a mixed-season artifact report `isFullLeague: true`.
 */
export function validateTeamWeekByeAwareCoverage(
  rows: readonly TeamWeekCoverageRow[],
  expectation: ByeAwareCoverageExpectation
): ByeAwareCoverageValidationResult {
  const errors: string[] = [];
  const expectedTeams = [...expectation.expectedTeams];
  const expectedWeeks = [...expectation.expectedWeeks];
  const expectedGamesPerTeam = expectation.expectedGamesPerTeam;
  const expectedSeason = expectation.expectedSeason;
  const expectedTeamSet = new Set(expectedTeams);
  const expectedWeekSet = new Set(expectedWeeks);
  const sortedExpectedWeeks = [...expectedWeekSet].sort((a, b) => a - b).join(', ');

  // Track both: distinct weeks seen per team (for duplicate + window detection, mirroring the
  // dense-grid validator) and a raw row count per team (for the "expected exactly N rows" check,
  // which must catch a duplicate inflating a team's count, not just a missing/extra distinct week).
  const weeksByTeam = new Map<string, Set<number>>();
  const rowCountByTeam = new Map<string, number>();
  for (const row of rows) {
    rowCountByTeam.set(row.team_code, (rowCountByTeam.get(row.team_code) ?? 0) + 1);
    if (!weeksByTeam.has(row.team_code)) {
      weeksByTeam.set(row.team_code, new Set<number>());
    }
    const weeks = weeksByTeam.get(row.team_code)!;
    if (weeks.has(row.week)) {
      errors.push(`duplicate row for team "${row.team_code}" week ${row.week}`);
    }
    weeks.add(row.week);

    // A row from another season sharing this team/week could otherwise stand in for a missing
    // expectedSeason row and still satisfy every other check, so season is checked per-row.
    if (row.season !== expectedSeason) {
      errors.push(
        `team "${row.team_code}" week ${row.week} has season ${row.season ?? 'undefined'}, ` +
          `expected season ${expectedSeason}`
      );
    }
  }

  // Every expected team must be present with exactly expectedGamesPerTeam rows. A bye week is an
  // absence within the window, never an error on its own — only the total count is checked.
  for (const team of expectedTeams) {
    const rowCount = rowCountByTeam.get(team) ?? 0;
    if (rowCount === 0) {
      errors.push(`missing team "${team}" (no rows)`);
      continue;
    }
    if (rowCount !== expectedGamesPerTeam) {
      errors.push(
        `team "${team}" has ${rowCount} game row(s), expected exactly ${expectedGamesPerTeam} ` +
          `(bye-aware: an absent week is treated as a bye, not a coverage gap, but the total ` +
          `game-row count must still match exactly)`
      );
    }
  }

  // No unexpected teams.
  for (const team of weeksByTeam.keys()) {
    if (!expectedTeamSet.has(team)) {
      errors.push(`unexpected team "${team}" not in expected set`);
    }
  }

  // No rows outside the expected regular-season week window. Unlike the dense grid, a week being
  // absent is fine (a bye); a week being present but outside the window is not.
  for (const [team, weeks] of weeksByTeam) {
    for (const week of weeks) {
      if (!expectedWeekSet.has(week)) {
        errors.push(
          `team "${team}" has out-of-window week ${week} (expected window weeks: ${sortedExpectedWeeks})`
        );
      }
    }
  }

  const teamCount = weeksByTeam.size;
  const totalRowCount = rows.length;
  const expectedTotalRowCount = expectedTeams.length * expectedGamesPerTeam;
  if (totalRowCount !== expectedTotalRowCount) {
    errors.push(
      `total row count (${totalRowCount}) must equal ${expectedTotalRowCount} ` +
        `(expectedTeams.length * expectedGamesPerTeam)`
    );
  }

  const isFullLeague = errors.length === 0 && teamCount === expectedTeams.length;

  return { valid: errors.length === 0, errors, teamCount, totalRowCount, isFullLeague };
}
