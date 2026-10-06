import { WEEK4_PACKET as B } from './week4PacketBinding.js';
import { authenticateWeek4Evidence, assertWeek4EvidenceSemantics, assertWeek4EmbeddedReceipts,
  week4Parse, week4Pin } from './week4PacketQualification.js';
import { inspectWeek4Boxscore } from './inspectWeek4Boxscore.js';

export { authenticateWeek4Evidence, assertWeek4EvidenceSemantics, assertWeek4EmbeddedReceipts };
const identity = (path: string) => { const p = week4Pin(path); return { sha256: p.sha256, size: p.size }; };

/** Pure closed wrapper; separate real-input execution decision required. No acceptance application. */
export function adaptWeek4ProvisionalPacket(packet: ReadonlyMap<string, Uint8Array>) {
  const verified = authenticateWeek4Evidence(packet);
  const json = (path: string) => week4Parse(verified.get(path)!);
  assertWeek4EvidenceSemantics({ buildWitness: json(B.auditPath + 'build-witness.json'),
    inventory: json(B.auditPath + 'input-inventory.json'), review: json(B.auditPath + 'independent-review.json') });
  assertWeek4EmbeddedReceipts({ envelope: json(B.candidatePath), sourceReceipt: json(B.paths.sourceReceipt),
    scheduleReceipt: json(B.paths.scheduleReceipt) });
  const inspected = inspectWeek4Boxscore(verified.get(B.candidatePath)!);
  return {
    artifact: 'teamstate_week4_authenticated_description_pending_purpose_v1' as const,
    purposeAcceptance: { status: 'pending' as const, receipt: null },
    productionReady: false, consumerActivated: false, sourceConsumerAdmitted: false,
    sourceCandidateStatus: 'candidate_needs_review' as const,
    gameFinality: 'unknown' as const, fullWeekFinal: false, sourceRecordFinalization: 'unestablished' as const,
    correctionStatus: 'provisional_full_history_unestablished' as const, sourceObservationCutoff: null,
    generation: { kind: 'new_candidate_materialization' as const, startedAt: B.buildWitness.build_started_at,
      completedAt: B.candidateGeneratedAt, buildWitness: identity(B.auditPath + 'build-witness.json') },
    evidence: { candidate: identity(B.candidatePath), supportCommit: B.sourceSupportCommit,
      review: { ...identity(B.auditPath + 'independent-review.json'), reviewedHead: B.reviewedDataHead,
        reviewedTree: B.reviewedDataTree, storageHead: B.storageHead, completedAt: B.qualifiedAt,
        disposition: 'clean_with_non_blocking_notes' as const }, inputInventory: identity(B.auditPath + 'input-inventory.json'),
      members: B.pins.map(pin => ({ ...pin })) },
    coverage: { scheduledGameIds: [...B.games], observedGameIds: [...B.games], missingGameIds: [],
      unexpectedGameIds: [], teamRows: 32, meaning: 'schedule_membership_only' as const },
    rows: inspected.rows, fieldReadiness: inspected.fieldReadiness,
    unavailable: ['pressure', 'pace', 'neutral_pass_rate', 'epa', 'explosive_rate', 'drives', 'red_zone',
      'team_score', 'fantasy_points', 'movement_verdict'],
    excluded: ['receiving_air_yards', 'player_rows', 'unattributed_player_identity', 'provider_fantasy_totals']
  };
}
