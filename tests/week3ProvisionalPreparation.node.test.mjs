/** Synthetic interface tests only: no NFL values, raw sources, receipts or producer runs.
 * Run: node --test tests/week3ProvisionalPreparation.node.test.mjs
 * Uses installed TypeScript; never installs a dependency or accesses the network.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = mkdtempSync(join(tmpdir(), 'tts-week3-fixture-'));
after(() => rmSync(build, { recursive: true, force: true }));
const localCompiler = join(root, 'node_modules/typescript/bin/tsc');
const flags = ['--target', 'ES2022', '--module', 'commonjs', '--strict', '--skipLibCheck',
  '--rootDir', 'src/provisional', '--outDir', build,
  'src/provisional/inspectWeek3Boxscore.ts', 'src/provisional/week3BindingPreparation.ts'];
const result = spawnSync(existsSync(localCompiler) ? process.execPath : 'tsc',
  existsSync(localCompiler) ? [localCompiler, ...flags] : flags, { cwd: root, encoding: 'utf8' });
assert.equal(result.status, 0, `Installed TypeScript compilation failed (no download fallback): ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
const { inspectWeek3Boxscore } = await import(pathToFileURL(join(build, 'inspectWeek3Boxscore.js')).href);
const { WEEK3_FIELDS, WEEK3_GAMES, WEEK3_PREPARATION } = await import(pathToFileURL(join(build, 'week3BindingPreparation.js')).href);
const { WEEK1_FIELDS } = await import(pathToFileURL(join(build, 'week1Binding.js')).href);

function fixture() {
  // The fixed game keys exercise coverage only; every numeric field below is invented.
  const teams = WEEK3_GAMES.flatMap((game, i) => {
    const pair = game.split('_').slice(2);
    return pair.map((team, j) => ({
      identity: { season: 2026, season_type: 'REG', week: 3, game_id: game, team, opponent_team: pair[1-j] },
      source: 'nflverse_stats_team', source_csv_row: 2 + i * 2 + j,
      observed: Object.fromEntries(WEEK3_FIELDS.map(field => [field, 1])),
      reconciliation: Object.fromEntries(WEEK3_FIELDS.map(field => [field, { status: 'matched', player_sum: 1, team_value: 1 }])),
    }));
  });
  return {
    fixture_only: true,
    schema_version: 'weekly_boxscore_publication_candidate_v0', status: 'candidate_needs_review', consumer_admitted: false,
    coverage: { scheduled_game_ids: [...WEEK3_GAMES], observed_game_ids: [...WEEK3_GAMES], missing_game_ids: [], unexpected_game_ids: [],
      game_finality: 'unknown', full_week_final: false, schedule_coverage: 'matched' },
    candidate: { schema_version: 'weekly_boxscore_candidate_v0', status: 'candidate_needs_review', consumer_admitted: false,
      scope: { season: 2026, season_type: 'REG', week: 3 }, teams },
  };
}
const bytes = value => new TextEncoder().encode(JSON.stringify(value));
const inspect = (value = fixture()) => inspectWeek3Boxscore(bytes(value));

test('copies exactly ten fields for 32 synthetic reciprocal rows, not an admitted artifact', () => {
  const f = fixture(), result = inspect(f);
  assert.equal(result.kind, 'unadmitted_shape_inspection'); assert.equal(result.rows.length, 32);
  assert.deepEqual(WEEK3_FIELDS, WEEK1_FIELDS);
  assert(Object.isFrozen(WEEK3_FIELDS)); assert(Object.isFrozen(WEEK3_GAMES)); assert(Object.isFrozen(WEEK3_PREPARATION));
  assert.equal(WEEK3_PREPARATION.realInputEnabled, false);
  assert.equal(WEEK3_PREPARATION.candidateGeneratedAt, null); assert.equal(WEEK3_PREPARATION.qualifiedInputReview, null);
  assert.deepEqual(Object.keys(result).sort(), ['fieldReadiness', 'kind', 'rows']);
  for (const row of result.rows) { assert.equal(row.week, 3); assert.deepEqual(Object.keys(row.observed), [...WEEK3_FIELDS]); }
  assert(result.fieldReadiness.every(r => r.finiteCount === 32 && r.nullCount === 0));
  assert.deepEqual(inspect(f), result);
});
test('preserves null and unknown rather than zero', () => {
  const f = fixture(), row = f.candidate.teams[0];
  row.observed.attempts = null; row.reconciliation.attempts = { status: 'unknown', player_sum: null, team_value: null };
  const result = inspect(f);
  assert.equal(result.rows[0].observed.attempts, null);
  assert.equal(result.fieldReadiness.find(r => r.field === 'attempts').nullCount, 1);
});
test('does not infer advanced deployment or consume player/scoring/air-yard extras', () => {
  const f = fixture(); f.candidate.players = [{ targets: 999 }]; f.candidate.teams[0].observed.receiving_air_yards = 999;
  const result = inspect(f);
  assert(!('receiving_air_yards' in result.rows[0].observed)); assert(!('players' in result)); assert(!('routes' in result));
});
for (const scope of [{ week: 2 }, { week: 4 }, { season: 2025 }, { season_type: 'POST' }]) test(`rejects wrong scope ${JSON.stringify(scope)}`, () => {
  const f = fixture(); Object.assign(f.candidate.scope, scope); assert.throws(() => inspect(f));
});
for (const nested of [false, true]) test(`rejects ${nested ? 'nested' : 'outer'} admission and status changes`, () => {
  const f = fixture(); (nested ? f.candidate : f).consumer_admitted = true; assert.throws(() => inspect(f));
  const g = fixture(); (nested ? g.candidate : g).status = 'accepted'; assert.throws(() => inspect(g));
});
test('rejects mismatched row week, source, opponent, duplicates and missing teams', () => {
  for (const mutate of [
    f => { f.candidate.teams[0].identity.week = 2; },
    f => { f.candidate.teams[0].source = 'fixture_unknown_source'; },
    f => { f.candidate.teams[0].identity.opponent_team = 'BAD'; },
    f => { f.candidate.teams[1] = f.candidate.teams[0]; },
    f => { f.candidate.teams[1].source_csv_row = f.candidate.teams[0].source_csv_row; },
    f => { f.candidate.teams.pop(); },
  ]) { const f = fixture(); mutate(f); assert.throws(() => inspect(f)); }
});
test('rejects false finality and conflicting/incomplete schedule membership', () => {
  for (const mutate of [
    f => { f.coverage.full_week_final = true; },
    f => { f.coverage.game_finality = 'final'; },
    f => { f.coverage.schedule_coverage = 'partial'; },
    f => { f.coverage.scheduled_game_ids[0] = '2026_02_FAKE_GAME'; },
    f => { f.coverage.observed_game_ids[1] = f.coverage.observed_game_ids[0]; },
    f => { f.coverage.missing_game_ids.push(WEEK3_GAMES[0]); },
  ]) { const f = fixture(); mutate(f); assert.throws(() => inspect(f)); }
});
test('rejects metric corruption, incorrect reconciliation and unavailable-as-matched', () => {
  for (const mutate of [
    f => { f.candidate.teams[0].observed.attempts = -1; },
    f => { f.candidate.teams[0].observed.attempts = '1'; },
    f => { f.candidate.teams[0].observed.attempts = 1.5; },
    f => { f.candidate.teams[0].reconciliation.attempts.player_sum = 2; },
    f => { f.candidate.teams[0].reconciliation.attempts.team_value = 2; },
    f => { f.candidate.teams[0].reconciliation.attempts.player_sum = null; },
    f => { delete f.candidate.teams[0].observed.attempts; },
  ]) { const f = fixture(); mutate(f); assert.throws(() => inspect(f)); }
});
test('allows signed yardage but not negative count fields', () => {
  const f = fixture(); f.candidate.teams[0].observed.passing_yards = -1;
  f.candidate.teams[0].reconciliation.passing_yards = { status: 'matched', player_sum: -1, team_value: -1 };
  assert.equal(inspect(f).rows[0].observed.passing_yards, -1);
});
test('rejects oversized, malformed and invalid UTF-8 input', () => {
  assert.throws(() => inspectWeek3Boxscore(new Uint8Array(2_000_001)), /too large/);
  assert.throws(() => inspectWeek3Boxscore(new Uint8Array([0xff])));
  assert.throws(() => inspectWeek3Boxscore(new TextEncoder().encode('{')));
});
