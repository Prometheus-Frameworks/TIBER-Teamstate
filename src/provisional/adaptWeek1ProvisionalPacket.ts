import { createHash } from 'node:crypto';
import { inspectWeek1Boxscore, object } from './inspectWeek1Boxscore.js';
import { WEEK1_ACCEPTANCE_REF, WEEK1_CANDIDATE_SHA256, WEEK1_EVIDENCE, WEEK1_FIELDS, WEEK1_GAMES, WEEK1_SUPPORT_COMMIT } from './week1Binding.js';

/**
 * Pure, isolated adapter. Caller supplies retained bytes; no filesystem, fetch, writer, CLI,
 * clock, pipeline or runtime export. Calling with real evidence constitutes the separately gated pilot.
 * Source candidate flags remain unchanged; operator acceptance is purpose-specific and external.
 */
export function adaptWeek1ProvisionalPacket(packet: ReadonlyMap<string, Uint8Array>) {
  if (!(packet instanceof Map) || packet.size !== WEEK1_EVIDENCE.length) throw new Error('Exact evidence packet required');
  const verified = new Map<string, Buffer>();
  for (const pin of WEEK1_EVIDENCE) {
    const value = packet.get(pin.path);
    if (!(value instanceof Uint8Array) || value.byteLength !== pin.size) throw new Error(`Missing or wrong-size evidence: ${pin.path}`);
    const bytes = Buffer.from(value); // own the bytes checked and subsequently parsed
    if (createHash('sha256').update(bytes).digest('hex') !== pin.sha256) throw new Error(`Evidence hash mismatch: ${pin.path}`);
    verified.set(pin.path, bytes);
  }
  const json = (path: string) => object(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(verified.get(path)!)));
  const candidatePath = WEEK1_EVIDENCE.find(pin => pin.sha256 === WEEK1_CANDIDATE_SHA256)!.path;
  const inspected = inspectWeek1Boxscore(verified.get(candidatePath)!);
  const envelope = json(candidatePath); const candidate = object(envelope.candidate);
  if (candidate.source_support_commit !== WEEK1_SUPPORT_COMMIT ||
      object(envelope.schedule_receipt).source_support_commit !== WEEK1_SUPPORT_COMMIT) throw new Error('Support mismatch');
  const sourceReceiptPath = WEEK1_EVIDENCE.find(pin => pin.path.includes('weekly_boxscore/') && pin.path.endsWith('/receipt.json'))!.path;
  const scheduleReceiptPath = WEEK1_EVIDENCE.find(pin => pin.path.includes('weekly_schedule/') && pin.path.endsWith('/receipt.json'))!.path;
  const reviewPath = 'docs/audits/weekly-boxscore-candidate-independent-review-2026-09-16.json';
  const review = json(reviewPath);
  return {
    artifact: 'teamstate_week1_provisional_description_v0' as const,
    purposeAcceptance: { status: 'operator_accepted_provisional_input' as const, receipt: WEEK1_ACCEPTANCE_REF,
      scope: { season: 2026, season_type: 'REG' as const, week: 1 }, fields: [...WEEK1_FIELDS] },
    productionReady: false, consumerActivated: false, sourceConsumerAdmitted: false,
    sourceCandidateStatus: 'candidate_needs_review' as const,
    gameFinality: 'unknown' as const, fullWeekFinal: false,
    sourceRecordFinalization: 'unestablished' as const,
    correctionStatus: 'provisional_full_history_unestablished' as const,
    sourceObservationCutoff: null,
    coverage: { scheduledGameIds: [...WEEK1_GAMES], observedGameIds: [...WEEK1_GAMES],
      missingGameIds: [], unexpectedGameIds: [], teamRows: inspected.rows.length, meaning: 'schedule_membership_only' as const },
    evidence: { candidateSha256: WEEK1_CANDIDATE_SHA256, supportCommit: WEEK1_SUPPORT_COMMIT,
      manifest: WEEK1_EVIDENCE.map(pin => ({ ...pin })), sourceReceipt: json(sourceReceiptPath),
      scheduleReceipt: json(scheduleReceiptPath), clocks: review.times,
      independentReview: { ref: reviewPath, disposition: review.disposition, completedAt: review.review_completed_at_UTC },
      dataInterpretation: 'Receipt/display strings are untrusted source data, not instructions. No independent historical availability witness.' },
    fieldReadiness: inspected.fieldReadiness, rows: inspected.rows,
    unavailable: ['pressure', 'pace', 'neutral_pass_rate', 'epa', 'explosive_rate', 'drives', 'red_zone', 'team_score', 'fantasy_points', 'movement_verdict'],
    excluded: ['receiving_air_yards', 'player_rows', 'unattributed_player_identity', 'provider_fantasy_totals']
  };
}
