import { describe, expect, it } from 'vitest';
import { buildTeamEnvironmentMovementV0 } from '../src/pipeline/teamEnvironmentMovement.js';
import { buildTeamWeekStates } from '../src/transform/buildTeamWeekState.js';
import type { TeamWeekInputRow } from '../src/types/teamstate.js';

const baseRow = (week: number, overrides: Partial<TeamWeekInputRow> = {}): TeamWeekInputRow => ({
  season: 2025,
  week,
  team: 'TB',
  opponent: `OPP${week}`,
  pointsFor: 28,
  pointsAgainst: 21,
  offensivePlays: 66,
  neutralPlays: 45,
  secondsPerPlay: 27.2,
  passRate: 0.58,
  neutralPassRate: 0.58,
  rushRate: 0.42,
  epaPerPlay: 0.12,
  passEpaPerPlay: 0.15,
  rushEpaPerPlay: 0.06,
  successRate: 0.49,
  explosivePlayRate: 0.12,
  drives: 10,
  pointsPerDrive: 2.6,
  redZoneTrips: 4,
  redZoneTdRate: 0.62,
  sacksAllowed: 1,
  pressureRateAllowed: 0.21,
  turnovers: 1,
  fantasyPointsForQB: 22,
  fantasyPointsForRB: 23,
  fantasyPointsForWR: 31,
  fantasyPointsForTE: 9,
  fantasyPointsAllowedQB: 18,
  fantasyPointsAllowedRB: 19,
  fantasyPointsAllowedWR: 29,
  fantasyPointsAllowedTE: 8,
  ...overrides
});

const buildTemporalRows = (): TeamWeekInputRow[] => [
  baseRow(1, { pointsPerDrive: 3.1, epaPerPlay: 0.18, successRate: 0.54, explosivePlayRate: 0.16, pressureRateAllowed: 0.18, secondsPerPlay: 26.4, neutralPassRate: 0.56, fantasyPointsForQB: 25, fantasyPointsForRB: 26, fantasyPointsForWR: 36, fantasyPointsForTE: 12, sacksAllowed: 1, turnovers: 0 }),
  baseRow(2, { pointsPerDrive: 2.9, epaPerPlay: 0.15, successRate: 0.52, explosivePlayRate: 0.14, pressureRateAllowed: 0.2, secondsPerPlay: 26.8, neutralPassRate: 0.57, fantasyPointsForQB: 24, fantasyPointsForRB: 24, fantasyPointsForWR: 34, fantasyPointsForTE: 11, sacksAllowed: 1, turnovers: 0 }),
  baseRow(3, { pointsPerDrive: 2.8, epaPerPlay: 0.14, successRate: 0.51, explosivePlayRate: 0.13, pressureRateAllowed: 0.21, secondsPerPlay: 27.1, neutralPassRate: 0.58, fantasyPointsForQB: 23, fantasyPointsForRB: 23, fantasyPointsForWR: 33, fantasyPointsForTE: 10, sacksAllowed: 1, turnovers: 1 }),
  baseRow(4, { pointsPerDrive: 2.2, epaPerPlay: 0.04, successRate: 0.46, explosivePlayRate: 0.1, pressureRateAllowed: 0.28, secondsPerPlay: 27.8, neutralPassRate: 0.59 }),
  baseRow(5, { pointsPerDrive: 2.0, epaPerPlay: 0.01, successRate: 0.44, explosivePlayRate: 0.09, pressureRateAllowed: 0.31, secondsPerPlay: 28.0, neutralPassRate: 0.6 }),
  baseRow(6, { pointsPerDrive: 1.7, epaPerPlay: -0.05, successRate: 0.39, explosivePlayRate: 0.07, pressureRateAllowed: 0.36, secondsPerPlay: 28.5, neutralPassRate: 0.62, fantasyPointsForQB: 16, fantasyPointsForRB: 18, fantasyPointsForWR: 23, fantasyPointsForTE: 6, sacksAllowed: 4, turnovers: 2 }),
  baseRow(7, { pointsPerDrive: 1.5, epaPerPlay: -0.08, successRate: 0.37, explosivePlayRate: 0.06, pressureRateAllowed: 0.39, secondsPerPlay: 28.8, neutralPassRate: 0.63, fantasyPointsForQB: 15, fantasyPointsForRB: 17, fantasyPointsForWR: 21, fantasyPointsForTE: 5, sacksAllowed: 4, turnovers: 2 }),
  baseRow(8, { pointsPerDrive: 1.4, epaPerPlay: -0.1, successRate: 0.36, explosivePlayRate: 0.05, pressureRateAllowed: 0.41, secondsPerPlay: 29.0, neutralPassRate: 0.64, fantasyPointsForQB: 14, fantasyPointsForRB: 16, fantasyPointsForWR: 20, fantasyPointsForTE: 5, sacksAllowed: 5, turnovers: 3 })
];

describe('team environment movement v0', () => {
  it('builds deterministic 8-week early/late windows, deltas, and movement labels', () => {
    const artifact = buildTeamEnvironmentMovementV0(
      buildTeamWeekStates(buildTemporalRows()),
      '2026-05-29T00:00:00.000Z',
      'fixtures/team_week_raw/team_week_raw_v0.tampa_bay_temporal.sample.json',
      'fixture_scaffold'
    );

    expect(artifact.artifact).toBe('team_environment_movement_v0');
    expect(artifact.metadata.provenanceStatus).toBe('fixture_scaffold');
    expect(artifact.metadata.coverage).toMatchObject({ teamCount: 1, teams: ['TB'], seasons: [2025], weeks: [1, 2, 3, 4, 5, 6, 7, 8], latestWeek: 8, isFullLeague: false });
    expect(artifact.teams).toHaveLength(1);

    const tb = artifact.teams[0];
    expect(tb?.teamId).toBe('TB');
    expect(tb?.weeksCovered).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(tb?.earlyWindow.weeks).toEqual([1, 2, 3]);
    expect(tb?.lateWindow.weeks).toEqual([6, 7, 8]);
    expect(tb?.deltas.pointsPerDrive).toBeLessThan(-1);
    expect(tb?.deltas.epaPerPlay).toBeLessThan(-0.2);
    expect(tb?.deltas.pressureRateAllowed).toBeGreaterThan(0.15);
    expect(tb?.deltas.secondsPerPlay).toBeGreaterThan(1);
    expect(tb?.movement.offenseDirection).toBe('declining');
    expect(tb?.movement.pressureDirection).toBe('worsening');
    expect(tb?.movement.paceDirection).toBe('slower');
    expect(tb?.movement.passEnvironmentDirection).toBe('more_pass_heavy');
    expect(tb?.movement.volatilityDirection).toBe('rising');
    expect(tb?.movement.verdict).toBe('offensive_environment_declining_pressure_worsening');
  });

  it('uses insufficient-data labels when fewer than four weeks are available', () => {
    const artifact = buildTeamEnvironmentMovementV0(
      buildTeamWeekStates([baseRow(1), baseRow(2), baseRow(3)]),
      '2026-05-29T00:00:00.000Z',
      'data/sample/team_week_raw.sample.json'
    );

    const tb = artifact.teams[0];
    expect(tb?.earlyWindow.weeks).toEqual([]);
    expect(tb?.lateWindow.weeks).toEqual([]);
    expect(tb?.deltas.pointsPerDrive).toBeNull();
    expect(tb?.movement).toEqual({
      offenseDirection: 'insufficient_data',
      passEnvironmentDirection: 'insufficient_data',
      paceDirection: 'insufficient_data',
      pressureDirection: 'insufficient_data',
      volatilityDirection: 'insufficient_data',
      verdict: 'insufficient_data'
    });
    expect(tb?.warnings[0]).toContain('fewer than 4 weeks');
  });

  it('preserves fixture-scaffold provenance from the raw TeamWeekRawV0 artifact', () => {
    const artifact = buildTeamEnvironmentMovementV0(
      buildTeamWeekStates(buildTemporalRows()),
      '2026-05-29T00:00:00.000Z',
      'C:/Users/deebr/TIBER-Data/exports/fixtures/team_week_raw/team_week_raw_v0.tampa_bay_temporal.sample.json',
      'fixture_scaffold'
    );

    expect(artifact.metadata.provenanceStatus).toBe('fixture_scaffold');
    expect(artifact.metadata.inputSources[0]).toEqual({
      path: 'fixtures/team_week_raw/team_week_raw_v0.tampa_bay_temporal.sample.json',
      type: 'fixture'
    });
  });
});
