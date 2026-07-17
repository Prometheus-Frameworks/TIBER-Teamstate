import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { adaptTeamWeekRawV0Governed } from '../src/adapters/teamWeekRawV0GovernedAdapter.js';
import { loadTeamWeekRawV0Governed } from '../src/ingest/loadTeamWeekRawV0Governed.js';

const GOVERNED_SOURCE_PATH = path.resolve(
  process.cwd(),
  'data/governed/team_week_raw_v0_2024_real_source_candidate.json'
);

const governedRow = {
  season: 2024,
  week: 1,
  teamCode: 'ARI',
  opponentCode: 'BUF',
  pointsFor: 28,
  pointsAgainst: 34,
  offensivePlays: 60,
  neutralPlays: 50,
  secondsPerPlay: 26,
  passRate: 0.644068,
  neutralPassRate: 0.6,
  rushRate: 0.355932,
  epaPerPlay: 0.046561,
  passEpaPerPlay: 0.158981,
  rushEpaPerPlay: -0.156866,
  successRate: 0.372881,
  explosivePlayRate: 0.101695,
  drives: 9,
  pointsPerDrive: 3.111111,
  redZoneTrips: 4,
  redZoneTdRate: 0.5,
  sacksAllowed: 4,
  pressureRateAllowed: null,
  turnovers: 1
};

const governedEnvelope = (metadataExtras: Record<string, unknown>): unknown => ({
  artifact: 'team_week_raw_v0',
  generatedAt: '2026-06-27T13:42:06+00:00',
  season: 2024,
  sourceArtifacts: ['nflverse-data:pbp/play_by_play_2024'],
  rows: [governedRow],
  metadata: {
    provenanceStatus: 'governed_real_data',
    governance: { governanceStatus: 'governed', governanceSource: 'explicit_marker' },
    deferredFields: ['pressureRateAllowed'],
    ...metadataExtras
  }
});

describe('teamWeekRawV0GovernedAdapter metadata.inputSources pass-through (issue #90 §1)', () => {
  it('preserves sourceRefs, sourceSnapshotAt, and checksum for each source of the real governed artifact', () => {
    const consumption = loadTeamWeekRawV0Governed(GOVERNED_SOURCE_PATH);

    expect(consumption.upstream.inputSources).toEqual([
      {
        sourceRefs: ['nflverse-data:pbp/play_by_play_2024'],
        sourceSnapshotAt: '2026-06-27T13:42:00+00:00',
        checksum: {
          algorithm: 'sha256',
          value: '6d432dd4308329bfddaef633309ea119f9ca46d52cbb3c09f47172a2e8efcd01'
        }
      },
      {
        sourceRefs: ['nflverse-data:schedules/games'],
        sourceSnapshotAt: '2026-06-27T13:42:05+00:00',
        checksum: {
          algorithm: 'sha256',
          value: '179ea0a014159b3aa4da59eee756272dd33ec876d704fb46650c08118fe75a05'
        }
      }
    ]);
  });

  it('passes through an absent metadata.inputSources as an empty array (no new governance judgment)', () => {
    const consumption = adaptTeamWeekRawV0Governed(governedEnvelope({}), 'synthetic.json');
    expect(consumption.upstream.inputSources).toEqual([]);
  });

  it('preserves malformed entries positionally with []/null pieces so downstream can fail closed on them', () => {
    const consumption = adaptTeamWeekRawV0Governed(
      governedEnvelope({
        inputSources: [
          'not-an-object',
          { sourceRefs: ['ref-a'], sourceSnapshotAt: '2026-01-01T00:00:00+00:00' },
          { sourceRefs: ['ref-b'], sourceSnapshotAt: '2026-01-02T00:00:00+00:00', checksum: { algorithm: 'sha256' } },
          { sourceRefs: [42, 'ref-c'], sourceSnapshotAt: 7, checksum: { algorithm: 'sha256', value: 'abc123' } }
        ]
      }),
      'synthetic.json'
    );

    expect(consumption.upstream.inputSources).toEqual([
      { sourceRefs: [], sourceSnapshotAt: null, checksum: null },
      { sourceRefs: ['ref-a'], sourceSnapshotAt: '2026-01-01T00:00:00+00:00', checksum: null },
      { sourceRefs: ['ref-b'], sourceSnapshotAt: '2026-01-02T00:00:00+00:00', checksum: null },
      { sourceRefs: ['ref-c'], sourceSnapshotAt: null, checksum: { algorithm: 'sha256', value: 'abc123' } }
    ]);
  });

  it('keeps the existing fail-closed governance checks unchanged by the extension', () => {
    const envelope = governedEnvelope({
      inputSources: [{ sourceRefs: ['ref-a'], sourceSnapshotAt: '2026-01-01T00:00:00+00:00' }]
    }) as { metadata: Record<string, unknown> };
    envelope.metadata.provenanceStatus = 'partial_real_data';

    expect(() => adaptTeamWeekRawV0Governed(envelope, 'synthetic.json')).toThrow(
      /provenanceStatus must be governed_real_data/
    );
  });
});
