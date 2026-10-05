import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { inspectWeek3Boxscore, object } from './inspectWeek3Boxscore.js';
import { WEEK3_FIELDS, WEEK3_GAMES } from './week3BindingPreparation.js';
import { WEEK3_BINDING as B, WEEK3_EVIDENCE, WEEK3_AUDIT_PATH as A, WEEK3_CANDIDATE_PATH as C,
  WEEK3_SOURCE_RECEIPT_PATH as S, WEEK3_SCHEDULE_RECEIPT_PATH as R } from './week3Binding.js';

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const parse = (bytes: Uint8Array) => object(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
function equal(actual: unknown, expected: unknown, label: string): void {
  if (!isDeepStrictEqual(actual, expected)) throw new Error(`Invalid ${label}`);
}
const pin = (path: string) => WEEK3_EVIDENCE.find(item => item.path === path)!;
const identity = (path: string) => ({ sha256: pin(path).sha256, size: pin(path).size });

/** Byte authentication only. No parsing, inspection, acceptance, clock or producer execution. */
export function authenticateWeek3Evidence(packet: ReadonlyMap<string, Uint8Array>): Map<string, Uint8Array> {
  if (!(packet instanceof Map) || packet.size !== WEEK3_EVIDENCE.length) throw new Error('Exact 16-file evidence packet required');
  const verified = new Map<string, Uint8Array>();
  for (const expected of WEEK3_EVIDENCE) {
    const input = packet.get(expected.path);
    if (!(input instanceof Uint8Array) || input.byteLength !== expected.size) throw new Error(`Missing or wrong-size evidence: ${expected.path}`);
    const owned = new Uint8Array(input);
    if (digest(owned) !== expected.sha256) throw new Error(`Evidence hash mismatch: ${expected.path}`);
    verified.set(expected.path, owned);
  }
  return verified;
}

/** Semantic assertions only; exported for synthetic tests. Does not authenticate or return an artifact. */
export function assertWeek3ReplaySemantics(documents: {
  envelope: unknown; sourceReceipt: unknown; scheduleReceipt: unknown;
  buildReceipt: unknown; manifest: unknown; review: unknown;
}): void {
  const e = object(documents.envelope), c = object(e.candidate);
  equal(c.source_support_commit, B.supportCommit, 'candidate support');
  equal(object(e.schedule_receipt).source_support_commit, B.supportCommit, 'schedule support');
  // Preserve the retained Week 2 repair: receipt equality is structural, not key-order-sensitive.
  equal(c.source_receipt, documents.sourceReceipt, 'embedded source receipt');
  equal(e.schedule_receipt, documents.scheduleReceipt, 'embedded schedule receipt');
  equal(e.source_receipt_sha256, pin(S).sha256, 'source receipt digest');
  equal(e.builder_sha256, pin('scripts/publish_weekly_boxscore_candidate_v0.py').sha256, 'publisher digest');
  equal(e.fact_builder_sha256, pin('scripts/build_weekly_boxscore_candidate_v0.py').sha256, 'builder digest');
  const m = object(documents.manifest), b = object(documents.buildReceipt), r = object(documents.review);
  equal(m.schema_version, 'week3_replay_member_manifest_v1', 'manifest schema');
  equal(m.members, WEEK3_EVIDENCE.slice(0, 13).map(({ path, commit, size, sha256 }) => ({ path, commit, size, sha256 })), 'manifest members');
  equal(m.build_receipt, { file: 'build-receipt.json', ...identity(A + 'build-receipt.json') }, 'manifest build receipt');
  for (const [key, value] of Object.entries({ candidate_sha256: pin(C).sha256, selected_data_head: B.sourceHead,
    source_support_commit: B.supportCommit, implementation_commit: B.implementationBase, consumer_admitted: false,
    independent_review: 'pending' })) equal(m[key], value, `manifest ${key}`);
  for (const [key, value] of Object.entries({ schema_version: 'week3_fresh_replay_generation_witness_v1',
    base: B.implementationBase, selected_data_head: B.sourceHead, support_commit: B.supportCommit,
    candidate_path: C, witness_kind: B.replayKind, build_started_at: B.replayStartedAt,
    build_completed_at: B.replayCompletedAt, original_candidate_generated_at: null, evidence_cutoff: null,
    finality: 'unknown', source_admission: false, rop_purpose_acceptance: false, independent_review: 'pending' })) equal(b[key], value, `build ${key}`);
  equal(b.result, { sha256: pin(C).sha256, status: 'candidate_revision_written' }, 'build result');
  equal(b.checks, { candidate_byte_equal: true, repeat_publication: 'unchanged', second_replay_byte_equal: true, support_ancestor: true }, 'build checks');
  if (Date.parse(B.replayStartedAt) > Date.parse(B.replayCompletedAt)) throw new Error('Reversed replay clocks');
  equal(r.schema_version, 'week3_independent_repair_review_v1', 'review schema');
  equal(r.disposition, 'clean', 'later review disposition'); equal(r.material_findings, [], 'review findings');
  const data = object(r.data);
  for (const [key, value] of Object.entries({ reviewed_head: B.reviewedDataHead, tree: B.reviewedDataTree,
    parent: B.sourceHead, candidate_sha256: pin(C).sha256, manifest_members_authenticated: 13,
    original_generation_clock: 'unknown', tree_equivalence_verified: true })) equal(data[key], value, `review ${key}`);
  equal(data.fresh_independent_replay_started_at, '2026-10-03T15:37:01.315004Z', 'review replay start');
  equal(data.fresh_independent_replay_completed_at, '2026-10-03T15:37:01.594796Z', 'review replay completion');
}

/** Pure closed wrapper. Real input invocation needs a separate grant; preparation runs synthetic checks only.
 * It never accepts/applies purpose approval. A validated future receipt is a separate gate. */
export function adaptWeek3ProvisionalPacket(packet: ReadonlyMap<string, Uint8Array>) {
  const verified = authenticateWeek3Evidence(packet);
  const json = (path: string) => parse(verified.get(path)!);
  assertWeek3ReplaySemantics({ envelope: json(C), sourceReceipt: json(S), scheduleReceipt: json(R),
    buildReceipt: json(A + 'build-receipt.json'), manifest: json(A + 'manifest.json'), review: json(A + 'independent-review.json') });
  const inspected = inspectWeek3Boxscore(verified.get(C)!);
  return {
    artifact: 'teamstate_week3_authenticated_description_pending_purpose_v1' as const,
    purposeAcceptance: { status: 'pending' as const, receipt: null },
    productionReady: false, consumerActivated: false, sourceConsumerAdmitted: false,
    sourceCandidateStatus: 'candidate_needs_review' as const, gameFinality: 'unknown' as const,
    fullWeekFinal: false, sourceRecordFinalization: 'unestablished' as const,
    correctionStatus: 'provisional_full_history_unestablished' as const, sourceObservationCutoff: null,
    replay: { kind: B.replayKind, startedAt: B.replayStartedAt, completedAt: B.replayCompletedAt,
      originalCandidateGeneratedAt: null, buildReceipt: identity(A + 'build-receipt.json') },
    evidence: { candidate: identity(C), supportCommit: B.supportCommit, sourceHead: B.sourceHead,
      review: { ...identity(A + 'independent-review.json'), reviewedHead: B.reviewedDataHead,
        reviewedTree: B.reviewedDataTree, storageHead: B.storageHead, disposition: 'clean' as const },
      manifest: WEEK3_EVIDENCE.map(item => ({ ...item })) },
    coverage: { scheduledGameIds: [...WEEK3_GAMES], observedGameIds: [...WEEK3_GAMES],
      missingGameIds: [], unexpectedGameIds: [], teamRows: 32, meaning: 'schedule_membership_only' as const },
    rows: inspected.rows, fieldReadiness: inspected.fieldReadiness,
    unavailable: ['pressure', 'pace', 'neutral_pass_rate', 'epa', 'explosive_rate', 'drives', 'red_zone', 'team_score', 'fantasy_points', 'movement_verdict'],
    excluded: ['receiving_air_yards', 'player_rows', 'unattributed_player_identity', 'provider_fantasy_totals']
  };
}

export interface Week3PurposeReceiptExpectation {
  receiptSha256: string; receiptSize: number;
  teamstateHead: string; ropHead: string; producerReviewSha256: string; producerReviewCompletedAt: string;
}
/** Verify only. Expectations must come from the separately approved final run proposal, NOT the receipt.
 * No receipt creation, signing, file writing, acceptance application or execution occurs here. */
export function verifyWeek3PurposeReceipt(bytes: Uint8Array, expected: Week3PurposeReceiptExpectation): void {
  const validClock = (value: unknown): value is string => typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(value) && Number.isFinite(Date.parse(value));
  // This trusted anchor binds completion of review of BOTH final implementation heads.
  // It must be approved independently of the receipt, together with the review digest.
  if (!validClock(expected.producerReviewCompletedAt) ||
      Date.parse(expected.producerReviewCompletedAt) < Date.parse('2026-10-03T15:37:01.594796Z')) throw new Error('Invalid independently approved producer review clock');
  if (!/^[a-f0-9]{64}$/.test(expected.receiptSha256) || !/^[a-f0-9]{64}$/.test(expected.producerReviewSha256) ||
      !/^[a-f0-9]{40}$/.test(expected.teamstateHead) || !/^[a-f0-9]{40}$/.test(expected.ropHead) ||
      !Number.isSafeInteger(expected.receiptSize) || expected.receiptSize < 1 || expected.receiptSize > 65536) throw new Error('Invalid independently approved receipt anchors');
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== expected.receiptSize) throw new Error('Purpose receipt size mismatch');
  const owned = new Uint8Array(bytes);
  if (digest(owned) !== expected.receiptSha256) throw new Error('Purpose receipt hash mismatch');
  const receipt = parse(owned);
  equal(Object.keys(receipt).sort(), ['schema_version', 'status', 'purpose', 'scope', 'fields', 'teams', 'games', 'code_heads',
    'producer_review_sha256', 'input_manifest_sha256', 'replay', 'source_review', 'candidate_sha256', 'accepted_at',
    'source_admission', 'consumer_activation', 'real_input_execution_authorized'].sort(), 'purpose receipt keys');
  equal(receipt.schema_version, 'teamstate_week3_provisional_purpose_receipt_v1', 'purpose receipt schema');
  equal(receipt.status, 'operator_accepted_provisional_input', 'purpose status');
  equal(receipt.purpose, 'teamstate_ten_field_description', 'purpose');
  equal(receipt.scope, { season: 2026, season_type: 'REG', week: 3 }, 'purpose scope');
  equal(receipt.fields, [...WEEK3_FIELDS], 'purpose fields');
  equal(receipt.games, [...WEEK3_GAMES], 'purpose games');
  equal(receipt.teams, WEEK3_GAMES.flatMap(game => game.split('_').slice(2)).sort(), 'purpose teams');
  equal(receipt.code_heads, { teamstate: expected.teamstateHead, rop: expected.ropHead }, 'purpose code heads');
  equal(receipt.producer_review_sha256, expected.producerReviewSha256, 'producer review');
  equal(receipt.input_manifest_sha256, B.inputManifestSha256, 'authenticated input manifest');
  equal(receipt.candidate_sha256, pin(C).sha256, 'purpose candidate');
  equal(receipt.replay, { kind: B.replayKind, started_at: B.replayStartedAt, completed_at: B.replayCompletedAt,
    original_candidate_generated_at: null, build_receipt: identity(A + 'build-receipt.json') }, 'purpose replay');
  equal(receipt.source_review, { ...identity(A + 'independent-review.json'), reviewed_head: B.reviewedDataHead,
    reviewed_tree: B.reviewedDataTree, storage_head: B.storageHead }, 'purpose source review');
  for (const key of ['source_admission', 'consumer_activation', 'real_input_execution_authorized']) equal(receipt[key], false, `purpose ${key}`);
  if (!validClock(receipt.accepted_at) ||
      Date.parse(receipt.accepted_at) < Date.parse(expected.producerReviewCompletedAt)) throw new Error('Invalid purpose acceptance clock');
}
