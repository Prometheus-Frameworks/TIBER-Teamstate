import { describe, expect, it } from 'vitest';
import { buildTeamEnvironmentMovementV0 } from '../src/pipeline/teamEnvironmentMovement.js';
import { buildTeamEnvironmentMovementV1 } from '../src/pipeline/teamEnvironmentMovementV1.js';
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
  baseRow(1, { pointsPerDrive: 3.1, epaPerPlay: 0.18, successRate: 0.54, explosivePlayRate: 0.16, pressureRateAllowed: 0.18, secondsPerPlay: 26.4, neutralPassRate: 0.56 }),
  baseRow(2, { pointsPerDrive: 2.9, epaPerPlay: 0.15, successRate: 0.52, explosivePlayRate: 0.14, pressureRateAllowed: 0.2, secondsPerPlay: 26.8, neutralPassRate: 0.57 }),
  baseRow(3, { pointsPerDrive: 2.8, epaPerPlay: 0.14, successRate: 0.51, explosivePlayRate: 0.13, pressureRateAllowed: 0.21, secondsPerPlay: 27.1, neutralPassRate: 0.58 }),
  baseRow(4, { pointsPerDrive: 2.2, epaPerPlay: 0.04, successRate: 0.46, explosivePlayRate: 0.1, pressureRateAllowed: 0.28, secondsPerPlay: 27.8, neutralPassRate: 0.59 }),
  baseRow(5, { pointsPerDrive: 2.0, epaPerPlay: 0.01, successRate: 0.44, explosivePlayRate: 0.09, pressureRateAllowed: 0.31, secondsPerPlay: 28.0, neutralPassRate: 0.6 }),
  baseRow(6, { pointsPerDrive: 1.7, epaPerPlay: -0.05, successRate: 0.39, explosivePlayRate: 0.07, pressureRateAllowed: 0.36, secondsPerPlay: 28.5, neutralPassRate: 0.62 }),
  baseRow(7, { pointsPerDrive: 1.5, epaPerPlay: -0.08, successRate: 0.37, explosivePlayRate: 0.06, pressureRateAllowed: 0.39, secondsPerPlay: 28.8, neutralPassRate: 0.63 }),
  baseRow(8, { pointsPerDrive: 1.4, epaPerPlay: -0.1, successRate: 0.36, explosivePlayRate: 0.05, pressureRateAllowed: 0.41, secondsPerPlay: 29.0, neutralPassRate: 0.64 })
];

const FANTASY_POINT_KEYS = ['fantasyPointsForQB', 'fantasyPointsForRB', 'fantasyPointsForWR', 'fantasyPointsForTE'];

describe('team environment movement v1', () => {
  it('emits the v1 artifact literal and never exposes fantasy-point fields', () => {
    const states = buildTeamWeekStates(buildTemporalRows());
    const artifact = buildTeamEnvironmentMovementV1(
      states,
      '2026-06-16T00:00:00.000Z',
      'fixtures/team_week_raw/team_week_raw_v0.movement_demo.sample.json',
      'fixture_scaffold'
    );

    expect(artifact.artifact).toBe('team_environment_movement_v1');
    expect(artifact.metadata.provenanceStatus).toBe('fixture_scaffold');

    // No fantasy-point field appears anywhere in the serialized v1 artifact.
    const serialized = JSON.stringify(artifact);
    for (const key of FANTASY_POINT_KEYS) {
      expect(serialized).not.toContain(key);
    }

    const tb = artifact.teams[0];
    expect(Object.keys(tb.earlyWindow.averages)).not.toEqual(expect.arrayContaining(FANTASY_POINT_KEYS));
    expect(Object.keys(tb.lateWindow.averages)).not.toEqual(expect.arrayContaining(FANTASY_POINT_KEYS));
    expect(Object.keys(tb.deltas)).not.toEqual(expect.arrayContaining(FANTASY_POINT_KEYS));
  });

  it('preserves team-state-driven movement labels identical to v0', () => {
    const states = buildTeamWeekStates(buildTemporalRows());
    const v0 = buildTeamEnvironmentMovementV0(states, '2026-06-16T00:00:00.000Z', 'fixtures/x.json', 'fixture_scaffold');
    const v1 = buildTeamEnvironmentMovementV1(states, '2026-06-16T00:00:00.000Z', 'fixtures/x.json', 'fixture_scaffold');

    expect(v1.teams).toHaveLength(v0.teams.length);
    expect(v1.teams[0].movement).toEqual(v0.teams[0].movement);
    expect(v1.teams[0].movement.verdict).toBe('offensive_environment_declining_pressure_worsening');

    // Team-state deltas are carried through unchanged from v0.
    expect(v1.teams[0].deltas.pointsPerDrive).toBe(v0.teams[0].deltas.pointsPerDrive);
    expect(v1.teams[0].deltas.pressureRateAllowed).toBe(v0.teams[0].deltas.pressureRateAllowed);
    expect(v1.teams[0].earlyWindow.averages.volatilityScore).toBe(v0.teams[0].earlyWindow.averages.volatilityScore);
  });

  it('emits explicit governance metadata: fixture scaffold marked from an explicit producer marker', () => {
    const states = buildTeamWeekStates(buildTemporalRows());
    const artifact = buildTeamEnvironmentMovementV1(
      states,
      '2026-06-16T00:00:00.000Z',
      'output/promoted/team_environment_movement_v1.json',
      'fixture_scaffold'
    );

    expect(artifact.governance.governanceStatus).toBe('fixture');
    expect(artifact.governance.governanceSource).toBe('explicit_marker');
    // Dataset-level contract literal is explicit and exact.
    expect(artifact.governance.contractVersion).toBe('team_environment_movement_v1');
    // Dataset-level generatedAt remains available and mirrors the artifact timestamp.
    expect(artifact.governance.generatedAt).toBe(artifact.generatedAt);
    // An explicit marker means no path-inference fallback note.
    expect(artifact.governance.promotionNotes).toBeUndefined();
    // A /promoted/ path is never sufficient on its own to claim governed.
    expect(artifact.governance.governanceStatus).not.toBe('governed');
  });

  it('marks a governed run as governed only from an explicit producer marker', () => {
    const states = buildTeamWeekStates(buildTemporalRows());
    const artifact = buildTeamEnvironmentMovementV1(
      states,
      '2026-06-16T00:00:00.000Z',
      'output/promoted/team_environment_movement_v1.json',
      'governed_real_data'
    );

    // governed_real_data on a partial (2-team) league resolves to partial_real_data → ungoverned,
    // proving governance is not granted by the /promoted/ path. Full-league governed coverage is
    // what would yield 'governed'.
    expect(artifact.metadata.provenanceStatus).toBe('partial_real_data');
    expect(artifact.governance.governanceStatus).toBe('ungoverned');
    expect(artifact.governance.governanceSource).toBe('explicit_marker');
  });

  it('treats a bare /promoted/ path as no governance basis (unknown), never governed or inferred', () => {
    const states = buildTeamWeekStates(buildTemporalRows());
    const artifact = buildTeamEnvironmentMovementV1(
      states,
      '2026-06-16T00:00:00.000Z',
      'output/promoted/team_environment_movement_v1.json'
    );

    // A /promoted/ path is unrecognized provenance: on its own it establishes nothing.
    expect(artifact.governance.governanceStatus).toBe('unknown');
    expect(artifact.governance.governanceSource).toBe('unknown');
    expect(artifact.governance.governanceStatus).not.toBe('governed');
    expect(artifact.governance.promotionNotes?.[0]).toContain('governance could not be established');
  });

  it('preserves the unknown source when no marker and no usable path are supplied', () => {
    const states = buildTeamWeekStates(buildTemporalRows());
    const artifact = buildTeamEnvironmentMovementV1(states, '2026-06-16T00:00:00.000Z');

    // No marker and no source path at all → no basis, distinct from path inference.
    expect(artifact.governance.governanceStatus).toBe('unknown');
    expect(artifact.governance.governanceSource).toBe('unknown');
  });

  it('falls back to path inference for a recognized fixture/sample path and flags the weak hint', () => {
    const states = buildTeamWeekStates(buildTemporalRows());
    const artifact = buildTeamEnvironmentMovementV1(
      states,
      '2026-06-16T00:00:00.000Z',
      'data/sample/team_week_raw.sample.json'
    );

    // A recognized sample path yields a usable signal, so the source is path_inference (not unknown),
    // but it is still never enough to claim governed.
    expect(artifact.governance.governanceStatus).toBe('fixture');
    expect(artifact.governance.governanceSource).toBe('path_inference');
    expect(artifact.governance.governanceStatus).not.toBe('governed');
    expect(artifact.governance.promotionNotes?.[0]).toContain('weak hint');
  });

  it('uses insufficient-data labels when fewer than four weeks are available', () => {
    const states = buildTeamWeekStates([baseRow(1), baseRow(2), baseRow(3)]);
    const artifact = buildTeamEnvironmentMovementV1(states, '2026-06-16T00:00:00.000Z', 'data/sample/team_week_raw.sample.json');

    const tb = artifact.teams[0];
    expect(tb.earlyWindow.weeks).toEqual([]);
    expect(tb.deltas.pointsPerDrive).toBeNull();
    expect(tb.movement.verdict).toBe('insufficient_data');
  });
});
