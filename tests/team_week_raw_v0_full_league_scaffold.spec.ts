import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildTeamWeekRawV0FullLeagueScaffold,
  NFL_TEAM_CODES_32,
  SCAFFOLD_WEEKS,
  type TeamWeekRawV0FullLeagueScaffoldArtifact
} from '../src/fixtures/teamWeekRawV0FullLeagueScaffold.js';
import { validateTeamWeekFullLeagueCoverage } from '../src/validation/teamWeekRawV0Coverage.js';
import { adaptTeamWeekRawV0Artifact } from '../src/adapters/teamWeekRawV0Adapter.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(
  here,
  '../data/fixtures/team_week_raw/team_week_raw_v0.all32_weeks1to6.scaffold.json'
);

const loadFixture = (): TeamWeekRawV0FullLeagueScaffoldArtifact =>
  JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as TeamWeekRawV0FullLeagueScaffoldArtifact;

const adaptedRows = () => adaptTeamWeekRawV0Artifact(loadFixture()).rows;

describe('team_week_raw_v0 all-32 weeks 1-6 fixture-scaffold — builder', () => {
  it('is deterministic (identical output across calls)', () => {
    expect(buildTeamWeekRawV0FullLeagueScaffold(2024)).toEqual(buildTeamWeekRawV0FullLeagueScaffold(2024));
  });

  it('matches the committed fixture exactly (committed file is reproducible)', () => {
    expect(loadFixture()).toEqual(buildTeamWeekRawV0FullLeagueScaffold(2024));
  });

  it('covers all 32 teams over weeks 1-6 (192 rows)', () => {
    const artifact = loadFixture();
    expect(artifact.rows).toHaveLength(NFL_TEAM_CODES_32.length * SCAFFOLD_WEEKS.length);
    expect(new Set(artifact.rows.map((r) => r.teamCode)).size).toBe(32);
  });

  it('uses season 2024 for the scaffold', () => {
    expect(new Set(loadFixture().rows.map((r) => r.season))).toEqual(new Set([2024]));
  });

  it('carries no invented per-team football signal (every row shares identical stat values)', () => {
    const statKeys = [
      'pointsFor', 'pointsAgainst', 'offensivePlays', 'neutralPlays', 'secondsPerPlay', 'passRate',
      'neutralPassRate', 'rushRate', 'epaPerPlay', 'successRate', 'explosivePlayRate', 'drives',
      'pointsPerDrive', 'pressureRateAllowed'
    ] as const;
    const rows = loadFixture().rows as unknown as Array<Record<string, number>>;
    for (const key of statKeys) {
      expect(new Set(rows.map((r) => r[key])).size).toBe(1);
    }
  });
});

describe('team_week_raw_v0 all-32 weeks 1-6 fixture-scaffold — honesty labels', () => {
  it('is explicitly fixture_scaffold with fixture/explicit_marker governance, never governed', () => {
    const { metadata } = loadFixture();
    expect(metadata.provenanceStatus).toBe('fixture_scaffold');
    expect(metadata.governance.governanceStatus).toBe('fixture');
    expect(metadata.governance.governanceSource).toBe('explicit_marker');
    expect(metadata.isFullRegularSeasonCalendar).toBe(false);
    // Status fields must not claim governed/real-data (the prose note may say "not governed").
    expect(metadata.governance.governanceStatus).not.toBe('governed');
    expect(metadata.provenanceStatus).not.toBe('governed_real_data');
  });

  it('claims isFullLeague: true and genuinely contains all 32 expected teams', () => {
    const artifact = loadFixture();
    expect(artifact.metadata.isFullLeague).toBe(true);
    expect(artifact.metadata.expectedTeamCount).toBe(32);
    expect(new Set(artifact.rows.map((r) => r.teamCode))).toEqual(new Set(NFL_TEAM_CODES_32));
  });
});

describe('team_week_raw_v0 all-32 weeks 1-6 fixture-scaffold — adapter + coverage', () => {
  it('is accepted by the existing team_week_raw_v0 adapter as fixture_scaffold', () => {
    const adapted = adaptTeamWeekRawV0Artifact(loadFixture());
    expect(adapted.provenanceStatus).toBe('fixture_scaffold');
    expect(adapted.rows).toHaveLength(192);
  });

  it('passes full-league coverage validation (32 teams x weeks 1-6)', () => {
    const result = validateTeamWeekFullLeagueCoverage(adaptedRows(), {
      expectedTeams: NFL_TEAM_CODES_32,
      expectedWeeks: SCAFFOLD_WEEKS
    });
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.isFullLeague).toBe(true);
    expect(result.teamCount).toBe(32);
  });

  it('is emitted in deterministic order: team code ascending, then week ascending', () => {
    const rows = adaptedRows();
    const sorted = [...rows].sort(
      (a, b) => a.team_code.localeCompare(b.team_code) || a.week - b.week
    );
    expect(rows.map((r) => `${r.team_code}-${r.week}`)).toEqual(
      sorted.map((r) => `${r.team_code}-${r.week}`)
    );
  });
});

describe('team_week_raw_v0 full-league coverage validator — fails closed', () => {
  it('fails closed when a team is missing', () => {
    const rows = adaptedRows().filter((r) => r.team_code !== 'KC');
    const result = validateTeamWeekFullLeagueCoverage(rows, {
      expectedTeams: NFL_TEAM_CODES_32,
      expectedWeeks: SCAFFOLD_WEEKS
    });
    expect(result.valid).toBe(false);
    expect(result.isFullLeague).toBe(false);
    expect(result.errors.some((e) => e.includes('missing team "KC"'))).toBe(true);
  });

  it('fails closed when a single team-week is missing', () => {
    const rows = adaptedRows().filter((r) => !(r.team_code === 'SF' && r.week === 4));
    const result = validateTeamWeekFullLeagueCoverage(rows, {
      expectedTeams: NFL_TEAM_CODES_32,
      expectedWeeks: SCAFFOLD_WEEKS
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('team "SF" is missing week 4'))).toBe(true);
  });

  it('fails closed on a duplicate team-week', () => {
    const rows = adaptedRows();
    const result = validateTeamWeekFullLeagueCoverage([...rows, rows[0]!], {
      expectedTeams: NFL_TEAM_CODES_32,
      expectedWeeks: SCAFFOLD_WEEKS
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('duplicate row'))).toBe(true);
  });

  it('fails closed on an unexpected week (out-of-window row, e.g. week 7)', () => {
    const rows = [...adaptedRows(), { team_code: 'ARI', week: 7, season: 2024 }] as Parameters<
      typeof validateTeamWeekFullLeagueCoverage
    >[0];
    const result = validateTeamWeekFullLeagueCoverage(rows, {
      expectedTeams: NFL_TEAM_CODES_32,
      expectedWeeks: SCAFFOLD_WEEKS
    });
    expect(result.valid).toBe(false);
    expect(result.isFullLeague).toBe(false);
    expect(result.errors.some((e) => e.includes('team "ARI" has unexpected week 7'))).toBe(true);
  });

  it('fails closed on an unexpected team', () => {
    const rows = [...adaptedRows(), { team_code: 'XXX', week: 1, season: 2024 }] as Parameters<
      typeof validateTeamWeekFullLeagueCoverage
    >[0];
    const result = validateTeamWeekFullLeagueCoverage(rows, {
      expectedTeams: NFL_TEAM_CODES_32,
      expectedWeeks: SCAFFOLD_WEEKS
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('unexpected team "XXX"'))).toBe(true);
  });
});
