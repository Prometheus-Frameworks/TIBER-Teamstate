/** Synthetic checks only. No real input reads, producer runs, network or installation. */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, delimiter } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = mkdtempSync(join(tmpdir(), 'tts-week3-binding-'));
after(() => rmSync(build, { recursive: true, force: true }));
const compiler = join(root, 'node_modules/typescript/bin/tsc');
// Resolve installed declarations independently of checkout-local dependencies.
// No install/download fallback; Node's runtime module resolution may supply them.
function nodeTypeRoots(checkout) {
  const installedCompilers = (process.env.PATH ?? '').split(delimiter)
    .map(path => join(path, 'tsc')).filter(existsSync).map(path => realpathSync(path));
  for (const location of [join(checkout, 'package.json'), process.execPath, ...installedCompilers]) {
    try {
      const declarations = createRequire(location).resolve('@types/node/package.json');
      return [dirname(dirname(declarations))];
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }
  throw new Error('Installed @types/node declarations required (no download fallback)');
}
const project = join(build, 'tsconfig.json');
const compiled = join(build, 'compiled');
writeFileSync(project, JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'CommonJS', strict: true,
  skipLibCheck: true, rootDir: join(root, 'src/provisional'), outDir: compiled,
  typeRoots: nodeTypeRoots(root), types: ['node'] },
  files: [join(root, 'src/provisional/adaptWeek3ProvisionalPacket.ts')], include: [] }));
const run = spawnSync(existsSync(compiler) ? process.execPath : 'tsc', existsSync(compiler) ? [compiler, '--project', project] : ['--project', project], { cwd: root, encoding: 'utf8' });
assert.equal(run.status, 0, `Strict compilation failed: ${run.error ?? ''}\n${run.stdout}\n${run.stderr}`);
const api = await import(pathToFileURL(join(compiled, 'adaptWeek3ProvisionalPacket.js')).href);
const { WEEK3_BINDING: B, WEEK3_EVIDENCE: E, WEEK3_AUDIT_PATH: A, WEEK3_CANDIDATE_PATH: C,
  WEEK3_SOURCE_RECEIPT_PATH: S } = await import(pathToFileURL(join(compiled, 'week3Binding.js')).href);
const { WEEK3_FIELDS: F, WEEK3_GAMES: G } = await import(pathToFileURL(join(compiled, 'week3BindingPreparation.js')).href);
const pin = path => E.find(p => p.path === path);
const identity = path => ({ sha256: pin(path).sha256, size: pin(path).size });
const bytes = value => new TextEncoder().encode(JSON.stringify(value));
const hash = value => createHash('sha256').update(value).digest('hex');
function semanticFixture() {
  const sourceReceipt = { fixture_only: true, nested: { alpha: 1, beta: 2 } };
  const scheduleReceipt = { fixture_only: true, source_support_commit: B.supportCommit };
  return {
    envelope: { candidate: { source_support_commit: B.supportCommit, source_receipt: structuredClone(sourceReceipt) },
      schedule_receipt: structuredClone(scheduleReceipt), source_receipt_sha256: pin(S).sha256,
      builder_sha256: pin('scripts/publish_weekly_boxscore_candidate_v0.py').sha256,
      fact_builder_sha256: pin('scripts/build_weekly_boxscore_candidate_v0.py').sha256 },
    sourceReceipt, scheduleReceipt,
    manifest: { schema_version: 'week3_replay_member_manifest_v1', members: E.slice(0, 13).map(p => ({ ...p })),
      build_receipt: { file: 'build-receipt.json', ...identity(A + 'build-receipt.json') }, candidate_sha256: pin(C).sha256,
      selected_data_head: B.sourceHead, source_support_commit: B.supportCommit, implementation_commit: B.implementationBase,
      consumer_admitted: false, independent_review: 'pending' },
    buildReceipt: { schema_version: 'week3_fresh_replay_generation_witness_v1', base: B.implementationBase,
      selected_data_head: B.sourceHead, support_commit: B.supportCommit, candidate_path: C, witness_kind: B.replayKind,
      build_started_at: B.replayStartedAt, build_completed_at: B.replayCompletedAt, original_candidate_generated_at: null,
      evidence_cutoff: null, finality: 'unknown', source_admission: false, rop_purpose_acceptance: false, independent_review: 'pending',
      result: { sha256: pin(C).sha256, status: 'candidate_revision_written' },
      checks: { candidate_byte_equal: true, repeat_publication: 'unchanged', second_replay_byte_equal: true, support_ancestor: true } },
    review: { schema_version: 'week3_independent_repair_review_v1', disposition: 'clean', material_findings: [], data: {
      reviewed_head: B.reviewedDataHead, tree: B.reviewedDataTree, parent: B.sourceHead, candidate_sha256: pin(C).sha256,
      manifest_members_authenticated: 13, original_generation_clock: 'unknown', tree_equivalence_verified: true,
      fresh_independent_replay_started_at: '2026-10-03T15:37:01.315004Z', fresh_independent_replay_completed_at: '2026-10-03T15:37:01.594796Z' } }
  };
}
test('closed pins contain 16 immutable members and distinguish review from storage', () => {
  assert.equal(E.length, 16); assert.equal(new Set(E.map(p => p.path)).size, 16);
  assert(Object.isFrozen(E)); assert(E.every(Object.isFrozen)); assert(Object.isFrozen(B));
  assert.notEqual(B.reviewedDataHead, B.storageHead); assert.equal(B.originalCandidateGeneratedAt, null);
});
test('synthetic semantic assertions preserve historical pending receipts', () => {
  const f = semanticFixture(), before = structuredClone(f);
  assert.equal(api.assertWeek3ReplaySemantics(f), undefined); assert.deepEqual(f, before);
});
test('structural embedded receipt equality ignores property order', () => {
  const f = semanticFixture(); f.envelope.candidate.source_receipt = { nested: { beta: 2, alpha: 1 }, fixture_only: true };
  f.envelope.schedule_receipt = { source_support_commit: B.supportCommit, fixture_only: true };
  api.assertWeek3ReplaySemantics(f);
});
for (const [label, mutate] of [
  ['source receipt mismatch', f => { f.envelope.candidate.source_receipt.nested.alpha = 2; }],
  ['schedule receipt mismatch', f => { f.envelope.schedule_receipt.extra = true; }],
  ['candidate support', f => { f.envelope.candidate.source_support_commit = 'bad'; }],
  ['receipt digest', f => { f.envelope.source_receipt_sha256 = '0'.repeat(64); }],
  ['publisher digest', f => { f.envelope.builder_sha256 = '0'.repeat(64); }],
  ['missing manifest member', f => { f.manifest.members.pop(); }],
  ['extra manifest member', f => { f.manifest.members.push(f.manifest.members[0]); }],
  ['wrong manifest source', f => { f.manifest.selected_data_head = 'bad'; }],
  ['unbound receipt', f => { f.manifest.build_receipt.sha256 = '0'.repeat(64); }],
  ['rewritten pending receipt', f => { f.buildReceipt.independent_review = 'clean'; }],
  ['rewritten pending manifest', f => { f.manifest.independent_review = 'clean'; }],
  ['false original clock', f => { f.buildReceipt.original_candidate_generated_at = B.replayCompletedAt; }],
  ['wrong replay kind', f => { f.buildReceipt.witness_kind = 'original'; }],
  ['reversed clocks', f => { f.buildReceipt.build_started_at = '2026-10-04T00:00:00Z'; }],
  ['wrong candidate', f => { f.buildReceipt.result.sha256 = '0'.repeat(64); }],
  ['source admission', f => { f.buildReceipt.source_admission = true; }],
  ['premature purpose', f => { f.buildReceipt.rop_purpose_acceptance = true; }],
  ['false cutoff', f => { f.buildReceipt.evidence_cutoff = B.replayCompletedAt; }],
  ['missing clean review', f => { f.review.disposition = 'pending'; }],
  ['material review finding', f => { f.review.material_findings = ['P1']; }],
  ['storage head substituted', f => { f.review.data.reviewed_head = B.storageHead; }],
  ['wrong reviewed tree', f => { f.review.data.tree = '0'.repeat(40); }],
  ['review precedes replay', f => { f.review.data.fresh_independent_replay_started_at = '2026-10-02T00:00:00Z'; }],
]) test(`fails closed: ${label}`, () => { const f = semanticFixture(); mutate(f); assert.throws(() => api.assertWeek3ReplaySemantics(f)); });
test('packet gate rejects empty, extra, wrong-size and hash-drift synthetic bytes', () => {
  assert.throws(() => api.authenticateWeek3Evidence(new Map()));
  const p = new Map(E.map(pin => [pin.path, new Uint8Array(pin.size)]));
  assert.throws(() => api.authenticateWeek3Evidence(p), /hash mismatch/);
  p.set(E[0].path, new Uint8Array(1)); assert.throws(() => api.authenticateWeek3Evidence(p), /wrong-size/);
  p.set('extra', new Uint8Array()); assert.throws(() => api.authenticateWeek3Evidence(p), /16-file/);
  assert.throws(() => api.adaptWeek3ProvisionalPacket(new Map()));
});
const anchors = { producerReviewCompletedAt: '2026-10-05T20:00:00Z', receiptSha256: '', receiptSize: 0, teamstateHead: '1'.repeat(40), ropHead: '2'.repeat(40), producerReviewSha256: '3'.repeat(64) };
function purposeFixture() {
  return { schema_version: 'teamstate_week3_provisional_purpose_receipt_v1', status: 'operator_accepted_provisional_input',
    purpose: 'teamstate_ten_field_description', scope: { season: 2026, season_type: 'REG', week: 3 },
    fields: [...F], games: [...G], teams: G.flatMap(game => game.split('_').slice(2)).sort(),
    code_heads: { teamstate: anchors.teamstateHead, rop: anchors.ropHead }, producer_review_sha256: anchors.producerReviewSha256,
    input_manifest_sha256: B.inputManifestSha256, candidate_sha256: pin(C).sha256,
    replay: { kind: B.replayKind, started_at: B.replayStartedAt, completed_at: B.replayCompletedAt,
      original_candidate_generated_at: null, build_receipt: identity(A + 'build-receipt.json') },
    source_review: { ...identity(A + 'independent-review.json'), reviewed_head: B.reviewedDataHead,
      reviewed_tree: B.reviewedDataTree, storage_head: B.storageHead }, accepted_at: '2026-10-05T20:00:01Z',
    source_admission: false, consumer_activation: false, real_input_execution_authorized: false };
}
const verify = f => { const b = bytes(f); return api.verifyWeek3PurposeReceipt(b, { ...anchors, receiptSha256: hash(b), receiptSize: b.length }); };
test('synthetic future receipt verification returns no acceptance or artifact and mutates nothing', () => {
  const f = purposeFixture(), before = structuredClone(f); assert.equal(verify(f), undefined); assert.deepEqual(f, before);
});
for (const [label, mutate] of [
  ['purpose', f => { f.purpose = 'forecast'; }], ['scope', f => { f.scope.week = 2; }],
  ['fields', f => { f.fields.push('pressure'); }], ['teams', f => { f.teams.pop(); }], ['games', f => { f.games.pop(); }],
  ['code head', f => { f.code_heads.teamstate = '4'.repeat(40); }],
  ['review digest', f => { f.producer_review_sha256 = '4'.repeat(64); }],
  ['manifest', f => { f.input_manifest_sha256 = '4'.repeat(64); }],
  ['replay', f => { f.replay.original_candidate_generated_at = B.replayCompletedAt; }],
  ['source review', f => { f.source_review.reviewed_head = B.storageHead; }],
  ['admission', f => { f.source_admission = true; }], ['execution', f => { f.real_input_execution_authorized = true; }],
  ['activation', f => { f.consumer_activation = true; }], ['acceptance clock', f => { f.accepted_at = '2026-01-01T00:00:00Z'; }],
  ['unknown key', f => { f.anything = true; }],
]) test(`purpose fails closed: ${label}`, () => { const f = purposeFixture(); mutate(f); assert.throws(() => verify(f)); });
test('purpose receipt rejects mismatched immutable byte anchors and caller booleans', () => {
  const b = bytes(purposeFixture()), a = { ...anchors, receiptSha256: hash(b), receiptSize: b.length };
  assert.throws(() => api.verifyWeek3PurposeReceipt(b, { ...a, receiptSize: b.length + 1 }));
  assert.throws(() => api.verifyWeek3PurposeReceipt(b, { ...a, receiptSha256: '0'.repeat(64) }));
  assert.throws(() => api.verifyWeek3PurposeReceipt(bytes(true), a));
});

test('installed compiler compiles without checkout-local Node types', () => {
  const checkout = join(build, 'empty-checkout');
  assert.equal(existsSync(join(checkout, 'node_modules/@types')), false);
  const config = JSON.parse(readFileSync(project, 'utf8'));
  config.compilerOptions.typeRoots = nodeTypeRoots(checkout);
  const fallbackProject = join(build, 'fallback-tsconfig.json');
  writeFileSync(fallbackProject, JSON.stringify(config));
  const fallback = spawnSync(existsSync(compiler) ? process.execPath : 'tsc',
    existsSync(compiler) ? [compiler, '--project', fallbackProject] : ['--project', fallbackProject],
    { cwd: root, encoding: 'utf8' });
  assert.equal(fallback.status, 0, `Global compilation failed: ${fallback.error ?? ''}\n${fallback.stdout}\n${fallback.stderr}`);
});
test('acceptance cannot predate the independently approved final producer review', () => {
  for (const time of ['2026-10-05T00:00:00Z', '2026-10-05T19:59:59Z']) {
    const f = purposeFixture(); f.accepted_at = time;
    assert.throws(() => verify(f), /acceptance clock/);
  }
  const f = purposeFixture(); f.accepted_at = anchors.producerReviewCompletedAt;
  assert.equal(verify(f), undefined);
});
test('producer review completion anchor is required, valid and later than Data review', () => {
  const b = bytes(purposeFixture()), a = { ...anchors, receiptSha256: hash(b), receiptSize: b.length };
  for (const time of [undefined, '', 'invalid', '2026-10-02T00:00:00Z', '2026-10-05T21:00:00Z']) {
    assert.throws(() => api.verifyWeek3PurposeReceipt(b, { ...a, producerReviewCompletedAt: time }));
  }
});
