import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  rehearseTeamWeekRawV0Candidate,
  rehearseTeamWeekRawV0CandidateFile,
  CANDIDATE_METRIC_FIELDS
} from '../src/rehearsal/teamWeekRawV0CandidateRehearsal.js';
import {
  type TeamWeekRawCandidateConsumption,
  type TeamWeekRawCandidateRow
} from '../src/adapters/teamWeekRawV0CandidateAdapter.js';
import { NFL_TEAM_CODES_32 } from '../src/fixtures/teamWeekRawV0FullLeagueScaffold.js';

const REGULAR_SEASON_WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);
const byeWeekFor = (teamIndex: number): number => (teamIndex % REGULAR_SEASON_WEEKS.length) + 1;

/**
 * A candidate row mirroring the real 2024 candidate's nullability: pressure + the eight fantasy
 * fields are `null` on every row, and `redZoneTdRate` is `null` when there are zero red-zone trips.
 */
const candidateRow = (
  season: number,
  week: number,
  teamCode: string,
  opts: { zeroRedZone?: boolean } = {}
): TeamWeekRawCandidateRow => ({
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
  redZoneTrips: opts.zeroRedZone ? 0 : 3,
  redZoneTdRate: opts.zeroRedZone ? null : 0.5,
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

/** Full 32-team x 17-game (one bye each) candidate consumption: 544 rows, valid bye-aware coverage. */
const buildFullConsumption = (): TeamWeekRawCandidateConsumption => {
  const rows: TeamWeekRawCandidateRow[] = [];
  NFL_TEAM_CODES_32.forEach((teamCode, teamIndex) => {
    const byeWeek = byeWeekFor(teamIndex);
    for (const week of REGULAR_SEASON_WEEKS) {
      if (week === byeWeek) continue;
      // Make exactly one row per team a zero-red-zone row so redZoneTdRate is genuinely partial-null.
      rows.push(candidateRow(2024, week, teamCode, { zeroRedZone: week === (byeWeek === 1 ? 2 : 1) }));
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
      deferredFields: [
        'pressureRateAllowed',
        'fantasyPointsForQB',
        'fantasyPointsForRB',
        'fantasyPointsForWR',
        'fantasyPointsForTE',
        'fantasyPointsAllowedQB',
        'fantasyPointsAllowedRB',
        'fantasyPointsAllowedWR',
        'fantasyPointsAllowedTE'
      ],
      validationReportPath: null,
      lineageManifestPath: null
    },
    rows
  };
};

const sampleFixturePath = path.resolve(
  process.cwd(),
  'data/fixtures/team_week_raw_candidate/team_week_raw_v0_2024_candidate.sample.json'
);

describe('team_week_raw_v0 candidate rehearsal', () => {
  it('preserves partial_real_data / ungoverned status and labels itself rehearsal-only', () => {
    const report = rehearseTeamWeekRawV0Candidate(buildFullConsumption());

    expect(report.kind).toBe('team_week_raw_v0_candidate_rehearsal');
    expect(report.rehearsalOnly).toBe(true);
    expect(report.productionReady).toBe(false);
    expect(report.provenanceStatus).toBe('partial_real_data');
    expect(report.governanceStatus).toBe('ungoverned');
    expect(report.governanceSource).toBe('not_set');
  });

  it('does not upgrade governance or promotion when coverage is valid', () => {
    const report = rehearseTeamWeekRawV0Candidate(buildFullConsumption());

    expect(report.coverage.valid).toBe(true);
    expect(report.rehearsalStatus).toBe('rehearsed');
    expect(report.promoted).toBe(false);
    expect(report.governed).toBe(false);
    expect(report.governanceStatus).toBe('ungoverned');
  });

  it('keeps pressure deferred as insufficient_data even with valid coverage', () => {
    const report = rehearseTeamWeekRawV0Candidate(buildFullConsumption());

    expect(report.coverage.valid).toBe(true);
    expect(report.pressurePosture).toBe('insufficient_data');
    expect(report.deferredInsufficientFields).toContain('pressureRateAllowed');
    expect(report.availableFields).not.toContain('pressureRateAllowed');
    const pressure = report.fieldReadiness.find((f) => f.field === 'pressureRateAllowed')!;
    expect(pressure.status).toBe('deferred_insufficient_data');
    expect(pressure.finiteCount).toBe(0);
  });

  it('reports null metric fields honestly and never coerces them to zero', () => {
    const report = rehearseTeamWeekRawV0Candidate(buildFullConsumption());

    // Every fantasy field is null on every row → finiteCount 0, classified deferred, never "available".
    for (const field of [
      'fantasyPointsForQB',
      'fantasyPointsAllowedTE',
      'pressureRateAllowed'
    ]) {
      const readiness = report.fieldReadiness.find((f) => f.field === field)!;
      expect(readiness.finiteCount).toBe(0);
      expect(readiness.nullCount).toBe(report.rowCount);
      expect(report.availableFields).not.toContain(field);
    }
    // redZoneTdRate is null only on the zero-red-zone rows → partial, not available, not zeroed.
    const rzt = report.fieldReadiness.find((f) => f.field === 'redZoneTdRate')!;
    expect(rzt.status).toBe('partial_nulls');
    expect(rzt.nullCount).toBeGreaterThan(0);
    expect(rzt.finiteCount).toBeGreaterThan(0);
    expect(report.partialNullFields).toContain('redZoneTdRate');
  });

  it('classifies fully-populated metrics as available', () => {
    const report = rehearseTeamWeekRawV0Candidate(buildFullConsumption());
    expect(report.availableFields).toContain('pointsFor');
    expect(report.availableFields).toContain('epaPerPlay');
    // The classification covers exactly the documented metric surface.
    expect(report.fieldReadiness.map((f) => f.field)).toEqual([...CANDIDATE_METRIC_FIELDS]);
  });

  it('produces no score / ranking / advice / Product / PPM fields (exact output surface locked)', () => {
    const report = rehearseTeamWeekRawV0Candidate(buildFullConsumption());
    // Lock the exact key set: any score/ranking/advice/Product/PPM/movement/forecast output field
    // would have to appear here, and none does. (`productionReady` is a non-production marker, not a
    // Product output — hence an exact-set assertion rather than a substring scan.)
    expect(Object.keys(report).sort()).toEqual(
      [
        'availableFields',
        'coverage',
        'deferredFields',
        'deferredInsufficientFields',
        'fieldReadiness',
        'governanceSource',
        'governanceStatus',
        'governed',
        'kind',
        'notes',
        'partialNullFields',
        'pressurePosture',
        'productionReady',
        'promoted',
        'provenanceStatus',
        'rehearsalOnly',
        'rehearsalStatus',
        'rowCount',
        'sourceArtifactPath'
      ].sort()
    );
  });

  it('fails closed as a report (not a fabricated output) on invalid / partial coverage', () => {
    const report = rehearseTeamWeekRawV0CandidateFile(sampleFixturePath);

    expect(report.rowCount).toBe(4);
    expect(report.coverage.valid).toBe(false);
    expect(report.rehearsalStatus).toBe('withheld_invalid_coverage');
    expect(report.governanceStatus).toBe('ungoverned');
    expect(report.promoted).toBe(false);
    expect(report.governed).toBe(false);
    expect(report.notes.some((n) => n.includes('withheld'))).toBe(true);
  });

  it('does not import the production src/score/ modules', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const moduleDir = path.resolve(here, '../src/rehearsal');
    for (const file of ['teamWeekRawV0CandidateRehearsal.ts', 'runTeamWeekRawV0CandidateRehearsal.ts']) {
      const source = readFileSync(path.join(moduleDir, file), 'utf-8');
      expect(source).not.toMatch(/from\s+['"][^'"]*\/score\//);
      expect(source).not.toMatch(/import\s+['"][^'"]*\/score\//);
    }
  });
});
