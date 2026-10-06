/** Closed packet preparation. No provider access, receipt creation or acceptance application. */
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { WEEK4_PACKET as B } from './week4PacketBinding.js';

export const week4Digest = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
export function week4Object(value: unknown): Record<string, any> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Week 4 object required');
  return value as Record<string, any>;
}
export const week4Parse = (bytes: Uint8Array) => week4Object(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
function equal(actual: unknown, expected: unknown, label: string): void {
  if (!isDeepStrictEqual(actual, expected)) throw new Error(`Week 4 ${label} mismatch`);
}
export function week4ClockMicros(value: string): bigint {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 19) !== value.slice(0, 19)) throw new Error('Invalid Week 4 clock');
  const fraction = /\.(\d{1,6})Z$/.exec(value)?.[1] ?? '';
  return BigInt(Date.parse(value.replace(/\.\d+Z$/, 'Z'))) * 1000n + BigInt(fraction.padEnd(6, '0'));
}
export function week4Pin(path: string) {
  const item = B.pins.find(pin => pin.path === path);
  if (!item) throw new Error('Unbound Week 4 member');
  return item;
}
/** Authenticate all members and take owned copies before any parse or inspection. */
export function authenticateWeek4Evidence(packet: ReadonlyMap<string, Uint8Array>): Map<string, Uint8Array> {
  if (!(packet instanceof Map) || packet.size !== B.pins.length) throw new Error('Exact 16-file Week 4 packet required');
  const verified = new Map<string, Uint8Array>();
  for (const expected of B.pins) {
    const bytes = packet.get(expected.path);
    if (!(bytes instanceof Uint8Array) || bytes.byteLength !== expected.size) throw new Error('Week 4 missing/wrong-size member');
    const owned = new Uint8Array(bytes);
    if (week4Digest(owned) !== expected.sha256) throw new Error('Week 4 member hash mismatch');
    verified.set(expected.path, owned);
  }
  return verified;
}
/** Synthetic semantic seam. Authentication is a separate mandatory wrapper gate. */
export function assertWeek4EvidenceSemantics(documents: { buildWitness: unknown; inventory: unknown; review: unknown }): void {
  const w = week4Object(documents.buildWitness), m = week4Object(documents.inventory), r = week4Object(documents.review);
  equal(w, B.buildWitness, 'build witness');
  equal(m.schema_version, 'week4_preparation_input_inventory_v1', 'inventory schema');
  equal(m.status, 'candidate_only_inventory_not_consumer_binding', 'inventory lifecycle');
  equal(m.scope, B.scope, 'inventory scope'); equal(m.members, B.inventoryMembers, 'complete inventory members');
  equal(m.independent_review, null, 'historical pending inventory');
  for (const [key, expected] of Object.entries({ schema_version: 'independent_week4_data_review_v1',
    reviewed_head: B.reviewedDataHead, reviewed_tree: B.reviewedDataTree, candidate_path: B.candidatePath,
    candidate_sha256: week4Pin(B.candidatePath).sha256, source_support_commit: B.sourceSupportCommit,
    producer_code_commit: B.producerCodeCommit, review_completed_at: B.qualifiedAt,
    input_inventory_sha256: week4Pin(B.auditPath + 'input-inventory.json').sha256,
    build_witness_sha256: week4Pin(B.auditPath + 'build-witness.json').sha256,
    disposition: 'clean_with_non_blocking_notes', material_findings: [], actionable_findings: [],
    independent_reviewer: true, author_of_reviewed_packet: false, consumer_admitted: false })) equal(r[key], expected, `review ${key}`);
  const normalize = (s: string) => s.replace(/\+00:00$/, 'Z');
  if (week4ClockMicros(normalize(w.build_started_at)) > week4ClockMicros(B.candidateGeneratedAt) ||
      week4ClockMicros(B.candidateGeneratedAt) > week4ClockMicros(B.qualifiedAt)) throw new Error('Week 4 chronology mismatch');
}
export function assertWeek4EmbeddedReceipts(documents: { envelope: unknown; sourceReceipt: unknown; scheduleReceipt: unknown }): void {
  const e = week4Object(documents.envelope), c = week4Object(e.candidate);
  equal(c.scope, B.scope, 'candidate scope');
  equal(c.source_support_commit, B.sourceSupportCommit, 'source support');
  equal(c.source_receipt, documents.sourceReceipt, 'embedded source receipt');
  equal(e.schedule_receipt, { ...week4Object(documents.scheduleReceipt), source_support_commit: B.sourceSupportCommit }, 'embedded schedule receipt');
  equal(e.source_receipt_sha256, week4Pin(B.paths.sourceReceipt).sha256, 'source receipt digest');
  equal(e.builder_sha256, week4Pin(B.paths.publisher).sha256, 'publisher digest');
  equal(e.fact_builder_sha256, week4Pin(B.paths.builder).sha256, 'fact builder digest');
}
