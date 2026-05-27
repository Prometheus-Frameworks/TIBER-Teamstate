import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { adaptTeamWeekRawV0Artifact } from '../src/adapters/teamWeekRawV0Adapter.js';
import { loadRawTeamWeekRows } from '../src/ingest/loadRawTeamWeekRows.js';

const fixturePath = path.resolve(process.cwd(), 'data/fixtures/team_week_raw/team_week_raw_v0.sample.json');

describe('teamWeekRawV0Adapter', () => {
  it('adapts TIBER-Data fixture scaffold artifact rows to Teamstate raw rows', () => {
    const parsed = JSON.parse(readFileSync(fixturePath, 'utf-8')) as unknown;
    const adapted = adaptTeamWeekRawV0Artifact(parsed);

    expect(adapted.provenanceStatus).toBe('fixture_scaffold');
    expect(adapted.rows).toHaveLength(4);
    expect(adapted.rows.map((row) => row.team_code)).toEqual(['DET', 'PIT', 'TEN', 'MIA']);
    expect(adapted.rows[2]?.te_inline_allowed).toBeUndefined();
    expect(adapted.rows[2]?.te_split_allowed).toBeUndefined();
    expect(adapted.rows[0]?.fantasy_points_for_wr).toBe(35.1);
  });

  it('fails closed on invalid artifact literal', () => {
    expect(() => adaptTeamWeekRawV0Artifact({ artifact: 'team_week_raw_v1', rows: [] })).toThrow(
      /Invalid artifact literal/
    );
  });

  it('fails closed when rows are missing', () => {
    expect(() => adaptTeamWeekRawV0Artifact({ artifact: 'team_week_raw_v0' })).toThrow(/rows must be an array/);
  });

  it('loadRawTeamWeekRows supports team_week_raw_v0 envelope files', () => {
    const loaded = loadRawTeamWeekRows(fixturePath);
    expect(loaded.rows).toHaveLength(4);
    expect(loaded.provenanceStatus).toBe('fixture_scaffold');
    expect(loaded.rows.map((row) => row.team_code).sort()).toEqual(['DET', 'MIA', 'PIT', 'TEN']);
  });
});
