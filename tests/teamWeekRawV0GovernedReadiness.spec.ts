import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { adaptTeamWeekRawV0Governed } from '../src/adapters/teamWeekRawV0GovernedAdapter.js';
import { buildTeamWeekRawV0GovernedReadiness } from '../src/governed/teamWeekRawV0GovernedReadiness.js';

const fixturePath = path.resolve(process.cwd(), 'data/fixtures/team_week_raw_governed/team_week_raw_v0_2024_governed.sample.json');
const loadFixture = (): Record<string, unknown> => JSON.parse(readFileSync(fixturePath, 'utf-8')) as Record<string, unknown>;
const withMetadata = (overrides: Record<string, unknown>): Record<string, unknown> => {
  const fixture = loadFixture();
  fixture.metadata = { ...(fixture.metadata as Record<string, unknown>), ...overrides };
  return fixture;
};
const withGovernance = (overrides: Record<string, unknown> | undefined): Record<string, unknown> => {
  const fixture = loadFixture();
  const metadata = { ...(fixture.metadata as Record<string, unknown>) };
  if (overrides === undefined) delete metadata.governance;
  else metadata.governance = { ...(metadata.governance as Record<string, unknown>), ...overrides };
  fixture.metadata = metadata;
  return fixture;
};

describe('team_week_raw_v0 governed readiness boundary', () => {
  it('accepts only the explicit governed_real_data / governed / explicit_marker contract', () => {
    const consumption = adaptTeamWeekRawV0Governed(loadFixture(), fixturePath);

    expect(consumption.upstream.provenanceStatus).toBe('governed_real_data');
    expect(consumption.upstream.governance.governanceStatus).toBe('governed');
    expect(consumption.upstream.governance.governanceSource).toBe('explicit_marker');
    expect(consumption.upstream.sourceArtifacts).toContain('nflverse-data:pbp/play_by_play_2024');
    expect(consumption.upstream.validationReportPath).toContain('.validation.json');
    expect(consumption.upstream.lineageManifestPath).toContain('.manifest.json');
  });

  it('fails closed on missing, malformed, or non-explicit governance metadata', () => {
    expect(() => adaptTeamWeekRawV0Governed(withMetadata({ provenanceStatus: 'partial_real_data' }), fixturePath)).toThrow(/provenanceStatus must be governed_real_data/);
    expect(() => adaptTeamWeekRawV0Governed(withGovernance(undefined), fixturePath)).toThrow(/metadata.governance block is required/);
    expect(() => adaptTeamWeekRawV0Governed(withGovernance({ governanceStatus: 'ungoverned' }), fixturePath)).toThrow(/governanceStatus must be governed/);
    expect(() => adaptTeamWeekRawV0Governed(withGovernance({ governanceSource: 'path_inference' }), fixturePath)).toThrow(/governanceSource must be explicit_marker/);
  });

  it('preserves pressure as null/deferred and never accepts zero-fill or sacks inference', () => {
    const consumption = adaptTeamWeekRawV0Governed(loadFixture(), fixturePath);
    expect(consumption.rows.every((row) => row.pressureRateAllowed === null)).toBe(true);

    const zeroPressure = loadFixture() as { rows: Array<Record<string, unknown>> } & Record<string, unknown>;
    zeroPressure.rows[0] = { ...zeroPressure.rows[0], pressureRateAllowed: 0 };
    expect(() => adaptTeamWeekRawV0Governed(zeroPressure, fixturePath)).toThrow(/pressureRateAllowed must be null\/deferred/);

    const missingPressureDeferral = withMetadata({ deferredFields: [] });
    expect(() => adaptTeamWeekRawV0Governed(missingPressureDeferral, fixturePath)).toThrow(/deferredFields must include pressureRateAllowed/);
  });

  it('forbids fantasy split fields at the governed Teamstate boundary', () => {
    const withFantasy = loadFixture() as { rows: Array<Record<string, unknown>> } & Record<string, unknown>;
    withFantasy.rows[0] = { ...withFantasy.rows[0], fantasyPointsForQB: null };
    expect(() => adaptTeamWeekRawV0Governed(withFantasy, fixturePath)).toThrow(/forbidden fantasy split field fantasyPointsForQB/);
  });

  it('emits the smallest governed readiness report without scoring, training, or pressure laundering', () => {
    const report = buildTeamWeekRawV0GovernedReadiness(adaptTeamWeekRawV0Governed(loadFixture(), fixturePath));

    expect(report.kind).toBe('team_week_raw_v0_governed_readiness');
    expect(report.teamstateGovernedArtifact).toBe(true);
    expect(report.productionReady).toBe(false);
    expect(report.pressurePosture).toBe('unavailable_insufficient_data_deferred');
    expect(report.deferredInsufficientFields).toContain('pressureRateAllowed');
    expect(report.availableFields).not.toContain('pressureRateAllowed');
    const redZone = report.fieldReadiness.find((field) => field.field === 'redZoneTdRate')!;
    expect(redZone.status).toBe('partial_nulls');
    expect(redZone.nullCount).toBeGreaterThan(0);
    expect(report.partialNullFields).toContain('redZoneTdRate');
    expect(Object.keys(report).sort()).toEqual([
      'artifact', 'availableFields', 'coverage', 'deferredFields', 'deferredInsufficientFields',
      'fieldReadiness', 'governance', 'kind', 'lineageManifestPath', 'notes', 'partialNullFields',
      'pressurePosture', 'productionReady', 'provenanceStatus', 'readinessStatus', 'rowCount',
      'sourceArtifactPath', 'sourceArtifacts', 'teamstateGovernedArtifact', 'upstreamFieldReadiness',
      'validationReportPath'
    ].sort());
  });
});
