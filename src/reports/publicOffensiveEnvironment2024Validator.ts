/**
 * Validator for `teamstate_public_offensive_environment_2024_v1` (contract §9, §10).
 *
 * Enforces every publication invariant in §8 and returns the contract's stable, machine-readable
 * rejection codes. Behavior on any rejection is uniform and fail-closed: the report version must
 * not be published and no partial/best-effort route may be served.
 *
 * Evidence is **internally bound**, not caller-asserted:
 *
 * - The governed rows and upstream source metadata used for coverage, formula-conformance, and
 *   provenance checks are parsed/adapted from the EXACT byte buffer whose sha256 is recomputed —
 *   a caller cannot pair the authentic checksum with different rows or forged source metadata.
 * - The candidate's canonical JSON serialization is computed internally for the immutability
 *   comparison; there is no caller-supplied serialization to substitute.
 * - The supplied HTML must be byte-identical to the deterministic render of the validated payload
 *   (§4/§6: same scope, provenance, warnings, and values — closed byte-for-byte), in addition to
 *   the semantic extraction checks that give precise rejection codes.
 * - A publishable result carries a `binding` (exact `report_version_id` + sha256 digests of the
 *   canonical JSON and validated HTML), generated internally. The publication transition
 *   (`applyPublicReportPublication` / `publishPublicReportVersion`) accepts only a result whose
 *   binding names the exact entry being published and whose content matches those digests — a
 *   genuine case-#20 result for one version can never publish another.
 *
 * Missing evidence is itself a rejection under the corresponding stable code — the validator
 * never silently skips a check it lacks the inputs to perform. A passing validation is necessary
 * but NOT sufficient for publication (invariant 12).
 */

import {
  adaptTeamWeekRawV0Governed,
  type TeamWeekRawGovernedInputSource,
  type TeamWeekRawGovernedRow
} from '../adapters/teamWeekRawV0GovernedAdapter.js';
import {
  PUBLIC_REPORT_2024_APPROVED_METHODOLOGY_VERSIONS,
  PUBLIC_REPORT_2024_BLOCKED_DENOMINATOR_FIELDS,
  PUBLIC_REPORT_2024_CANONICAL_URL_JSON,
  PUBLIC_REPORT_2024_DECLARED_SCOPE,
  PUBLIC_REPORT_2024_DERIVED_FIELDS,
  PUBLIC_REPORT_2024_DERIVED_PRECISION,
  PUBLIC_REPORT_2024_EXCLUDED_LANES,
  PUBLIC_REPORT_2024_EXPECTED_TEAMS,
  PUBLIC_REPORT_2024_FORBIDDEN_TEAM_FIELDS,
  PUBLIC_REPORT_2024_GOVERNED_INPUT_PIN,
  PUBLIC_REPORT_2024_LINEAGE_MANIFEST_REF,
  PUBLIC_REPORT_2024_OBSERVED_FIELDS,
  PUBLIC_REPORT_2024_UPSTREAM_CHECKSUM_VERIFICATION,
  PUBLIC_REPORT_2024_VALIDATION_REPORT_REF,
  PUBLIC_REPORT_2024_WARNING_CODES,
  TEAMSTATE_PUBLIC_OFFENSIVE_ENVIRONMENT_2024_V1_ARTIFACT,
  TEAMSTATE_PUBLIC_OFFENSIVE_ENVIRONMENT_2024_V1_SCHEMA_VERSION,
  buildPublicReport2024VersionUrlJson,
  type PublicReport2024Payload,
  type PublicReport2024RejectionCode
} from '../contracts/teamstatePublicOffensiveEnvironment2024V1.js';
import {
  extractPublicReport2024HtmlSemantics,
  formatPublicReport2024Value,
  renderPublicReport2024Html
} from './publicOffensiveEnvironment2024Html.js';
import {
  computePublicReport2024Coverage,
  computeSha256Hex,
  deriveTeamSeasonRecord,
  roundHalfAwayFromZero,
  serializePublicReport2024Payload
} from './publicOffensiveEnvironment2024Report.js';
import {
  validatePublicReportRegistry,
  type TeamstateServiceMetadata
} from './publicReportRegistry.js';

export interface PublicReport2024Rejection {
  code: PublicReport2024RejectionCode;
  detail: string;
}

/** §8 invariant 12: an explicit, recorded human publication approval for an exact version. */
export interface PublicationApprovalRecord {
  report_version_id: string;
  approved_by: string;
  approved_at: string;
}

export interface ValidatePublicReport2024Context {
  /**
   * The committed governed source bytes — the single root of trust. The sha256 recompute, the
   * rows used for coverage/formula conformance, and the upstream source metadata are all derived
   * from this exact buffer. Absent bytes fail closed.
   */
  governedSourceBytes?: Buffer;
  /**
   * Rendered HTML for this exact version. Must be byte-identical to the deterministic render of
   * the validated payload. Absent HTML fails closed (`E_HTML_JSON_SEMANTIC_MISMATCH`).
   */
  html?: string;
  /**
   * The mutable registry state (§8 invariant 11). Absent state fails closed
   * (`E_REGISTRY_STATE_INVALID`).
   */
  registry?: TeamstateServiceMetadata;
  /** Recorded human publication approvals (§8 invariant 12). */
  approvals?: readonly PublicationApprovalRecord[];
  /**
   * Previously published frozen content for this `report_version_id`, if any (legitimately absent
   * for a first publication). The candidate's canonical serialization/render are computed
   * internally and must reproduce the published bytes exactly (§8 invariant 9, matrix #15) —
   * there is no caller-supplied candidate serialization to substitute.
   */
  previouslyPublished?: { json?: string; html?: string };
}

/**
 * Internally generated binding of a publishable result to the exact validated content: the
 * publication transition requires it and verifies the frozen content against these digests.
 */
export interface PublicReport2024ValidationBinding {
  report_version_id: string;
  json_sha256: string;
  html_sha256: string;
}

export interface PublicReport2024ValidationResult {
  rejections: PublicReport2024Rejection[];
  /** True only when zero rejections fired — §10 case #20 is the only publishable state. */
  publishable: boolean;
  /** Present iff `publishable` — binds this result to the exact version and content validated. */
  binding: PublicReport2024ValidationBinding | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** §5 checksum discipline: exactly `{algorithm: "sha256", value: <64-char lowercase hex>}`. */
const isSha256Checksum = (value: unknown): value is { algorithm: 'sha256'; value: string } =>
  isRecord(value) &&
  Object.keys(value).length === 2 &&
  value.algorithm === 'sha256' &&
  typeof value.value === 'string' &&
  SHA256_HEX_PATTERN.test(value.value);

const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

/** A real ISO-8601 timestamp: pattern-conformant and parseable to a finite instant. */
const isIsoTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && ISO_TIMESTAMP_PATTERN.test(value) && Number.isFinite(Date.parse(value));

const REPORT_VERSION_ID_PATTERN = new RegExp(
  `^${TEAMSTATE_PUBLIC_OFFENSIVE_ENVIRONMENT_2024_V1_ARTIFACT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.r[1-9]\\d*$`
);

/** §5 top-level payload shape — exactly these keys. */
const PAYLOAD_TOP_LEVEL_KEYS = [
  'artifact',
  'schema_version',
  'report_version_id',
  'canonical_url',
  'version_url',
  'declared_scope',
  'coverage',
  'source_snapshot_at',
  'generated_at',
  'provenance_status',
  'governance',
  'methodology_version',
  'governed_input',
  'upstream_sources',
  'validation_report',
  'lineage_manifest',
  'excluded_lanes',
  'warnings',
  'teams'
] as const;

const COVERAGE_KEYS = [
  'team_count',
  'expected_team_count',
  'team_game_row_count',
  'expected_team_game_rows',
  'missing_teams',
  'unexpected_teams',
  'is_full_league',
  'satisfies_declared_scope'
] as const;

const GOVERNED_INPUT_KEYS = ['artifact_id', 'repository', 'path', 'checksum', 'checksum_verification'] as const;

const UPSTREAM_SOURCE_KEYS = ['source_ref', 'source_snapshot_at', 'checksum', 'checksum_verification'] as const;

/** Keys rejected as supersession smuggling (E_VERSION_IDENTITY_MUTABLE), not merely undocumented. */
const SUPERSESSION_KEYS = ['supersession_status', 'superseded_by', 'status'] as const;

const KNOWN_WARNING_CODES = new Set<string>(Object.values(PUBLIC_REPORT_2024_WARNING_CODES));

/** HTML status-text patterns that would render registry state into an immutable page (§6). */
const FORBIDDEN_HTML_STATUS_PATTERNS: RegExp[] = [
  /supersed/i,
  /you are viewing the current/i,
  /this is the current (?:report|version)/i,
  /data-report-status/i
];

export const validatePublicReport2024 = (
  payload: PublicReport2024Payload,
  context: ValidatePublicReport2024Context = {}
): PublicReport2024ValidationResult => {
  const rejections: PublicReport2024Rejection[] = [];
  const reject = (code: PublicReport2024RejectionCode, detail: string): void => {
    rejections.push({ code, detail });
  };
  const raw = payload as unknown as Record<string, unknown>;

  // --- Root of trust: parse rows + upstream metadata from the exact bytes being hashed ---
  let sourceRows: TeamWeekRawGovernedRow[] | undefined;
  let sourceInputSources: TeamWeekRawGovernedInputSource[] | undefined;
  if (context.governedSourceBytes === undefined) {
    reject(
      'E_GOVERNED_INPUT_CHECKSUM_MISMATCH',
      'committed governed source bytes not supplied — the mandatory fresh local recompute could not be performed; failing closed'
    );
    reject(
      'E_UNWEIGHTED_AGGREGATION_USED',
      'governed rows unavailable without the governed source bytes — coverage and §3 formula conformance could not be verified; failing closed'
    );
  } else {
    try {
      const adapted = adaptTeamWeekRawV0Governed(
        JSON.parse(context.governedSourceBytes.toString('utf-8')) as unknown,
        'governed-bytes-under-validation'
      );
      sourceRows = adapted.rows;
      sourceInputSources = adapted.upstream.inputSources;
    } catch (error) {
      // An unparseable or fail-closed-refused governed source is by definition not acceptably
      // governed; rows/metadata are unavailable, so those checks fail closed too.
      reject(
        'E_PROVENANCE_NOT_GOVERNED',
        `governed source bytes failed fail-closed adaptation: ${(error as Error).message}`
      );
      reject(
        'E_UNWEIGHTED_AGGREGATION_USED',
        'governed rows unavailable (bytes failed adaptation) — §3 formula conformance could not be verified; failing closed'
      );
    }
  }

  // --- Exact §5 top-level shape ---
  for (const key of Object.keys(raw)) {
    if ((SUPERSESSION_KEYS as readonly string[]).includes(key)) {
      continue; // Rejected below as E_VERSION_IDENTITY_MUTABLE, the more specific violation.
    }
    if (!(PAYLOAD_TOP_LEVEL_KEYS as readonly string[]).includes(key)) {
      reject('E_UNDOCUMENTED_FIELD_PRESENT', `payload top-level field ${key} is not part of the §5 contract shape`);
    }
  }
  for (const key of PAYLOAD_TOP_LEVEL_KEYS) {
    if (!(key in raw)) {
      reject('E_UNDOCUMENTED_FIELD_PRESENT', `payload is missing required §5 field ${key}`);
    }
  }

  // --- Artifact / schema / methodology identity (§5 literals, §8 invariant 4) ---
  if (raw.artifact !== TEAMSTATE_PUBLIC_OFFENSIVE_ENVIRONMENT_2024_V1_ARTIFACT) {
    reject(
      'E_METHODOLOGY_VERSION_UNKNOWN',
      `artifact ${String(raw.artifact)} is not the approved report artifact ` +
        TEAMSTATE_PUBLIC_OFFENSIVE_ENVIRONMENT_2024_V1_ARTIFACT
    );
  }
  if (raw.schema_version !== TEAMSTATE_PUBLIC_OFFENSIVE_ENVIRONMENT_2024_V1_SCHEMA_VERSION) {
    reject(
      'E_METHODOLOGY_VERSION_UNKNOWN',
      `schema_version ${String(raw.schema_version)} is not the contract schema version ` +
        TEAMSTATE_PUBLIC_OFFENSIVE_ENVIRONMENT_2024_V1_SCHEMA_VERSION
    );
  }
  if (!(PUBLIC_REPORT_2024_APPROVED_METHODOLOGY_VERSIONS as readonly string[]).includes(payload.methodology_version)) {
    reject('E_METHODOLOGY_VERSION_UNKNOWN', `methodology_version ${String(payload.methodology_version)} is not approved`);
  }

  // --- Provenance (§8 invariant 1) ---
  const governanceRaw = raw.governance;
  if (!isNonEmptyString(raw.provenance_status) || !isRecord(governanceRaw)) {
    reject('E_PROVENANCE_MISSING', 'provenance_status and/or governance markers are absent');
  } else if (
    raw.provenance_status !== 'governed_real_data' ||
    governanceRaw.governance_status !== 'governed' ||
    governanceRaw.governance_source !== 'explicit_marker'
  ) {
    reject(
      'E_PROVENANCE_NOT_GOVERNED',
      `provenance_status=${String(raw.provenance_status)}, governance_status=${String(governanceRaw.governance_status)}, ` +
        `governance_source=${String(governanceRaw.governance_source)}`
    );
  } else {
    for (const key of Object.keys(governanceRaw)) {
      if (key !== 'governance_status' && key !== 'governance_source') {
        reject('E_UNDOCUMENTED_FIELD_PRESENT', `governance.${key} is not part of the §5 contract shape`);
      }
    }
  }

  // --- Declared scope: pinned §1 constants (data_through handled by the temporal checks) ---
  const declaredScope = isRecord(raw.declared_scope) ? raw.declared_scope : {};
  for (const [key, pinnedValue] of Object.entries(PUBLIC_REPORT_2024_DECLARED_SCOPE)) {
    if (key === 'data_through') {
      continue;
    }
    if (declaredScope[key] !== pinnedValue) {
      reject(
        'E_UNDOCUMENTED_FIELD_PRESENT',
        `declared_scope.${key} = ${String(declaredScope[key])} deviates from the pinned contract constant ${String(pinnedValue)}`
      );
    }
  }
  for (const key of Object.keys(declaredScope)) {
    if (!(key in PUBLIC_REPORT_2024_DECLARED_SCOPE)) {
      reject('E_UNDOCUMENTED_FIELD_PRESENT', `declared_scope.${key} is not part of the §5 contract shape`);
    }
  }

  // --- Coverage (§8 invariant 2), recomputed from bytes-derived rows, never metadata-trusted ---
  const coverage = sourceRows !== undefined ? computePublicReport2024Coverage(sourceRows) : payload.coverage;
  if (isRecord(coverage)) {
    if (coverage.missing_teams.length > 0) {
      reject('E_COVERAGE_TEAM_MISSING', `missing_teams: ${coverage.missing_teams.join(', ')}`);
    }
    if (coverage.unexpected_teams.length > 0) {
      reject('E_COVERAGE_TEAM_UNEXPECTED', `unexpected_teams: ${coverage.unexpected_teams.join(', ')}`);
    }
    if (coverage.team_game_row_count !== coverage.expected_team_game_rows) {
      reject(
        'E_COVERAGE_ROW_COUNT_MISMATCH',
        `team_game_row_count ${coverage.team_game_row_count} != expected ${coverage.expected_team_game_rows}`
      );
    }
  }
  if (isRecord(raw.coverage)) {
    for (const key of Object.keys(raw.coverage)) {
      if (!(COVERAGE_KEYS as readonly string[]).includes(key)) {
        reject('E_UNDOCUMENTED_FIELD_PRESENT', `coverage.${key} is not part of the §5 contract shape`);
      }
    }
  }
  if (sourceRows !== undefined) {
    // The emitted coverage block must equal the recomputation exactly — a payload may not claim
    // better (or different) coverage than the governed bytes support.
    if (JSON.stringify(raw.coverage) !== JSON.stringify(coverage)) {
      reject(
        'E_COVERAGE_ROW_COUNT_MISMATCH',
        'payload.coverage does not match the coverage recomputed from the governed source bytes'
      );
    }
    const rowCounts = new Map<string, number>();
    for (const row of sourceRows) {
      rowCounts.set(row.teamCode, (rowCounts.get(row.teamCode) ?? 0) + 1);
    }
    for (const [team, count] of rowCounts) {
      if (count !== PUBLIC_REPORT_2024_DECLARED_SCOPE.expected_games_per_team) {
        reject(
          'E_COVERAGE_ROW_COUNT_MISMATCH',
          `team ${team} has ${count} rows, expected ${PUBLIC_REPORT_2024_DECLARED_SCOPE.expected_games_per_team}`
        );
      }
    }
  }

  // --- Governed-input pin (§8 invariant 3): identity, checksum shape, fresh local recompute ---
  const governedInput = raw.governed_input;
  if (!isRecord(governedInput) || !isSha256Checksum(governedInput.checksum)) {
    reject(
      'E_GOVERNED_INPUT_CHECKSUM_MISMATCH',
      'governed_input.checksum is absent or malformed (requires exactly {algorithm: sha256, value: 64-char lowercase hex})'
    );
  } else {
    const pin = PUBLIC_REPORT_2024_GOVERNED_INPUT_PIN;
    for (const key of Object.keys(governedInput)) {
      if (!(GOVERNED_INPUT_KEYS as readonly string[]).includes(key)) {
        reject('E_UNDOCUMENTED_FIELD_PRESENT', `governed_input.${key} is not part of the §5 contract shape`);
      }
    }
    for (const key of ['artifact_id', 'repository', 'path', 'checksum_verification'] as const) {
      if (governedInput[key] !== pin[key]) {
        reject(
          'E_GOVERNED_INPUT_CHECKSUM_MISMATCH',
          `governed_input.${key} = ${String(governedInput[key])} does not match the contract pin ${pin[key]}`
        );
      }
    }
    const declared = (governedInput.checksum as { value: string }).value;
    if (context.governedSourceBytes !== undefined) {
      const recomputed = computeSha256Hex(context.governedSourceBytes);
      if (recomputed !== declared) {
        reject(
          'E_GOVERNED_INPUT_CHECKSUM_MISMATCH',
          `payload governed_input.checksum ${declared} does not match fresh local recompute ${recomputed}`
        );
      }
      if (recomputed !== pin.checksum.value) {
        reject(
          'E_GOVERNED_INPUT_CHECKSUM_MISMATCH',
          `committed governed source bytes have drifted from the contract-pinned checksum ` +
            `${pin.checksum.value} (recomputed ${recomputed})`
        );
      }
    } else if (declared !== pin.checksum.value) {
      reject(
        'E_GOVERNED_INPUT_CHECKSUM_MISMATCH',
        `governed_input.checksum ${declared} does not match the contract-pinned value`
      );
    }
  }

  // --- Upstream source records (§8 invariant 3): shape, and equality with the governed bytes' own
  // metadata — a syntactically valid but forged source_ref/snapshot/checksum must not survive ---
  const upstreamSources = raw.upstream_sources;
  if (!Array.isArray(upstreamSources) || upstreamSources.length === 0) {
    reject('E_UPSTREAM_SOURCE_CHECKSUM_MISSING', 'upstream_sources is absent or empty');
  } else {
    upstreamSources.forEach((source, index) => {
      if (!isRecord(source)) {
        reject('E_UPSTREAM_SOURCE_CHECKSUM_MISSING', `upstream_sources[${index}] is not an object`);
        return;
      }
      if (!isSha256Checksum(source.checksum)) {
        reject(
          'E_UPSTREAM_SOURCE_CHECKSUM_MISSING',
          `upstream_sources[${index}].checksum is absent or malformed (requires exactly {algorithm: sha256, value: 64-char lowercase hex})`
        );
      }
      if (!isNonEmptyString(source.source_ref)) {
        reject('E_UPSTREAM_SOURCE_CHECKSUM_MISSING', `upstream_sources[${index}].source_ref is absent`);
      }
      if (source.checksum_verification !== PUBLIC_REPORT_2024_UPSTREAM_CHECKSUM_VERIFICATION) {
        reject(
          'E_UPSTREAM_SOURCE_CHECKSUM_MISSING',
          `upstream_sources[${index}].checksum_verification = ${String(source.checksum_verification)} is not the ` +
            `contract literal ${PUBLIC_REPORT_2024_UPSTREAM_CHECKSUM_VERIFICATION}`
        );
      }
      for (const key of Object.keys(source)) {
        if (!(UPSTREAM_SOURCE_KEYS as readonly string[]).includes(key)) {
          reject('E_UNDOCUMENTED_FIELD_PRESENT', `upstream_sources[${index}].${key} is not part of the §5 contract shape`);
        }
      }
    });
    if (sourceInputSources !== undefined) {
      if (upstreamSources.length !== sourceInputSources.length) {
        reject(
          'E_UPSTREAM_SOURCE_CHECKSUM_MISSING',
          `upstream_sources has ${upstreamSources.length} entr(ies) but the governed bytes record ` +
            `${sourceInputSources.length} input source(s)`
        );
      } else {
        sourceInputSources.forEach((recorded, index) => {
          const emitted = upstreamSources[index];
          if (!isRecord(emitted)) {
            return; // Already rejected above.
          }
          const recordedRef = recorded.sourceRefs.length === 1 ? recorded.sourceRefs[0] : null;
          if (emitted.source_ref !== recordedRef) {
            reject(
              'E_UPSTREAM_SOURCE_CHECKSUM_MISSING',
              `upstream_sources[${index}].source_ref ${String(emitted.source_ref)} does not match the governed ` +
                `bytes' recorded source ref ${String(recordedRef)}`
            );
          }
          if (emitted.source_snapshot_at !== recorded.sourceSnapshotAt) {
            reject(
              'E_UPSTREAM_SOURCE_CHECKSUM_MISSING',
              `upstream_sources[${index}].source_snapshot_at ${String(emitted.source_snapshot_at)} does not match ` +
                `the governed bytes' recorded snapshot ${String(recorded.sourceSnapshotAt)}`
            );
          }
          const emittedChecksum = isRecord(emitted.checksum) ? emitted.checksum : null;
          if (
            emittedChecksum?.algorithm !== recorded.checksum?.algorithm ||
            emittedChecksum?.value !== recorded.checksum?.value
          ) {
            reject(
              'E_UPSTREAM_SOURCE_CHECKSUM_MISSING',
              `upstream_sources[${index}].checksum does not match the checksum recorded in the governed bytes' metadata`
            );
          }
        });
      }
    }
  }

  // --- Repository-qualified TIBER-Data references (§5 literals) ---
  if (JSON.stringify(raw.validation_report) !== JSON.stringify(PUBLIC_REPORT_2024_VALIDATION_REPORT_REF)) {
    reject('E_UNDOCUMENTED_FIELD_PRESENT', 'validation_report deviates from the §5 repository-qualified reference');
  }
  if (JSON.stringify(raw.lineage_manifest) !== JSON.stringify(PUBLIC_REPORT_2024_LINEAGE_MANIFEST_REF)) {
    reject('E_UNDOCUMENTED_FIELD_PRESENT', 'lineage_manifest deviates from the §5 repository-qualified reference');
  }

  // --- Excluded lanes (§2/§5): exact fields, reasons, and order ---
  if (JSON.stringify(raw.excluded_lanes) !== JSON.stringify(PUBLIC_REPORT_2024_EXCLUDED_LANES)) {
    reject('E_UNDOCUMENTED_FIELD_PRESENT', 'excluded_lanes deviates from the exact §5 list (fields, reasons, order)');
  }

  // --- Team records: declared-scope coverage of the payload content itself (§1/§5) ---
  const teams = Array.isArray(raw.teams) ? (raw.teams as unknown[]) : [];
  const payloadTeamCodes = teams
    .filter(isRecord)
    .map((entry) => entry.team)
    .filter(isNonEmptyString);
  if (payloadTeamCodes.length !== new Set(payloadTeamCodes).size) {
    reject('E_COVERAGE_ROW_COUNT_MISMATCH', 'teams[] contains duplicate team records');
  }
  const payloadTeamSet = new Set(payloadTeamCodes);
  const expectedTeamSet = new Set<string>(PUBLIC_REPORT_2024_EXPECTED_TEAMS);
  const missingTeamRecords = PUBLIC_REPORT_2024_EXPECTED_TEAMS.filter((team) => !payloadTeamSet.has(team));
  if (missingTeamRecords.length > 0) {
    reject(
      'E_COVERAGE_TEAM_MISSING',
      `teams[] omits record(s) for expected team(s): ${missingTeamRecords.join(', ')}`
    );
  }
  const unexpectedTeamRecords = [...payloadTeamSet].filter((team) => !expectedTeamSet.has(team)).sort();
  if (unexpectedTeamRecords.length > 0) {
    reject('E_COVERAGE_TEAM_UNEXPECTED', `teams[] contains unexpected team record(s): ${unexpectedTeamRecords.join(', ')}`);
  }

  // --- Team records: field discipline (§8 invariants 5/6), shape, and red-zone nulls (inv. 7) ---
  const observedSet = new Set<string>(PUBLIC_REPORT_2024_OBSERVED_FIELDS);
  const derivedSet = new Set<string>(PUBLIC_REPORT_2024_DERIVED_FIELDS);
  const forbiddenSet = new Set<string>(PUBLIC_REPORT_2024_FORBIDDEN_TEAM_FIELDS);
  const blockedSet = new Set<string>(PUBLIC_REPORT_2024_BLOCKED_DENOMINATOR_FIELDS);
  const NULLABLE_DERIVED_FIELDS = new Set(['neutralPassRate', 'pointsPerDrive', 'redZoneTdRate']);

  const flagField = (team: string, field: string, value: unknown, location: string): void => {
    if (blockedSet.has(field)) {
      reject(
        'E_APPROXIMATED_DENOMINATOR_UNAUTHORIZED',
        `${team}.${location}.${field} is present; the six blocked fields may not appear by any computation method`
      );
    }
    if (forbiddenSet.has(field)) {
      reject('E_WITHHELD_FIELD_PRESENT', `${team}.${location}.${field} is present (withheld fields must be absent)`);
      if (value === 0) {
        reject('E_WITHHELD_FIELD_ZERO_FILLED', `${team}.${location}.${field} is zero-filled instead of absent`);
      }
    } else if (!blockedSet.has(field)) {
      reject('E_UNDOCUMENTED_FIELD_PRESENT', `${team}.${location}.${field} is not defined in contract §3`);
    }
  };

  for (const teamEntry of teams) {
    if (!isRecord(teamEntry)) {
      reject('E_UNDOCUMENTED_FIELD_PRESENT', 'teams[] contains a non-object entry');
      continue;
    }
    const teamCode = isNonEmptyString(teamEntry.team) ? teamEntry.team : '<unknown>';
    for (const key of Object.keys(teamEntry)) {
      if (!['team', 'gamesPlayed', 'observed', 'derived', 'warnings'].includes(key)) {
        flagField(teamCode, key, teamEntry[key], 'record');
      }
    }
    if (teamEntry.gamesPlayed !== PUBLIC_REPORT_2024_DECLARED_SCOPE.expected_games_per_team) {
      reject(
        'E_COVERAGE_ROW_COUNT_MISMATCH',
        `teams[] record ${teamCode} has gamesPlayed ${String(teamEntry.gamesPlayed)}, expected ` +
          `${PUBLIC_REPORT_2024_DECLARED_SCOPE.expected_games_per_team}`
      );
    }

    const observed = isRecord(teamEntry.observed) ? teamEntry.observed : {};
    const derived = isRecord(teamEntry.derived) ? teamEntry.derived : {};
    for (const key of Object.keys(observed)) {
      if (!observedSet.has(key)) {
        flagField(teamCode, key, observed[key], 'observed');
      }
    }
    for (const key of Object.keys(derived)) {
      if (!derivedSet.has(key)) {
        flagField(teamCode, key, derived[key], 'derived');
      }
    }
    for (const field of PUBLIC_REPORT_2024_OBSERVED_FIELDS) {
      const value = observed[field];
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        reject(
          'E_UNDOCUMENTED_FIELD_PRESENT',
          `${teamCode}.observed.${field} = ${String(value)} is not the §3-required integer total`
        );
      }
    }
    for (const field of PUBLIC_REPORT_2024_DERIVED_FIELDS) {
      const value = derived[field];
      const typeOk =
        (typeof value === 'number' && Number.isFinite(value)) || (value === null && NULLABLE_DERIVED_FIELDS.has(field));
      if (!typeOk) {
        reject(
          'E_UNDOCUMENTED_FIELD_PRESENT',
          `${teamCode}.derived.${field} = ${String(value)} is not a §3-conformant value`
        );
      }
    }
    if (!Array.isArray(teamEntry.warnings) || teamEntry.warnings.some((code) => !KNOWN_WARNING_CODES.has(String(code)))) {
      reject('E_UNDOCUMENTED_FIELD_PRESENT', `${teamCode}.warnings must contain only the §3 warning codes`);
    }

    const redZoneTripsTotal = observed.redZoneTripsTotal;
    const redZoneTdRate = derived.redZoneTdRate;
    if (typeof redZoneTripsTotal === 'number') {
      if (redZoneTripsTotal === 0 && redZoneTdRate !== null) {
        reject(
          'E_REDZONE_NULL_INVARIANT_VIOLATED',
          `${teamCode}: redZoneTripsTotal == 0 but redZoneTdRate is ${String(redZoneTdRate)}, not null`
        );
      }
      if (redZoneTripsTotal > 0 && redZoneTdRate === null) {
        reject(
          'E_REDZONE_NULL_INVARIANT_VIOLATED',
          `${teamCode}: redZoneTripsTotal ${redZoneTripsTotal} > 0 but redZoneTdRate is null`
        );
      }
    }
  }

  // --- Payload-level warnings must be exactly the union of per-team warnings (§3/§5) ---
  const expectedPayloadWarnings = teams
    .filter(isRecord)
    .flatMap((teamEntry) =>
      Array.isArray(teamEntry.warnings) && isNonEmptyString(teamEntry.team)
        ? teamEntry.warnings.map((code) => ({ team: teamEntry.team, code: String(code) }))
        : []
    );
  if (JSON.stringify(raw.warnings) !== JSON.stringify(expectedPayloadWarnings)) {
    reject(
      'E_UNDOCUMENTED_FIELD_PRESENT',
      'payload warnings do not equal the union of per-team warnings (§3 zero-denominator warnings)'
    );
  }

  // --- Formula conformance (§3 / §9 E_UNWEIGHTED_AGGREGATION_USED): exact recompute from the
  // bytes-derived rows, including the warnings the recomputation itself produces ---
  if (sourceRows !== undefined && rejections.every((r) => r.code !== 'E_COVERAGE_TEAM_MISSING')) {
    const rowsByTeam = new Map<string, TeamWeekRawGovernedRow[]>();
    for (const row of sourceRows) {
      const teamRows = rowsByTeam.get(row.teamCode) ?? [];
      teamRows.push(row);
      rowsByTeam.set(row.teamCode, teamRows);
    }
    for (const teamEntry of teams) {
      if (!isRecord(teamEntry) || !isNonEmptyString(teamEntry.team)) {
        continue;
      }
      const rows = rowsByTeam.get(teamEntry.team);
      if (rows === undefined) {
        continue;
      }
      let expected;
      try {
        expected = deriveTeamSeasonRecord(teamEntry.team, rows).record;
      } catch {
        continue; // Row-level nulls already make generation impossible; nothing to compare against.
      }
      const observed = isRecord(teamEntry.observed) ? teamEntry.observed : {};
      const derived = isRecord(teamEntry.derived) ? teamEntry.derived : {};
      for (const field of PUBLIC_REPORT_2024_OBSERVED_FIELDS) {
        if (observed[field] !== expected.observed[field]) {
          reject(
            'E_UNWEIGHTED_AGGREGATION_USED',
            `${teamEntry.team}.observed.${field} = ${String(observed[field])} does not match the §3 formula ` +
              `recompute ${expected.observed[field]}`
          );
        }
      }
      for (const field of PUBLIC_REPORT_2024_DERIVED_FIELDS) {
        const actual = derived[field];
        const expectedValue = expected.derived[field];
        if (actual !== expectedValue) {
          const weightedByField: Partial<Record<string, keyof TeamWeekRawGovernedRow>> = {
            secondsPerPlay: 'secondsPerPlay',
            epaPerPlay: 'epaPerPlay',
            neutralPassRate: 'neutralPassRate',
            pointsPerDrive: 'pointsPerDrive',
            redZoneTdRate: 'redZoneTdRate'
          };
          const sourceField = weightedByField[field];
          let detail =
            `${teamEntry.team}.derived.${field} = ${String(actual)} does not match the §3 weighted-formula ` +
            `recompute ${String(expectedValue)}`;
          if (sourceField !== undefined) {
            const weeklyValues = rows
              .map((row) => row[sourceField])
              .filter((value): value is number => typeof value === 'number');
            if (weeklyValues.length > 0) {
              const simpleMean = roundHalfAwayFromZero(
                weeklyValues.reduce((acc, value) => acc + value, 0) / weeklyValues.length,
                PUBLIC_REPORT_2024_DERIVED_PRECISION[field]
              );
              if (actual === simpleMean) {
                detail += ' (value equals the unweighted simple mean of weekly values)';
              }
            }
          }
          reject('E_UNWEIGHTED_AGGREGATION_USED', detail);
        }
      }
      // Warnings are §3 derivation output too — a fabricated (or suppressed) warning that is
      // internally consistent within the payload must still match the recomputation.
      if (JSON.stringify(teamEntry.warnings) !== JSON.stringify(expected.warnings)) {
        reject(
          'E_UNWEIGHTED_AGGREGATION_USED',
          `${teamEntry.team}.warnings ${JSON.stringify(teamEntry.warnings)} do not match the §3 recomputation ` +
            `${JSON.stringify(expected.warnings)}`
        );
      }
    }
  }

  // --- Temporal metadata (§7, §8 invariant 8) ---
  const dataThrough = declaredScope.data_through;
  const sourceSnapshotAt = raw.source_snapshot_at;
  const generatedAt = raw.generated_at;
  if (!isNonEmptyString(dataThrough) || !isIsoTimestamp(sourceSnapshotAt) || !isIsoTimestamp(generatedAt)) {
    reject(
      'E_TEMPORAL_METADATA_MISSING',
      `data_through=${String(dataThrough)}, source_snapshot_at=${String(sourceSnapshotAt)}, ` +
        `generated_at=${String(generatedAt)} — all three must be present and well-formed ` +
        '(source_snapshot_at/generated_at as valid ISO-8601 timestamps)'
    );
  } else {
    // §8 invariant 8: the three temporal fields must not be the identical literal value — two
    // fields carrying the same literal indicates shared wiring (generated_at copied from
    // source_snapshot_at cannot happen when each field is wired to its distinct source).
    if (generatedAt === sourceSnapshotAt || generatedAt === dataThrough || sourceSnapshotAt === dataThrough) {
      reject(
        'E_TEMPORAL_METADATA_CONFLATED',
        `two temporal fields carry the identical literal value (data_through=${dataThrough}, ` +
          `source_snapshot_at=${sourceSnapshotAt}, generated_at=${generatedAt}); each must be wired ` +
          'to its distinct source (§8 invariant 8)'
      );
    }
    // Structural wiring checks: data_through must be the pinned contract constant, and
    // source_snapshot_at must equal max(upstream_sources[].source_snapshot_at) — each field wired
    // to its distinct source, never to a shared timestamp (not a coincidental-equality check).
    if (dataThrough !== PUBLIC_REPORT_2024_DECLARED_SCOPE.data_through) {
      reject(
        'E_TEMPORAL_METADATA_CONFLATED',
        `data_through ${dataThrough} is not wired to the pinned contract constant ` +
          PUBLIC_REPORT_2024_DECLARED_SCOPE.data_through
      );
    }
    if (Array.isArray(upstreamSources) && upstreamSources.length > 0) {
      const snapshots = upstreamSources
        .filter(isRecord)
        .map((source) => source.source_snapshot_at)
        .filter(isIsoTimestamp);
      if (snapshots.length === upstreamSources.length) {
        const expectedMax = snapshots.reduce((latest, candidate) =>
          Date.parse(candidate) > Date.parse(latest) ? candidate : latest
        );
        if (sourceSnapshotAt !== expectedMax) {
          reject(
            'E_TEMPORAL_METADATA_CONFLATED',
            `source_snapshot_at ${sourceSnapshotAt} != max(upstream_sources[].source_snapshot_at) ${expectedMax}`
          );
        }
      } else {
        reject(
          'E_TEMPORAL_METADATA_MISSING',
          'one or more upstream_sources[].source_snapshot_at are absent or not valid ISO-8601 timestamps'
        );
      }
    }
  }

  // --- Version identity (§8 invariant 9): presence, pattern, and exact contract URLs ---
  if (
    !isNonEmptyString(raw.report_version_id) ||
    !isNonEmptyString(raw.canonical_url) ||
    !isNonEmptyString(raw.version_url)
  ) {
    reject('E_VERSION_IDENTITY_MISSING', 'report_version_id/canonical_url/version_url must all be present');
  } else {
    const reportVersionId = raw.report_version_id as string;
    const canonicalUrl = raw.canonical_url as string;
    const versionUrl = raw.version_url as string;
    if (!REPORT_VERSION_ID_PATTERN.test(reportVersionId)) {
      reject(
        'E_VERSION_IDENTITY_MISSING',
        `report_version_id ${reportVersionId} does not follow the {methodology_version}.r{n} identity pattern`
      );
    }
    if (canonicalUrl !== PUBLIC_REPORT_2024_CANONICAL_URL_JSON) {
      reject(
        'E_VERSION_IDENTITY_MISSING',
        `canonical_url ${canonicalUrl} is not the contract canonical alias ${PUBLIC_REPORT_2024_CANONICAL_URL_JSON}`
      );
    }
    if (versionUrl !== buildPublicReport2024VersionUrlJson(reportVersionId)) {
      reject(
        'E_VERSION_IDENTITY_MISSING',
        `version_url ${versionUrl} is not the immutable identity URL for report_version_id ${reportVersionId}`
      );
    }
  }
  for (const key of SUPERSESSION_KEYS) {
    if (key in raw) {
      reject(
        'E_VERSION_IDENTITY_MUTABLE',
        `payload carries a ${key} field; current/superseded state lives only in the registry (§6)`
      );
    }
  }

  // --- HTML checks: byte-exactness against the internal render, identity presence, immutable-page
  // discipline, and semantic parity (the extraction checks give precise rejection codes) ---
  if (context.html === undefined) {
    reject(
      'E_HTML_JSON_SEMANTIC_MISMATCH',
      'rendered HTML not supplied — HTML/JSON semantic parity could not be verified; failing closed'
    );
  } else {
    // §4/§6/§8 invariant 10, closed byte-for-byte: the only acceptable HTML for a payload is the
    // deterministic render of that exact payload — any visible divergence (scope, provenance,
    // values, anything) is a semantic mismatch even if the extracted fields happen to agree.
    let freshRender: string | null = null;
    try {
      freshRender = renderPublicReport2024Html(payload);
    } catch (error) {
      reject(
        'E_HTML_JSON_SEMANTIC_MISMATCH',
        `the validated payload could not be deterministically rendered for comparison: ${(error as Error).message}`
      );
    }
    if (freshRender !== null && context.html !== freshRender) {
      reject(
        'E_HTML_JSON_SEMANTIC_MISMATCH',
        'supplied HTML is not byte-identical to the deterministic render of the validated payload'
      );
    }
    const semantics = extractPublicReport2024HtmlSemantics(context.html);
    for (const pattern of FORBIDDEN_HTML_STATUS_PATTERNS) {
      if (pattern.test(context.html)) {
        reject(
          'E_VERSION_IDENTITY_MUTABLE',
          `HTML renders current/superseded status content (matched ${pattern}); version pages are strictly immutable (§6)`
        );
      }
    }
    if (semantics.reportVersionId === null) {
      reject('E_VERSION_IDENTITY_MISSING', 'HTML page omits the report_version_id');
    } else if (isNonEmptyString(raw.report_version_id) && semantics.reportVersionId !== raw.report_version_id) {
      reject(
        'E_HTML_JSON_SEMANTIC_MISMATCH',
        `HTML report_version_id ${semantics.reportVersionId} != JSON ${String(raw.report_version_id)}`
      );
    }
    const parity: Array<[string, string | number | null, string | number | null]> = [
      ['methodology_version', payload.methodology_version, semantics.methodologyVersion],
      ['data_through', isNonEmptyString(dataThrough) ? dataThrough : null, semantics.dataThrough],
      [
        'source_snapshot_at',
        isNonEmptyString(sourceSnapshotAt) ? sourceSnapshotAt : null,
        semantics.sourceSnapshotAt
      ],
      ['generated_at', isNonEmptyString(generatedAt) ? generatedAt : null, semantics.generatedAt],
      ['coverage.team_count', payload.coverage?.team_count ?? null, semantics.teamCount],
      ['coverage.team_game_row_count', payload.coverage?.team_game_row_count ?? null, semantics.teamGameRowCount]
    ];
    for (const [label, jsonValue, htmlValue] of parity) {
      if (jsonValue !== htmlValue) {
        reject('E_HTML_JSON_SEMANTIC_MISMATCH', `${label}: JSON ${String(jsonValue)} != HTML ${String(htmlValue)}`);
      }
    }
    for (const teamEntry of teams) {
      if (!isRecord(teamEntry) || !isNonEmptyString(teamEntry.team)) {
        continue;
      }
      const htmlTeam = semantics.teamValues.get(teamEntry.team);
      if (htmlTeam === undefined) {
        reject('E_HTML_JSON_SEMANTIC_MISMATCH', `HTML omits team ${teamEntry.team}`);
        continue;
      }
      const observed = isRecord(teamEntry.observed) ? teamEntry.observed : {};
      const derived = isRecord(teamEntry.derived) ? teamEntry.derived : {};
      const expectations: Array<[string, string]> = [
        ['gamesPlayed', String(teamEntry.gamesPlayed)],
        ...PUBLIC_REPORT_2024_OBSERVED_FIELDS.map(
          (field): [string, string] => [field, formatPublicReport2024Value(field, observed[field] as number | null)]
        ),
        ...PUBLIC_REPORT_2024_DERIVED_FIELDS.map(
          (field): [string, string] => [field, formatPublicReport2024Value(field, derived[field] as number | null)]
        )
      ];
      for (const [field, expectedText] of expectations) {
        const htmlText = htmlTeam.get(field);
        if (htmlText !== expectedText) {
          reject(
            'E_HTML_JSON_SEMANTIC_MISMATCH',
            `${teamEntry.team}.${field}: HTML shows ${String(htmlText)}, JSON value formats to ${expectedText}`
          );
        }
      }
    }
    const jsonWarnings = Array.isArray(raw.warnings)
      ? (raw.warnings as Array<{ team?: unknown; code?: unknown }>).map((w) => `${String(w.team)}:${String(w.code)}`)
      : [];
    const htmlWarnings = semantics.warnings.map((w) => `${w.team}:${w.code}`);
    if (jsonWarnings.join('|') !== htmlWarnings.join('|')) {
      reject(
        'E_HTML_JSON_SEMANTIC_MISMATCH',
        `warnings differ: JSON [${jsonWarnings.join(', ')}] vs HTML [${htmlWarnings.join(', ')}]`
      );
    }
  }

  // --- Published-content immutability (§8 invariant 9, matrix #15): the candidate serialization
  // is computed internally — a caller cannot substitute a stale one to mask a mutation ---
  let candidateJson: string | null = null;
  try {
    candidateJson = serializePublicReport2024Payload(payload);
  } catch {
    candidateJson = null;
  }
  if (context.previouslyPublished !== undefined) {
    const { previouslyPublished } = context;
    if (previouslyPublished.json !== undefined) {
      if (candidateJson === null) {
        reject('E_VERSION_IDENTITY_MUTABLE', 'candidate payload could not be serialized for the immutability comparison');
      } else if (previouslyPublished.json !== candidateJson) {
        reject(
          'E_VERSION_IDENTITY_MUTABLE',
          `regenerating ${String(raw.report_version_id)} produced different JSON content than the published ` +
            'version; a changed regeneration must mint a new report_version_id'
        );
      }
    }
    if (previouslyPublished.html !== undefined) {
      if (context.html === undefined) {
        reject(
          'E_VERSION_IDENTITY_MUTABLE',
          'published HTML exists for this report_version_id but no candidate render was supplied to compare; failing closed'
        );
      } else if (previouslyPublished.html !== context.html) {
        reject(
          'E_VERSION_IDENTITY_MUTABLE',
          `regenerating ${String(raw.report_version_id)} produced different HTML content than the published version`
        );
      }
    }
  }

  // --- Registry state (§8 invariant 11) ---
  if (context.registry === undefined) {
    reject('E_REGISTRY_STATE_INVALID', 'registry state not supplied — §8 invariant 11 could not be verified; failing closed');
  } else {
    const registryErrors = validatePublicReportRegistry(context.registry.public_reports);
    for (const error of registryErrors) {
      reject('E_REGISTRY_STATE_INVALID', error);
    }
    // Matrix #15: a report_version_id the registry already names as published can only validate
    // against the actual stored frozen content — omitting that comparison must fail closed, not
    // silently pass. (The publication orchestrator sources `previouslyPublished` from the
    // encapsulated frozen store; it is not an optional nicety for an already-published version.)
    const alreadyRegistered = context.registry.public_reports.some(
      (entry) => entry.report_version_id === raw.report_version_id
    );
    if (alreadyRegistered && context.previouslyPublished === undefined) {
      reject(
        'E_VERSION_IDENTITY_MUTABLE',
        `report_version_id ${String(raw.report_version_id)} is already registered as published; validation ` +
          'requires comparison against the stored frozen content, which was not supplied'
      );
    }
  }

  // --- Explicit human publication approval (§8 invariant 12): exact version, well-formed record ---
  const approvals = context.approvals ?? [];
  const approval = approvals.find((record) => record.report_version_id === raw.report_version_id);
  if (approval === undefined) {
    reject(
      'E_PUBLICATION_NOT_APPROVED',
      `no recorded explicit human approval for report_version_id ${String(raw.report_version_id)}`
    );
  } else if (!isNonEmptyString(approval.approved_by) || !isIsoTimestamp(approval.approved_at)) {
    reject(
      'E_PUBLICATION_NOT_APPROVED',
      `approval record for ${String(raw.report_version_id)} is malformed: approved_by must be a non-empty ` +
        'identity and approved_at a valid ISO-8601 timestamp'
    );
  }

  const publishable = rejections.length === 0;
  // The binding is generated here, from the validated inputs themselves — never caller-supplied —
  // so a publishable result is usable only for this exact version and this exact frozen content.
  const binding: PublicReport2024ValidationBinding | null =
    publishable && candidateJson !== null && context.html !== undefined
      ? {
          report_version_id: payload.report_version_id,
          json_sha256: computeSha256Hex(candidateJson),
          html_sha256: computeSha256Hex(context.html)
        }
      : null;
  return { rejections, publishable: publishable && binding !== null, binding };
};
