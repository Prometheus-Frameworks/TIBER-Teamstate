/**
 * Validator for `teamstate_public_offensive_environment_2024_v1` (contract §9, §10).
 *
 * Enforces every publication invariant in §8 and returns the contract's stable, machine-readable
 * rejection codes. Behavior on any rejection is uniform and fail-closed: the report version must
 * not be published and no partial/best-effort route may be served. A passing validation is
 * necessary but NOT sufficient for publication — invariant 12 additionally requires a recorded
 * explicit human approval for the exact `report_version_id`, and that approval is itself one of
 * the validated inputs here (`E_PUBLICATION_NOT_APPROVED`).
 */

import type { TeamWeekRawGovernedRow } from '../adapters/teamWeekRawV0GovernedAdapter.js';
import {
  PUBLIC_REPORT_2024_APPROVED_METHODOLOGY_VERSIONS,
  PUBLIC_REPORT_2024_BLOCKED_DENOMINATOR_FIELDS,
  PUBLIC_REPORT_2024_DECLARED_SCOPE,
  PUBLIC_REPORT_2024_DERIVED_FIELDS,
  PUBLIC_REPORT_2024_DERIVED_PRECISION,
  PUBLIC_REPORT_2024_EXPECTED_TEAMS,
  PUBLIC_REPORT_2024_FORBIDDEN_TEAM_FIELDS,
  PUBLIC_REPORT_2024_GOVERNED_INPUT_PIN,
  PUBLIC_REPORT_2024_OBSERVED_FIELDS,
  type PublicReport2024Payload,
  type PublicReport2024RejectionCode
} from '../contracts/teamstatePublicOffensiveEnvironment2024V1.js';
import {
  extractPublicReport2024HtmlSemantics,
  formatPublicReport2024Value
} from './publicOffensiveEnvironment2024Html.js';
import {
  computePublicReport2024Coverage,
  computeSha256Hex,
  deriveTeamSeasonRecord,
  roundHalfAwayFromZero
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
   * The committed governed source bytes, for the fresh local checksum recompute (§8 invariant 3).
   * When absent, checksum presence/pin conformance is still checked; recompute is skipped.
   */
  governedSourceBytes?: Buffer;
  /** Governed adapter rows for exact formula-conformance recomputation (§3, §9). */
  sourceRows?: readonly TeamWeekRawGovernedRow[];
  /** Rendered HTML for this exact version, for identity and semantic-parity checks (§8 inv. 9/10). */
  html?: string;
  /** The mutable registry state (§8 invariant 11). */
  registry?: TeamstateServiceMetadata;
  /** Recorded human publication approvals (§8 invariant 12). */
  approvals?: readonly PublicationApprovalRecord[];
  /**
   * Previously published frozen content for this `report_version_id`, if any: the candidate must
   * reproduce it byte-identically or be rejected as a mutation (§8 invariant 9, matrix #15).
   */
  previouslyPublished?: { json?: string; html?: string };
  /**
   * Fresh serialization/render of the candidate payload, compared against `previouslyPublished`.
   * Callers normally pass `serializePublicReport2024Payload(payload)` / the fresh render.
   */
  candidateSerialized?: { json?: string; html?: string };
}

export interface PublicReport2024ValidationResult {
  rejections: PublicReport2024Rejection[];
  /** True only when zero rejections fired — §10 case #20 is the only publishable state. */
  publishable: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

const isWellFormedChecksum = (value: unknown): boolean =>
  isRecord(value) && isNonEmptyString(value.algorithm) && isNonEmptyString(value.value);

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
  }

  // --- Coverage (§8 invariant 2), recomputed from rows when available, never metadata-trusted ---
  const coverage =
    context.sourceRows !== undefined ? computePublicReport2024Coverage(context.sourceRows) : payload.coverage;
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
  if (context.sourceRows !== undefined) {
    const rowCounts = new Map<string, number>();
    for (const row of context.sourceRows) {
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

  // --- Governed-input checksum (§8 invariant 3): fresh local recompute, no network ---
  const governedInput = raw.governed_input;
  if (!isRecord(governedInput) || !isWellFormedChecksum(governedInput.checksum)) {
    reject('E_GOVERNED_INPUT_CHECKSUM_MISMATCH', 'governed_input.checksum is absent or malformed');
  } else {
    const declared = (governedInput.checksum as { value: string }).value;
    if (context.governedSourceBytes !== undefined) {
      const recomputed = computeSha256Hex(context.governedSourceBytes);
      if (recomputed !== declared) {
        reject(
          'E_GOVERNED_INPUT_CHECKSUM_MISMATCH',
          `payload governed_input.checksum ${declared} does not match fresh local recompute ${recomputed}`
        );
      }
      if (recomputed !== PUBLIC_REPORT_2024_GOVERNED_INPUT_PIN.checksum.value) {
        reject(
          'E_GOVERNED_INPUT_CHECKSUM_MISMATCH',
          `committed governed source bytes have drifted from the contract-pinned checksum ` +
            `${PUBLIC_REPORT_2024_GOVERNED_INPUT_PIN.checksum.value} (recomputed ${recomputed})`
        );
      }
    } else if (declared !== PUBLIC_REPORT_2024_GOVERNED_INPUT_PIN.checksum.value) {
      reject(
        'E_GOVERNED_INPUT_CHECKSUM_MISMATCH',
        `governed_input.checksum ${declared} does not match the contract-pinned value`
      );
    }
  }

  // --- Upstream source checksums (§8 invariant 3): presence/well-formedness only ---
  const upstreamSources = raw.upstream_sources;
  if (!Array.isArray(upstreamSources) || upstreamSources.length === 0) {
    reject('E_UPSTREAM_SOURCE_CHECKSUM_MISSING', 'upstream_sources is absent or empty');
  } else {
    upstreamSources.forEach((source, index) => {
      if (!isRecord(source) || !isWellFormedChecksum(source.checksum)) {
        reject('E_UPSTREAM_SOURCE_CHECKSUM_MISSING', `upstream_sources[${index}].checksum is absent or malformed`);
      }
    });
  }

  // --- Methodology version (§8 invariant 4) ---
  if (!(PUBLIC_REPORT_2024_APPROVED_METHODOLOGY_VERSIONS as readonly string[]).includes(payload.methodology_version)) {
    reject('E_METHODOLOGY_VERSION_UNKNOWN', `methodology_version ${String(payload.methodology_version)} is not approved`);
  }

  // --- Team records: field discipline (§8 invariants 5/6) and red-zone nulls (invariant 7) ---
  const observedSet = new Set<string>(PUBLIC_REPORT_2024_OBSERVED_FIELDS);
  const derivedSet = new Set<string>(PUBLIC_REPORT_2024_DERIVED_FIELDS);
  const forbiddenSet = new Set<string>(PUBLIC_REPORT_2024_FORBIDDEN_TEAM_FIELDS);
  const blockedSet = new Set<string>(PUBLIC_REPORT_2024_BLOCKED_DENOMINATOR_FIELDS);
  const teams = Array.isArray(raw.teams) ? (raw.teams as unknown[]) : [];

  // The payload's own team records must cover exactly the declared scope (§1/§5): a payload that
  // omits team records (e.g. `teams: []`) is not a smaller report, it is an invalid one — without
  // this, empty content could pass every metadata-level check and reach the publication gate.
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
  for (const teamEntry of teams) {
    if (isRecord(teamEntry) && isNonEmptyString(teamEntry.team) && teamEntry.gamesPlayed !== PUBLIC_REPORT_2024_DECLARED_SCOPE.expected_games_per_team) {
      reject(
        'E_COVERAGE_ROW_COUNT_MISMATCH',
        `teams[] record ${teamEntry.team} has gamesPlayed ${String(teamEntry.gamesPlayed)}, expected ` +
          `${PUBLIC_REPORT_2024_DECLARED_SCOPE.expected_games_per_team}`
      );
    }
  }

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

  // --- Formula conformance (§3 / §9 E_UNWEIGHTED_AGGREGATION_USED), exact recompute from rows ---
  if (context.sourceRows !== undefined && rejections.every((r) => r.code !== 'E_COVERAGE_TEAM_MISSING')) {
    const rowsByTeam = new Map<string, TeamWeekRawGovernedRow[]>();
    for (const row of context.sourceRows) {
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
    }
  }

  // --- Temporal metadata (§7, §8 invariant 8) ---
  const declaredScope = isRecord(raw.declared_scope) ? raw.declared_scope : {};
  const dataThrough = declaredScope.data_through;
  const sourceSnapshotAt = raw.source_snapshot_at;
  const generatedAt = raw.generated_at;
  if (!isNonEmptyString(dataThrough) || !isNonEmptyString(sourceSnapshotAt) || !isNonEmptyString(generatedAt)) {
    reject(
      'E_TEMPORAL_METADATA_MISSING',
      `data_through=${String(dataThrough)}, source_snapshot_at=${String(sourceSnapshotAt)}, generated_at=${String(generatedAt)}`
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
        .filter(isNonEmptyString);
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
        reject('E_TEMPORAL_METADATA_MISSING', 'one or more upstream_sources[].source_snapshot_at are absent');
      }
    }
  }

  // --- Version identity (§8 invariant 9) ---
  if (
    !isNonEmptyString(raw.report_version_id) ||
    !isNonEmptyString(raw.canonical_url) ||
    !isNonEmptyString(raw.version_url)
  ) {
    reject('E_VERSION_IDENTITY_MISSING', 'report_version_id/canonical_url/version_url must all be present');
  }
  if ('supersession_status' in raw || 'superseded_by' in raw || 'status' in raw) {
    reject(
      'E_VERSION_IDENTITY_MUTABLE',
      'payload carries a supersession/status field; current/superseded state lives only in the registry (§6)'
    );
  }

  // --- HTML checks: identity presence, immutable-page discipline, semantic parity ---
  if (context.html !== undefined) {
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
      ['source_snapshot_at', isNonEmptyString(sourceSnapshotAt) ? sourceSnapshotAt : null, semantics.sourceSnapshotAt],
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

  // --- Published-content immutability (§8 invariant 9, matrix #15) ---
  if (context.previouslyPublished !== undefined) {
    const { previouslyPublished, candidateSerialized } = context;
    if (previouslyPublished.json !== undefined && candidateSerialized?.json !== undefined) {
      if (previouslyPublished.json !== candidateSerialized.json) {
        reject(
          'E_VERSION_IDENTITY_MUTABLE',
          `regenerating ${String(raw.report_version_id)} produced different JSON content than the published ` +
            'version; a changed regeneration must mint a new report_version_id'
        );
      }
    }
    if (previouslyPublished.html !== undefined && candidateSerialized?.html !== undefined) {
      if (previouslyPublished.html !== candidateSerialized.html) {
        reject(
          'E_VERSION_IDENTITY_MUTABLE',
          `regenerating ${String(raw.report_version_id)} produced different HTML content than the published version`
        );
      }
    }
  }

  // --- Registry state (§8 invariant 11) ---
  if (context.registry !== undefined) {
    const registryErrors = validatePublicReportRegistry(context.registry.public_reports);
    for (const error of registryErrors) {
      reject('E_REGISTRY_STATE_INVALID', error);
    }
  }

  // --- Explicit human publication approval (§8 invariant 12) ---
  const approvals = context.approvals ?? [];
  if (!approvals.some((approval) => approval.report_version_id === raw.report_version_id)) {
    reject(
      'E_PUBLICATION_NOT_APPROVED',
      `no recorded explicit human approval for report_version_id ${String(raw.report_version_id)}`
    );
  }

  return { rejections, publishable: rejections.length === 0 };
};
