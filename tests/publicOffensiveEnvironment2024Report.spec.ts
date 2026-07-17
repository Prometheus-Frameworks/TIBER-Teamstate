import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import type {
  TeamWeekRawGovernedConsumption,
  TeamWeekRawGovernedRow
} from '../src/adapters/teamWeekRawV0GovernedAdapter.js';
import { loadTeamWeekRawV0Governed } from '../src/ingest/loadTeamWeekRawV0Governed.js';
import {
  buildPublicReport2024Payload,
  computeSha256Hex,
  deriveTeamSeasonRecord,
  roundHalfAwayFromZero,
  serializePublicReport2024Payload
} from '../src/reports/publicOffensiveEnvironment2024Report.js';
import {
  PUBLIC_REPORT_2024_DERIVED_FIELDS,
  PUBLIC_REPORT_2024_EXPECTED_TEAMS,
  PUBLIC_REPORT_2024_GOVERNED_INPUT_PIN,
  PUBLIC_REPORT_2024_OBSERVED_FIELDS
} from '../src/contracts/teamstatePublicOffensiveEnvironment2024V1.js';

const GOVERNED_SOURCE_PATH = path.resolve(
  process.cwd(),
  'data/governed/team_week_raw_v0_2024_real_source_candidate.json'
);
const GENERATED_AT = '2026-07-17T00:00:00.000Z';

const governedSourceBytes = readFileSync(GOVERNED_SOURCE_PATH);
const governedSourceSha256 = computeSha256Hex(governedSourceBytes);
const realConsumption = loadTeamWeekRawV0Governed(GOVERNED_SOURCE_PATH);
const realPayload = buildPublicReport2024Payload(realConsumption, {
  generatedAt: GENERATED_AT,
  governedInputSha256: governedSourceSha256
});

export const makeGovernedRow = (overrides: Partial<TeamWeekRawGovernedRow>): TeamWeekRawGovernedRow => ({
  season: 2024,
  week: 1,
  teamCode: 'AAA',
  opponentCode: 'BBB',
  pointsFor: 28,
  pointsAgainst: 34,
  offensivePlays: 60,
  neutralPlays: 50,
  secondsPerPlay: 26,
  passRate: 0.6,
  neutralPassRate: 0.6,
  rushRate: 0.4,
  epaPerPlay: 0.1,
  passEpaPerPlay: 0.15,
  rushEpaPerPlay: -0.15,
  successRate: 0.4,
  explosivePlayRate: 0.1,
  drives: 9,
  pointsPerDrive: 3.111111,
  redZoneTrips: 4,
  redZoneTdRate: 0.5,
  sacksAllowed: 4,
  pressureRateAllowed: null,
  turnovers: 1,
  ...overrides
});

describe('roundHalfAwayFromZero (§3 precision policy)', () => {
  it('rounds half away from zero in both directions', () => {
    expect(roundHalfAwayFromZero(2.5, 0)).toBe(3);
    expect(roundHalfAwayFromZero(-2.5, 0)).toBe(-3);
    expect(roundHalfAwayFromZero(0.00005, 4)).toBe(0.0001);
    expect(roundHalfAwayFromZero(-0.00005, 4)).toBe(-0.0001);
    expect(roundHalfAwayFromZero(1.05, 1)).toBe(1.1);
    expect(roundHalfAwayFromZero(-1.05, 1)).toBe(-1.1);
  });

  it('is robust to binary floating-point representation noise at half boundaries', () => {
    // 2.675 * 100 === 267.49999999999997 in IEEE-754; naive rounding gives 2.67.
    expect(roundHalfAwayFromZero(2.675, 2)).toBe(2.68);
    expect(roundHalfAwayFromZero(-2.675, 2)).toBe(-2.68);
  });

  it('leaves already-exact values untouched', () => {
    expect(roundHalfAwayFromZero(27.6, 2)).toBe(27.6);
    expect(roundHalfAwayFromZero(-0.02, 4)).toBe(-0.02);
    expect(roundHalfAwayFromZero(17, 0)).toBe(17);
  });
});

describe('deriveTeamSeasonRecord (§3 formulas, hand-computed)', () => {
  const rows = [
    makeGovernedRow({ week: 1 }),
    makeGovernedRow({
      week: 2,
      pointsFor: 10,
      offensivePlays: 40,
      neutralPlays: 20,
      secondsPerPlay: 30,
      epaPerPlay: -0.2,
      neutralPassRate: 0.4,
      drives: 11,
      pointsPerDrive: 0.909091,
      redZoneTrips: 0,
      redZoneTdRate: null,
      sacksAllowed: 0,
      turnovers: 2
    })
  ];

  it('computes totals as direct sums and per-game values at 1 decimal', () => {
    const { record } = deriveTeamSeasonRecord('AAA', rows);
    expect(record.gamesPlayed).toBe(2);
    expect(record.observed).toEqual({
      pointsForTotal: 38,
      offensivePlaysTotal: 100,
      neutralPlaysTotal: 70,
      drivesTotal: 20,
      redZoneTripsTotal: 4,
      sacksAllowedTotal: 4,
      turnoversTotal: 3
    });
    expect(record.derived.pointsForPerGame).toBe(19.0);
    expect(record.derived.offensivePlaysPerGame).toBe(50.0);
    expect(record.derived.neutralPlaysPerGame).toBe(35.0);
    expect(record.derived.drivesPerGame).toBe(10.0);
    expect(record.derived.redZoneTripsPerGame).toBe(2.0);
    expect(record.derived.sacksAllowedPerGame).toBe(2.0);
    expect(record.derived.turnoversPerGame).toBe(1.5);
  });

  it('weights every rate field by its §3 denominator, never a simple mean', () => {
    const { record } = deriveTeamSeasonRecord('AAA', rows);
    // secondsPerPlay: (26×60 + 30×40) / 100 = 27.6 — simple mean would be 28.
    expect(record.derived.secondsPerPlay).toBe(27.6);
    // epaPerPlay: (0.1×60 + (−0.2)×40) / 100 = −0.02 — simple mean would be −0.05.
    expect(record.derived.epaPerPlay).toBe(-0.02);
    // neutralPassRate: (0.6×50 + 0.4×20) / 70 = 0.542857… → 0.5429 — simple mean would be 0.5.
    expect(record.derived.neutralPassRate).toBe(0.5429);
    // pointsPerDrive: (3.111111×9 + 0.909091×11) / 20 = 1.9 == pointsForTotal / drivesTotal.
    expect(record.derived.pointsPerDrive).toBe(1.9);
    // redZoneTdRate: trip-weighted over non-null weeks only: (0.5×4)/4 = 0.5.
    expect(record.derived.redZoneTdRate).toBe(0.5);
    expect(record.warnings).toEqual([]);
  });

  it('emits null + W_ZERO_REDZONE_OPPORTUNITIES when a team-season has zero red-zone trips', () => {
    const zeroTripRows = [
      makeGovernedRow({ week: 1, redZoneTrips: 0, redZoneTdRate: null }),
      makeGovernedRow({ week: 2, redZoneTrips: 0, redZoneTdRate: null })
    ];
    const { record, warnings } = deriveTeamSeasonRecord('AAA', zeroTripRows);
    expect(record.observed.redZoneTripsTotal).toBe(0);
    expect(record.derived.redZoneTdRate).toBeNull();
    expect(record.warnings).toContain('W_ZERO_REDZONE_OPPORTUNITIES');
    expect(warnings).toEqual([{ team: 'AAA', code: 'W_ZERO_REDZONE_OPPORTUNITIES' }]);
  });

  it('emits null + zero-denominator warnings for neutralPassRate/pointsPerDrive, never 0', () => {
    const zeroDenominatorRows = [
      makeGovernedRow({ week: 1, neutralPlays: 0, neutralPassRate: 0, drives: 0, pointsPerDrive: 0 }),
      makeGovernedRow({ week: 2, neutralPlays: 0, neutralPassRate: 0, drives: 0, pointsPerDrive: 0 })
    ];
    const { record } = deriveTeamSeasonRecord('AAA', zeroDenominatorRows);
    expect(record.derived.neutralPassRate).toBeNull();
    expect(record.derived.pointsPerDrive).toBeNull();
    expect(record.warnings).toContain('W_ZERO_DENOMINATOR_NEUTRAL_PLAYS');
    expect(record.warnings).toContain('W_ZERO_DENOMINATOR_DRIVES');
  });

  it('fails closed on a null value in a never-null field instead of zero-filling', () => {
    const rowsWithNull = [makeGovernedRow({ pointsFor: null })];
    expect(() => deriveTeamSeasonRecord('AAA', rowsWithNull)).toThrow(/never-null/);
  });

  it('fails closed when redZoneTdRate is null despite non-zero trips (inconsistent data)', () => {
    const inconsistent = [makeGovernedRow({ redZoneTrips: 3, redZoneTdRate: null })];
    expect(() => deriveTeamSeasonRecord('AAA', inconsistent)).toThrow(/zero opportunities/);
  });
});

describe('buildPublicReport2024Payload fail-closed generation gates', () => {
  it('refuses a governed-input checksum that does not match the contract pin', () => {
    expect(() =>
      buildPublicReport2024Payload(realConsumption, {
        generatedAt: GENERATED_AT,
        governedInputSha256: 'deadbeef'.repeat(8)
      })
    ).toThrow(/does not\s+match the contract-pinned checksum/);
  });

  it('refuses generation when metadata.inputSources cannot populate upstream_sources', () => {
    const consumptionWithoutSources: TeamWeekRawGovernedConsumption = {
      upstream: { ...realConsumption.upstream, inputSources: [] },
      rows: realConsumption.rows
    };
    expect(() =>
      buildPublicReport2024Payload(consumptionWithoutSources, {
        generatedAt: GENERATED_AT,
        governedInputSha256: governedSourceSha256
      })
    ).toThrow(/inputSources is empty\/absent/);

    const consumptionWithoutSnapshot: TeamWeekRawGovernedConsumption = {
      upstream: {
        ...realConsumption.upstream,
        inputSources: [{ sourceRefs: ['ref-a'], sourceSnapshotAt: null, checksum: null }]
      },
      rows: realConsumption.rows
    };
    expect(() =>
      buildPublicReport2024Payload(consumptionWithoutSnapshot, {
        generatedAt: GENERATED_AT,
        governedInputSha256: governedSourceSha256
      })
    ).toThrow(/no sourceSnapshotAt/);
  });
});

describe('full governed-source payload (32 teams / 544 rows)', () => {
  it('matches the committed governed source pin and declared scope exactly', () => {
    expect(governedSourceSha256).toBe(PUBLIC_REPORT_2024_GOVERNED_INPUT_PIN.checksum.value);
    expect(realPayload.coverage).toEqual({
      team_count: 32,
      expected_team_count: 32,
      team_game_row_count: 544,
      expected_team_game_rows: 544,
      missing_teams: [],
      unexpected_teams: [],
      is_full_league: true,
      satisfies_declared_scope: true
    });
    expect(realPayload.teams.map((team) => team.team)).toEqual([...PUBLIC_REPORT_2024_EXPECTED_TEAMS]);
    expect(realPayload.teams.every((team) => team.gamesPlayed === 17)).toBe(true);
  });

  it('serializes with the exact §5 key order and no undocumented fields', () => {
    expect(Object.keys(realPayload)).toEqual([
      'artifact',
      'schema_version',
      'report_version_id',
      'canonical_url',
      'version_url',
      'declared_scope',
      'coverage',
      'source_snapshot_at',
      'generated_at',
      'provenance_status',
      'governance',
      'methodology_version',
      'governed_input',
      'upstream_sources',
      'validation_report',
      'lineage_manifest',
      'excluded_lanes',
      'warnings',
      'teams'
    ]);
    for (const team of realPayload.teams) {
      expect(Object.keys(team)).toEqual(['team', 'gamesPlayed', 'observed', 'derived', 'warnings']);
      expect(Object.keys(team.observed)).toEqual([...PUBLIC_REPORT_2024_OBSERVED_FIELDS]);
      expect(Object.keys(team.derived)).toEqual([...PUBLIC_REPORT_2024_DERIVED_FIELDS]);
    }
  });

  it('pins identity, temporal, provenance, and source-chain metadata per §5/§7', () => {
    expect(realPayload.artifact).toBe('teamstate_public_offensive_environment_2024_v1');
    expect(realPayload.schema_version).toBe('1.0.0');
    expect(realPayload.report_version_id).toBe('teamstate_public_offensive_environment_2024_v1.r1');
    expect(realPayload.canonical_url).toBe('/nfl/2024/offensive-environments.json');
    expect(realPayload.version_url).toBe(
      '/nfl/2024/offensive-environments/teamstate_public_offensive_environment_2024_v1.r1.json'
    );
    expect(realPayload.declared_scope.data_through).toBe('2025-01-05');
    expect(realPayload.declared_scope.data_through_source).toBe(
      'pinned_contract_constant_public_nfl_schedule_not_adapter_derived'
    );
    // max() across both upstream snapshots — the schedules snapshot, one second after play-by-play.
    expect(realPayload.source_snapshot_at).toBe('2026-06-27T13:42:05+00:00');
    expect(realPayload.generated_at).toBe(GENERATED_AT);
    expect(realPayload.provenance_status).toBe('governed_real_data');
    expect(realPayload.governance).toEqual({ governance_status: 'governed', governance_source: 'explicit_marker' });
    expect(realPayload.governed_input).toEqual({
      artifact_id: 'team_week_raw_v0_2024_real_source_candidate',
      repository: 'TIBER-Teamstate',
      path: 'data/governed/team_week_raw_v0_2024_real_source_candidate.json',
      checksum: {
        algorithm: 'sha256',
        value: '2aed00e68c1620af10d2ea4350104f7e183ff6ee050f5d385a503ef027281de9'
      },
      checksum_verification: 'recomputed_locally_at_generation_time_against_committed_repo_file'
    });
    expect(realPayload.upstream_sources).toEqual([
      {
        source_ref: 'nflverse-data:pbp/play_by_play_2024',
        source_snapshot_at: '2026-06-27T13:42:00+00:00',
        checksum: {
          algorithm: 'sha256',
          value: '6d432dd4308329bfddaef633309ea119f9ca46d52cbb3c09f47172a2e8efcd01'
        },
        checksum_verification: 'recorded_from_governed_artifact_metadata_no_network_refetch'
      },
      {
        source_ref: 'nflverse-data:schedules/games',
        source_snapshot_at: '2026-06-27T13:42:05+00:00',
        checksum: {
          algorithm: 'sha256',
          value: '179ea0a014159b3aa4da59eee756272dd33ec876d704fb46650c08118fe75a05'
        },
        checksum_verification: 'recorded_from_governed_artifact_metadata_no_network_refetch'
      }
    ]);
    expect(realPayload.excluded_lanes).toHaveLength(16);
    expect(realPayload.warnings).toEqual([]);
  });

  it('matches an independent recompute of a team directly from the committed source bytes', () => {
    const sourceJson = JSON.parse(governedSourceBytes.toString('utf-8')) as {
      rows: Array<Record<string, number | string | null>>;
    };
    const detRows = sourceJson.rows.filter((row) => row.teamCode === 'DET');
    expect(detRows).toHaveLength(17);

    const sumOf = (field: string): number => detRows.reduce((acc, row) => acc + (row[field] as number), 0);
    const det = realPayload.teams.find((team) => team.team === 'DET')!;
    expect(det.observed.pointsForTotal).toBe(sumOf('pointsFor'));
    expect(det.observed.offensivePlaysTotal).toBe(sumOf('offensivePlays'));
    expect(det.observed.drivesTotal).toBe(sumOf('drives'));
    expect(det.observed.turnoversTotal).toBe(sumOf('turnovers'));

    const weightedEpa =
      detRows.reduce((acc, row) => acc + (row.epaPerPlay as number) * (row.offensivePlays as number), 0) /
      sumOf('offensivePlays');
    expect(det.derived.epaPerPlay).toBe(roundHalfAwayFromZero(weightedEpa, 4));

    // §3: pointsPerDrive weighted by drives is exactly pointsForTotal / drivesTotal.
    expect(det.derived.pointsPerDrive).toBe(
      roundHalfAwayFromZero(sumOf('pointsFor') / sumOf('drives'), 2)
    );
  });

  it('emits no nulls for redZoneTdRate on the 2024 source (every team has ≥ 37 season trips)', () => {
    for (const team of realPayload.teams) {
      expect(team.observed.redZoneTripsTotal).toBeGreaterThanOrEqual(37);
      expect(team.derived.redZoneTdRate).not.toBeNull();
    }
  });

  it('serializes deterministically (byte-identical for identical inputs)', () => {
    const again = buildPublicReport2024Payload(realConsumption, {
      generatedAt: GENERATED_AT,
      governedInputSha256: governedSourceSha256
    });
    expect(serializePublicReport2024Payload(again)).toBe(serializePublicReport2024Payload(realPayload));
  });
});
