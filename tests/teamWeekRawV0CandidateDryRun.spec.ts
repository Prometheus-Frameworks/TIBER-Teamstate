import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  dryRunTeamWeekRawV0CandidateCoverage,
  dryRunTeamWeekRawV0CandidateFile,
  REAL_2024_CANDIDATE_COVERAGE_EXPECTATION
} from '../src/dryrun/teamWeekRawV0CandidateDryRun.js';
import {
  type TeamWeekRawCandidateConsumption,
  type TeamWeekRawCandidateRow
} from '../src/adapters/teamWeekRawV0CandidateAdapter.js';
import { NFL_TEAM_CODES_32 } from '../src/fixtures/teamWeekRawV0FullLeagueScaffold.js';

const REGULAR_SEASON_WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);
const byeWeekFor = (teamIndex: number): number => (teamIndex % REGULAR_SEASON_WEEKS.length) + 1;

/**
 * A candidate row whose deferred fields (pressure + the eight fantasy fields, redZoneTdRate) are
 * `null`, mirroring the real 2024 candidate. Only team_code/week/season matter to the dry-run; the
 * nulls exist to prove the dry-run never reads or fabricates them.
 */
const nullMetricRow = (season: number, week: number, teamCode: string): TeamWeekRawCandidateRow => ({
  season,
  week,
  teamCode,
  opponentCode: 'OPP',
  pointsFor: 20,
  pointsAgainst: 17,
  offensivePlays: 60,
  neutralPlays: 40,
  secondsPerPlay: 25,
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
  redZoneTdRate: 0.5,
  sacksAllowed: 2,
  pressureRateAllowed: null,
  turnovers: 1,
  fantasyPointsForQB: null,
  fantasyPointsForRB: null,
  fantasyPointsForWR: null,
  fantasyPointsForTE: null,
  fantasyPointsAllowedQB: null,
  fantasyPointsAllowedRB: null,
  fantasyPointsAllowedWR: null,
  fantasyPointsAllowedTE: null
});

/**
 * Deterministic 32-team x weeks 1-18 candidate consumption with exactly one staggered bye per team
 * → 17 game rows per team, 544 total rows, no synthetic bye rows. Shape-only generated fixture; it
 * invents no real schedule.
 */
const buildFullCandidateConsumption = (
  overrides: Partial<TeamWeekRawCandidateConsumption['upstream']> = {}
): TeamWeekRawCandidateConsumption => {
  const rows: TeamWeekRawCandidateRow[] = [];
  NFL_TEAM_CODES_32.forEach((teamCode, teamIndex) => {
    const byeWeek = byeWeekFor(teamIndex);
    for (const week of REGULAR_SEASON_WEEKS) {
      if (week === byeWeek) continue;
      rows.push(nullMetricRow(2024, week, teamCode));
    }
  });

  return {
    upstream: {
      sourceArtifactPath: 'exports/candidates/team_week_raw/team_week_raw_v0_2024_real_source_candidate.json',
      generatedAt: '2026-06-25T19:20:51+00:00',
      season: 2024,
      provenanceStatus: 'partial_real_data',
      governanceStatus: 'ungoverned',
      governanceSource: 'not_set',
      deferredFields: ['pressureRateAllowed', 'fantasyPointsForQB', 'fantasyPointsAllowedQB'],
      validationReportPath: null,
      lineageManifestPath: null,
      ...overrides
    },
    rows
  };
};

const sampleFixturePath = path.resolve(
  process.cwd(),
  'data/fixtures/team_week_raw_candidate/team_week_raw_v0_2024_candidate.sample.json'
);

describe('team_week_raw_v0 candidate dry-run', () => {
  it('accepts the real 2024 candidate shape (32 teams x 17 games = 544 rows) as valid coverage', () => {
    const consumption = buildFullCandidateConsumption();
    expect(consumption.rows).toHaveLength(544);

    const report = dryRunTeamWeekRawV0CandidateCoverage(consumption);

    expect(report.coverage.valid).toBe(true);
    expect(report.coverage.errors).toEqual([]);
    expect(report.coverage.isFullLeague).toBe(true);
    expect(report.coverage.teamCount).toBe(32);
    expect(report.coverage.totalRowCount).toBe(544);
    expect(report.rowCount).toBe(544);
  });

  it('explicitly uses the bye-aware validator, never the dense-grid validator', () => {
    const report = dryRunTeamWeekRawV0CandidateCoverage(buildFullCandidateConsumption());
    // `totalRowCount` is unique to the bye-aware validator's result; the dense-grid result lacks it.
    expect(report.coverage).toHaveProperty('totalRowCount');
    // 544 (=32x17), not 576 (=32x18): the dense-grid validator would require a row every week.
    expect(report.coverage.totalRowCount).toBe(544);
    expect(REAL_2024_CANDIDATE_COVERAGE_EXPECTATION.expectedGamesPerTeam).toBe(17);
  });

  it('does not require or synthesize a bye-week row (17 rows/team passes, no week-N-missing error)', () => {
    const report = dryRunTeamWeekRawV0CandidateCoverage(buildFullCandidateConsumption());
    expect(report.coverage.valid).toBe(true);
    // The dense-grid "is missing week N" failure must never appear on this bye-aware lane.
    expect(report.coverage.errors.some((e) => e.includes('is missing week'))).toBe(false);
  });

  it('never promotes or governs: report pins promoted/governed false and echoes ungoverned status', () => {
    const report = dryRunTeamWeekRawV0CandidateCoverage(buildFullCandidateConsumption());
    expect(report.promoted).toBe(false);
    expect(report.governed).toBe(false);
    expect(report.provenanceStatus).toBe('partial_real_data');
    expect(report.governanceStatus).toBe('ungoverned');
    expect(report.governanceSource).toBe('not_set');
  });

  it('does not infer governance from coverage success (valid coverage stays ungoverned)', () => {
    const report = dryRunTeamWeekRawV0CandidateCoverage(buildFullCandidateConsumption());
    expect(report.coverage.valid).toBe(true);
    expect(report.governanceStatus).toBe('ungoverned');
    expect(report.governed).toBe(false);
  });

  it('preserves the #55 pressure posture as insufficient_data', () => {
    const report = dryRunTeamWeekRawV0CandidateCoverage(buildFullCandidateConsumption());
    expect(report.pressurePosture).toBe('insufficient_data');
    expect(report.deferredFields).toContain('pressureRateAllowed');
  });

  it('produces no score / ranking / advice fields (read-only inspection surface)', () => {
    const report = dryRunTeamWeekRawV0CandidateCoverage(buildFullCandidateConsumption());
    expect(Object.keys(report).sort()).toEqual(
      [
        'coverage',
        'deferredFields',
        'governanceSource',
        'governanceStatus',
        'governed',
        'pressurePosture',
        'promoted',
        'provenanceStatus',
        'rowCount',
        'sourceArtifactPath'
      ].sort()
    );
  });

  it('reports coverage failure (fail-closed) without throwing when teams are missing', () => {
    // The committed 4-row sample is a genuine partial excerpt: it must not throw, must stay
    // ungoverned, and must report invalid coverage against the 32-team expectation.
    const report = dryRunTeamWeekRawV0CandidateFile(sampleFixturePath);

    expect(report.rowCount).toBe(4);
    expect(report.coverage.valid).toBe(false);
    expect(report.coverage.errors.some((e) => e.includes('missing team'))).toBe(true);
    expect(report.governanceStatus).toBe('ungoverned');
    expect(report.promoted).toBe(false);
    expect(report.governed).toBe(false);
    expect(report.provenanceStatus).toBe('partial_real_data');
  });

  it('flags a mixed-season candidate via the bye-aware season check', () => {
    const consumption = buildFullCandidateConsumption();
    // Replace one genuine 2024 row with the same team/week sourced from 2023.
    const target = consumption.rows[0]!;
    consumption.rows[0] = nullMetricRow(2023, target.week, target.teamCode);

    const report = dryRunTeamWeekRawV0CandidateCoverage(consumption);

    expect(report.coverage.valid).toBe(false);
    expect(
      report.coverage.errors.some((e) => e.includes('season 2023, expected season 2024'))
    ).toBe(true);
  });
});
