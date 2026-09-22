import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { WEEK1_EVIDENCE, WEEK1_FIELDS, WEEK1_GAMES, WEEK1_CANDIDATE_SHA256, WEEK1_SUPPORT_COMMIT } from '../src/provisional/week1Binding.js';
import { inspectWeek1Boxscore } from '../src/provisional/inspectWeek1Boxscore.js';
import { adaptWeek1ProvisionalPacket } from '../src/provisional/adaptWeek1ProvisionalPacket.js';

// Synthetic wrapper acceptance only. Never reads the real candidate or source files.
// Registered synthetic buffers substitute digests; all other inputs use real SHA-256.
const syntheticHashes = vi.hoisted(() => new Map<string, string>());
vi.mock('node:crypto', async importOriginal => {
  const real = await importOriginal<typeof import('node:crypto')>();
  return { ...real, createHash: (algorithm: string) => ({ update: (bytes: Uint8Array) => ({
    digest: (encoding: 'hex') => syntheticHashes.get(Buffer.from(bytes).toString('base64')) ?? real.createHash(algorithm).update(bytes).digest(encoding)
  }) }) };
});
function fixture() {
  let sourceRow = 2;
  return { schema_version: 'weekly_boxscore_publication_candidate_v0', status: 'candidate_needs_review', consumer_admitted: false,
    schedule_receipt: { source_support_commit: WEEK1_SUPPORT_COMMIT },
    coverage: { game_finality: 'unknown', full_week_final: false, schedule_coverage: 'matched',
      scheduled_game_ids: [...WEEK1_GAMES], observed_game_ids: [...WEEK1_GAMES], missing_game_ids: [], unexpected_game_ids: [] },
    candidate: { schema_version: 'weekly_boxscore_candidate_v0', status: 'candidate_needs_review', consumer_admitted: false,
      source_support_commit: WEEK1_SUPPORT_COMMIT, scope: { season: 2026, season_type: 'REG', week: 1 },
      players: [{ secret_player_value: 999 }],
      teams: WEEK1_GAMES.flatMap(game => { const pair = game.split('_').slice(2); return pair.map((team,i) => ({
        identity: { season: 2026, season_type: 'REG', week: 1, game_id: game, team, opponent_team: pair[1-i] },
        source: 'nflverse_stats_team', source_csv_row: sourceRow++,
        observed: Object.fromEntries([...WEEK1_FIELDS.map(f => [f, f === 'passing_yards' ? -2 : 0]), ['receiving_air_yards',999], ['fantasy_points',999]]),
        reconciliation: Object.fromEntries(WEEK1_FIELDS.map(f => [f,{status:'matched',player_sum:f==='passing_yards'?-2:0,team_value:f==='passing_yards'?-2:0}]))
      })); }) } };
}
const bytes = (value: unknown) => Buffer.from(JSON.stringify(value));
function syntheticPacket() {
  syntheticHashes.clear();
  return new Map(WEEK1_EVIDENCE.map((pin,i) => {
    let value: unknown = { synthetic: true, id: i, source_clock: 'synthetic clock', license: 'synthetic attribution' };
    if (pin.sha256 === WEEK1_CANDIDATE_SHA256) value = fixture();
    if (pin.path.endsWith('independent-review-2026-09-16.json')) value = {
      times: { retrieval: 'synthetic retrieval', compilation: 'synthetic compilation' },
      disposition: 'synthetic review', review_completed_at_UTC: 'synthetic review time'
    };
    const b = Buffer.from(JSON.stringify(value).padEnd(pin.size, ' '));
    expect(b.byteLength).toBe(pin.size);
    syntheticHashes.set(b.toString('base64'),pin.sha256);
    return [pin.path,b] as const;
  }));
}

describe('unadmitted synthetic shape inspection', () => {
  it('preserves source identity, zero, signed yards; strips excluded metrics and player data', () => {
    const result = inspectWeek1Boxscore(bytes(fixture()));
    expect(result.kind).toBe('unadmitted_shape_inspection');
    expect(result.rows).toHaveLength(32);
    expect(result.rows.find(r=>r.team==='LA')?.game_id).toBe('2026_01_SF_LA');
    expect(result.rows[0].observed.passing_yards).toBe(-2);
    expect(result.rows[0].observed.attempts).toBe(0);
    expect(Object.keys(result.rows[0].observed)).toEqual([...WEEK1_FIELDS]);
    expect(JSON.stringify(result)).not.toMatch(/secret_player_value|receiving_air_yards|fantasy_points/);
  });
  it('keeps null distinct from zero and reports missing reconciliation', () => {
    const input=fixture(); const row=input.candidate.teams[0];
    row.observed.attempts=null as unknown as number;
    row.reconciliation.attempts={status:'unknown',player_sum:null,team_value:null} as unknown as typeof row.reconciliation.attempts;
    const result=inspectWeek1Boxscore(bytes(input));
    expect(result.rows[0].observed.attempts).toBeNull();
    expect(result.fieldReadiness.find(r=>r.field==='attempts')).toMatchObject({finiteCount:31,nullCount:1,reconciliationUnknownCount:1});
  });
  it.each(['season','week','season_type'])('rejects wrong scope %s', field => {
    const input=fixture(); (input.candidate.scope as Record<string,unknown>)[field]='wrong';
    expect(()=>inspectWeek1Boxscore(bytes(input))).toThrow();
  });
  it.each(['duplicate','missing','opponent','game','row-season','row-pointer'])('rejects %s coverage/identity', mode => {
    const input=fixture();
    if(mode==='duplicate') input.candidate.teams[1]=input.candidate.teams[0];
    if(mode==='missing') input.candidate.teams.pop();
    if(mode==='opponent') input.candidate.teams[0].identity.opponent_team='KC';
    if(mode==='game') input.candidate.teams[0].identity.game_id='2026_02_ARI_LAC';
    if(mode==='row-season') input.candidate.teams[0].identity.season=2025;
    if(mode==='row-pointer') input.candidate.teams[1].source_csv_row=input.candidate.teams[0].source_csv_row;
    expect(()=>inspectWeek1Boxscore(bytes(input))).toThrow();
  });
  it.each(['negative','fractional','missing','conflict','dishonest-null'])('rejects %s metric', mode => {
    const input=fixture(); const row=input.candidate.teams[0];
    if(mode==='negative') row.observed.attempts=-1;
    if(mode==='fractional') row.observed.attempts=0.5;
    if(mode==='missing') delete row.observed.attempts;
    if(mode==='conflict') row.reconciliation.attempts.player_sum=3;
    if(mode==='dishonest-null') row.observed.attempts=null as unknown as number;
    expect(()=>inspectWeek1Boxscore(bytes(input))).toThrow();
  });
  it('rejects forged finality, admission, partial membership and oversize inputs', () => {
    const a=fixture();a.coverage.game_finality='final';expect(()=>inspectWeek1Boxscore(bytes(a))).toThrow();
    const b=fixture();b.consumer_admitted=true;expect(()=>inspectWeek1Boxscore(bytes(b))).toThrow();
    const c=fixture();c.coverage.observed_game_ids.pop();expect(()=>inspectWeek1Boxscore(bytes(c))).toThrow();
    expect(()=>inspectWeek1Boxscore(new Uint8Array(2_000_001))).toThrow('too large');
  });
  it('is deterministic across input ordering and does not mutate bytes', () => {
    const input=fixture();const original=bytes(input); const frozen=Buffer.from(original);
    const a=inspectWeek1Boxscore(original);input.candidate.teams.reverse();
    expect(inspectWeek1Boxscore(bytes(input))).toEqual(a);expect(original).toEqual(frozen);
  });
});

describe('exact fixed packet boundary (synthetic hash substitutions only)', () => {
  it('preserves clocks/manifest and separates acceptance from source admission', () => {
    const packet=syntheticPacket(); const result=adaptWeek1ProvisionalPacket(packet);
    expect(result.purposeAcceptance.status).toBe('operator_accepted_provisional_input');
    expect(result.sourceConsumerAdmitted).toBe(false);expect(result.consumerActivated).toBe(false);
    expect(result.gameFinality).toBe('unknown');expect(result.fullWeekFinal).toBe(false);
    expect(result.evidence.clocks).toEqual({retrieval:'synthetic retrieval',compilation:'synthetic compilation'});
    expect(result.evidence.manifest).toEqual(WEEK1_EVIDENCE);
    expect(result.evidence.sourceReceipt.source_clock).toBe('synthetic clock');
    expect(adaptWeek1ProvisionalPacket(packet)).toEqual(result);
    result.evidence.manifest[0].sha256='changed';expect(WEEK1_EVIDENCE[0].sha256).not.toBe('changed');
  });
  it('rejects a missing, extra, wrong-size or changed member without accepting replacement pins', () => {
    let p=syntheticPacket();p.delete(WEEK1_EVIDENCE[0].path);expect(()=>adaptWeek1ProvisionalPacket(p)).toThrow();
    p=syntheticPacket();p.set('extra',Buffer.alloc(0));expect(()=>adaptWeek1ProvisionalPacket(p)).toThrow();
    p=syntheticPacket();p.set(WEEK1_EVIDENCE[0].path,Buffer.alloc(1));expect(()=>adaptWeek1ProvisionalPacket(p)).toThrow();
    p=syntheticPacket();p.get(WEEK1_EVIDENCE[0].path)![0]=33;expect(()=>adaptWeek1ProvisionalPacket(p)).toThrow('hash mismatch');
  });
  it('rejects any changed evidence member, including reviews, receipts and code', () => {
    for(const pin of WEEK1_EVIDENCE) {
      const p=syntheticPacket(); p.get(pin.path)![0]=33;
      expect(()=>adaptWeek1ProvisionalPacket(p),pin.path).toThrow('hash mismatch');
    }
  });
  it('makes no network calls and has no runtime/score/writer imports', () => {
    const fetch=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('network forbidden'));
    try { adaptWeek1ProvisionalPacket(syntheticPacket()); expect(fetch).not.toHaveBeenCalled(); }
    finally { fetch.mockRestore(); }
    for(const name of ['adaptWeek1ProvisionalPacket','inspectWeek1Boxscore','week1Binding']) {
      const code=readFileSync(new URL(`../src/provisional/${name}.ts`,import.meta.url),'utf8');
      expect(code).not.toMatch(/from ['"].*(?:node:fs|http|score\/|pipeline\/|governed\/)/);
      expect(code).not.toMatch(/process\.env|Date\.now|writeFile|fetch\(/);
    }
  });
});
