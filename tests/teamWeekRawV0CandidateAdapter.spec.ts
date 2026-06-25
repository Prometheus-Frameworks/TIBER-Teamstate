import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { adaptTeamWeekRawV0Candidate } from '../src/adapters/teamWeekRawV0CandidateAdapter.js';
import { loadTeamWeekRawV0Candidate } from '../src/ingest/loadTeamWeekRawV0Candidate.js';

const fixturePath = path.resolve(
  process.cwd(),
  'data/fixtures/team_week_raw_candidate/team_week_raw_v0_2024_candidate.sample.json'
);

const loadFixture = (): unknown => JSON.parse(readFileSync(fixturePath, 'utf-8')) as unknown;

const withMetadata = (overrides: Record<string, unknown>): unknown => {
  const fixture = loadFixture() as { metadata: Record<string, unknown> };
  return { ...fixture, metadata: { ...fixture.metadata, ...overrides } };
};

const withGovernance = (overrides: Record<string, unknown> | undefined): unknown => {
  const fixture = loadFixture() as { metadata: Record<string, unknown> };
  const metadata = { ...fixture.metadata };
  if (overrides === undefined) {
    delete metadata.governance;
  } else {
    metadata.governance = { ...(metadata.governance as Record<string, unknown>), ...overrides };
  }
  return { ...fixture, metadata };
};

describe('teamWeekRawV0CandidateAdapter', () => {
  it('accepts a partial_real_data / ungoverned candidate artifact', () => {
    const result = adaptTeamWeekRawV0Candidate(loadFixture(), fixturePath);

    expect(result.upstream.provenanceStatus).toBe('partial_real_data');
    expect(result.upstream.governanceStatus).toBe('ungoverned');
    expect(result.upstream.governanceSource).toBe('not_set');
    expect(result.upstream.sourceArtifactPath).toBe(fixturePath);
    expect(result.upstream.deferredFields).toContain('pressureRateAllowed');
    expect(result.rows).toHaveLength(4);
    expect(result.rows.map((row) => row.teamCode)).toEqual(['ATL', 'KC', 'DET', 'BUF']);
  });

  it('preserves null pressureRateAllowed rather than coercing it to zero', () => {
    const result = adaptTeamWeekRawV0Candidate(loadFixture(), fixturePath);

    for (const row of result.rows) {
      expect(row.pressureRateAllowed).toBeNull();
      expect(row.pressureRateAllowed).not.toBe(0);
    }
  });

  it('preserves null fantasy-points fields rather than coercing them to zero', () => {
    const result = adaptTeamWeekRawV0Candidate(loadFixture(), fixturePath);
    const fantasyFields = [
      'fantasyPointsForQB',
      'fantasyPointsForRB',
      'fantasyPointsForWR',
      'fantasyPointsForTE',
      'fantasyPointsAllowedQB',
      'fantasyPointsAllowedRB',
      'fantasyPointsAllowedWR',
      'fantasyPointsAllowedTE'
    ] as const;

    for (const row of result.rows) {
      for (const field of fantasyFields) {
        expect(row[field]).toBeNull();
        expect(row[field]).not.toBe(0);
      }
    }
  });

  it('preserves null redZoneTdRate on a zero-red-zone-trips row', () => {
    const result = adaptTeamWeekRawV0Candidate(loadFixture(), fixturePath);
    const atlRow = result.rows.find((row) => row.teamCode === 'ATL');

    expect(atlRow?.redZoneTrips).toBe(0);
    expect(atlRow?.redZoneTdRate).toBeNull();
    expect(atlRow?.redZoneTdRate).not.toBe(0);
  });

  it('returns only the documented upstream/rows shape (no ranking, advice, or score fields)', () => {
    const result = adaptTeamWeekRawV0Candidate(loadFixture(), fixturePath);
    expect(Object.keys(result).sort()).toEqual(['rows', 'upstream']);
  });

  it('does not leak extra upstream row keys (gameId, isByeWeek, or a hypothetical score field)', () => {
    const fixture = loadFixture() as { rows: Array<Record<string, unknown>> } & Record<string, unknown>;
    const rowWithExtraKeys: Record<string, unknown> = {
      ...fixture.rows[0],
      score: 99,
      ranking: 1,
      advice: 'start him'
    };
    expect(rowWithExtraKeys.gameId).toBeDefined();
    expect(rowWithExtraKeys.isByeWeek).toBeDefined();

    const result = adaptTeamWeekRawV0Candidate({ ...fixture, rows: [rowWithExtraKeys] }, fixturePath);

    const expectedKeys = [
      'season',
      'week',
      'teamCode',
      'opponentCode',
      'pointsFor',
      'pointsAgainst',
      'offensivePlays',
      'neutralPlays',
      'secondsPerPlay',
      'passRate',
      'neutralPassRate',
      'rushRate',
      'epaPerPlay',
      'passEpaPerPlay',
      'rushEpaPerPlay',
      'successRate',
      'explosivePlayRate',
      'drives',
      'pointsPerDrive',
      'redZoneTrips',
      'redZoneTdRate',
      'sacksAllowed',
      'pressureRateAllowed',
      'turnovers',
      'fantasyPointsForQB',
      'fantasyPointsForRB',
      'fantasyPointsForWR',
      'fantasyPointsForTE',
      'fantasyPointsAllowedQB',
      'fantasyPointsAllowedRB',
      'fantasyPointsAllowedWR',
      'fantasyPointsAllowedTE'
    ].sort();

    expect(Object.keys(result.rows[0]!).sort()).toEqual(expectedKeys);
  });

  it('fails closed on governed_real_data provenance status', () => {
    const governedArtifact = withMetadata({ provenanceStatus: 'governed_real_data' });
    expect(() => adaptTeamWeekRawV0Candidate(governedArtifact, fixturePath)).toThrow(
      /provenanceStatus "governed_real_data" is not an accepted candidate-input status/
    );
  });

  it('fails closed on an unrecognized provenance status', () => {
    const unknownArtifact = withMetadata({ provenanceStatus: 'made_up_status' });
    expect(() => adaptTeamWeekRawV0Candidate(unknownArtifact, fixturePath)).toThrow(
      /not an accepted candidate-input status/
    );
  });

  it('fails closed when the governance block is missing entirely', () => {
    const noGovernanceArtifact = withGovernance(undefined);
    expect(() => adaptTeamWeekRawV0Candidate(noGovernanceArtifact, fixturePath)).toThrow(
      /metadata.governance block is required/
    );
  });

  it('fails closed when governanceStatus claims "governed"', () => {
    const governedArtifact = withGovernance({ governanceStatus: 'governed' });
    expect(() => adaptTeamWeekRawV0Candidate(governedArtifact, fixturePath)).toThrow(
      /governanceStatus "governed" is not an accepted candidate-input status/
    );
  });

  it('does not infer acceptance from a source path that claims governance', () => {
    // The metadata still says partial_real_data / ungoverned; only the path string claims promotion.
    // Acceptance must follow the metadata, never the path text.
    const result = adaptTeamWeekRawV0Candidate(
      loadFixture(),
      '/exports/governed_real_data/team_week_raw_v0_2024_promoted.json'
    );
    expect(result.upstream.provenanceStatus).toBe('partial_real_data');
    expect(result.upstream.sourceArtifactPath).toBe(
      '/exports/governed_real_data/team_week_raw_v0_2024_promoted.json'
    );
  });

  it('does not infer rejection-bypass from a source path that claims candidate status', () => {
    // The metadata claims governed; only the path string claims candidate/partial status. Must still reject.
    const governedArtifact = withGovernance({ governanceStatus: 'governed' });
    expect(() =>
      adaptTeamWeekRawV0Candidate(governedArtifact, '/exports/candidates/team_week_raw/partial_ungoverned.json')
    ).toThrow(/governanceStatus "governed" is not an accepted candidate-input status/);
  });

  it('fails closed on invalid artifact literal', () => {
    expect(() => adaptTeamWeekRawV0Candidate({ artifact: 'team_week_raw_v1', rows: [] }, fixturePath)).toThrow(
      /Invalid artifact literal/
    );
  });

  it('fails closed when rows are missing', () => {
    const fixture = loadFixture() as Record<string, unknown>;
    expect(() => adaptTeamWeekRawV0Candidate({ ...fixture, rows: undefined }, fixturePath)).toThrow(
      /rows must be an array/
    );
  });

  it('fails closed when a row is missing a required numeric-or-null field', () => {
    const fixture = loadFixture() as { rows: Array<Record<string, unknown>> } & Record<string, unknown>;
    const brokenRow = { ...fixture.rows[0] };
    delete brokenRow.epaPerPlay;

    expect(() => adaptTeamWeekRawV0Candidate({ ...fixture, rows: [brokenRow] }, fixturePath)).toThrow(
      /missing required field epaPerPlay/
    );
  });

  it('fails closed when a row field is neither a finite number nor null (e.g. NaN)', () => {
    const fixture = loadFixture() as { rows: Array<Record<string, unknown>> } & Record<string, unknown>;
    const brokenRow = { ...fixture.rows[0], successRate: Number.NaN };

    expect(() => adaptTeamWeekRawV0Candidate({ ...fixture, rows: [brokenRow] }, fixturePath)).toThrow(
      /successRate must be a finite number or null/
    );
  });

  it('loadTeamWeekRawV0Candidate reads the fixture file and preserves null pressure values', () => {
    const loaded = loadTeamWeekRawV0Candidate(fixturePath);

    expect(loaded.upstream.provenanceStatus).toBe('partial_real_data');
    expect(loaded.upstream.governanceStatus).toBe('ungoverned');
    expect(loaded.rows).toHaveLength(4);
    expect(loaded.rows.every((row) => row.pressureRateAllowed === null)).toBe(true);
  });
});
