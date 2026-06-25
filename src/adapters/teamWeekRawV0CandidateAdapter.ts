/**
 * Candidate-consumption adapter for TIBER-Data `team_week_raw_v0` source-candidate artifacts
 * (e.g. `team_week_raw_v0_2024_real_source_candidate.json`).
 *
 * This is intentionally a separate module from `teamWeekRawV0Adapter.ts`. That adapter requires every
 * row metric to be a finite number and assumes the artifact is already shaped for the existing
 * fixture/sample pipeline. The real 2024 candidate is `partial_real_data` / `ungoverned`: several
 * metric fields (at minimum `pressureRateAllowed`, the fantasy-points fields, and `redZoneTdRate` on
 * zero-red-zone-trip rows) are contractually nullable upstream and are genuinely `null` in the current
 * artifact. This adapter preserves that nullability rather than throwing on it or coercing it to zero,
 * and it gates acceptance on the artifact's declared provenance/governance metadata rather than on its
 * file path, name, or validation success.
 *
 * Scope boundary: this module only consumes and re-shapes the candidate artifact for read-only,
 * non-production inspection. It does not feed `mapRawTeamWeekToTeamStateInput`, the movement/forecast
 * pipeline, or any PPM/product-facing output. Routing candidate rows into those paths would require
 * either backfilling/estimating the null fields (disallowed) or a separate, explicitly authorized
 * change to make that pipeline null-aware.
 */

type NullableNumber = number | null;

export interface TeamWeekRawCandidateRow {
  season: number;
  week: number;
  teamCode: string;
  opponentCode: string;
  pointsFor: NullableNumber;
  pointsAgainst: NullableNumber;
  offensivePlays: NullableNumber;
  neutralPlays: NullableNumber;
  secondsPerPlay: NullableNumber;
  passRate: NullableNumber;
  neutralPassRate: NullableNumber;
  rushRate: NullableNumber;
  epaPerPlay: NullableNumber;
  passEpaPerPlay: NullableNumber;
  rushEpaPerPlay: NullableNumber;
  successRate: NullableNumber;
  explosivePlayRate: NullableNumber;
  drives: NullableNumber;
  pointsPerDrive: NullableNumber;
  redZoneTrips: NullableNumber;
  redZoneTdRate: NullableNumber;
  sacksAllowed: NullableNumber;
  pressureRateAllowed: NullableNumber;
  turnovers: NullableNumber;
  fantasyPointsForQB: NullableNumber;
  fantasyPointsForRB: NullableNumber;
  fantasyPointsForWR: NullableNumber;
  fantasyPointsForTE: NullableNumber;
  fantasyPointsAllowedQB: NullableNumber;
  fantasyPointsAllowedRB: NullableNumber;
  fantasyPointsAllowedWR: NullableNumber;
  fantasyPointsAllowedTE: NullableNumber;
}

/** Upstream provenance/governance context this adapter requires every candidate artifact to declare. */
export interface TeamWeekRawCandidateUpstream {
  sourceArtifactPath: string;
  generatedAt: string | null;
  season: number | null;
  provenanceStatus: string;
  governanceStatus: string;
  governanceSource: string;
  deferredFields: string[];
  validationReportPath: string | null;
  lineageManifestPath: string | null;
}

export interface TeamWeekRawCandidateConsumption {
  upstream: TeamWeekRawCandidateUpstream;
  rows: TeamWeekRawCandidateRow[];
}

/**
 * Provenance statuses this candidate-consumption path will accept. `governed_real_data` is
 * deliberately excluded: a governance promotion must go through an explicit human review (see
 * TIBER-Data PR D / issue #169), never through this read-only consumption adapter.
 */
const ACCEPTED_PROVENANCE_STATUSES = new Set(['fixture_scaffold', 'sample', 'partial_real_data', 'unknown_provenance']);

/** Only an explicitly-declared `ungoverned` governance status may be consumed as a candidate input. */
const ACCEPTED_GOVERNANCE_STATUSES = new Set(['ungoverned']);

const REQUIRED_NUMERIC_OR_NULL_FIELDS = [
  'pointsFor',
  'pointsAgainst',
  'offensivePlays',
  'neutralPlays',
  'secondsPerPlay',
  'passRate',
  'neutralPassRate',
  'rushRate',
  'epaPerPlay',
  'passEpaPerPlay',
  'rushEpaPerPlay',
  'successRate',
  'explosivePlayRate',
  'drives',
  'pointsPerDrive',
  'redZoneTrips',
  'redZoneTdRate',
  'sacksAllowed',
  'pressureRateAllowed',
  'turnovers',
  'fantasyPointsForQB',
  'fantasyPointsForRB',
  'fantasyPointsForWR',
  'fantasyPointsForTE',
  'fantasyPointsAllowedQB',
  'fantasyPointsAllowedRB',
  'fantasyPointsAllowedWR',
  'fantasyPointsAllowedTE'
] as const;

const isFiniteNumberOrNull = (value: unknown): value is NullableNumber =>
  value === null || (typeof value === 'number' && Number.isFinite(value));

const validateRow = (row: unknown, index: number): TeamWeekRawCandidateRow => {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) {
    throw new Error(`Invalid team_week_raw_v0 candidate row at index ${index}: expected object.`);
  }

  const candidate = row as Record<string, unknown>;

  if (typeof candidate.season !== 'number' || !Number.isInteger(candidate.season)) {
    throw new Error(`Invalid team_week_raw_v0 candidate row at index ${index}: season must be an integer.`);
  }
  if (typeof candidate.week !== 'number' || !Number.isInteger(candidate.week)) {
    throw new Error(`Invalid team_week_raw_v0 candidate row at index ${index}: week must be an integer.`);
  }
  if (typeof candidate.teamCode !== 'string' || candidate.teamCode.trim().length === 0) {
    throw new Error(`Invalid team_week_raw_v0 candidate row at index ${index}: teamCode must be a non-empty string.`);
  }
  if (typeof candidate.opponentCode !== 'string' || candidate.opponentCode.trim().length === 0) {
    throw new Error(
      `Invalid team_week_raw_v0 candidate row at index ${index}: opponentCode must be a non-empty string.`
    );
  }

  for (const field of REQUIRED_NUMERIC_OR_NULL_FIELDS) {
    if (!(field in candidate)) {
      throw new Error(`Invalid team_week_raw_v0 candidate row at index ${index}: missing required field ${field}.`);
    }
    if (!isFiniteNumberOrNull(candidate[field])) {
      throw new Error(
        `Invalid team_week_raw_v0 candidate row at index ${index}: ${field} must be a finite number or null.`
      );
    }
  }

  return candidate as unknown as TeamWeekRawCandidateRow;
};

interface CandidateMetadataGovernance {
  governanceStatus?: unknown;
  governanceSource?: unknown;
}

interface CandidateMetadata {
  provenanceStatus?: unknown;
  governance?: CandidateMetadataGovernance;
  deferredFields?: unknown;
  validationReportPath?: unknown;
  lineageManifestPath?: unknown;
}

interface TeamWeekRawV0CandidateArtifact {
  artifact: 'team_week_raw_v0';
  generatedAt?: unknown;
  season?: unknown;
  metadata?: CandidateMetadata;
  rows: unknown[];
}

/**
 * Validates and extracts the upstream provenance/governance context from the artifact's declared
 * `metadata` block only. The artifact's file path is accepted purely as an opaque label to carry
 * through into the result for traceability; it is never read or pattern-matched to decide acceptance.
 */
const requireUpstreamContext = (
  metadata: CandidateMetadata | undefined,
  sourceArtifactPath: string,
  generatedAt: unknown,
  season: unknown
): TeamWeekRawCandidateUpstream => {
  if (metadata === undefined || metadata === null) {
    throw new Error('Invalid team_week_raw_v0 candidate artifact: metadata block is required.');
  }

  const provenanceStatus = metadata.provenanceStatus;
  if (typeof provenanceStatus !== 'string' || provenanceStatus.trim().length === 0) {
    throw new Error('Invalid team_week_raw_v0 candidate artifact: metadata.provenanceStatus must be a non-empty string.');
  }
  if (!ACCEPTED_PROVENANCE_STATUSES.has(provenanceStatus)) {
    throw new Error(
      `Refusing to consume team_week_raw_v0 candidate artifact: provenanceStatus "${provenanceStatus}" is not an accepted candidate-input status. Accepted: ${[...ACCEPTED_PROVENANCE_STATUSES].join(', ')}.`
    );
  }

  const governance = metadata.governance;
  if (governance === undefined || governance === null || typeof governance !== 'object') {
    throw new Error(
      'Invalid team_week_raw_v0 candidate artifact: metadata.governance block is required and must declare governanceStatus/governanceSource explicitly.'
    );
  }

  const governanceStatus = governance.governanceStatus;
  if (typeof governanceStatus !== 'string' || governanceStatus.trim().length === 0) {
    throw new Error(
      'Invalid team_week_raw_v0 candidate artifact: metadata.governance.governanceStatus must be a non-empty string.'
    );
  }
  if (!ACCEPTED_GOVERNANCE_STATUSES.has(governanceStatus)) {
    throw new Error(
      `Refusing to consume team_week_raw_v0 candidate artifact: governanceStatus "${governanceStatus}" is not an accepted candidate-input status. This adapter only consumes explicitly "ungoverned" artifacts; governance promotion must happen via an explicit human review, not this loader.`
    );
  }

  const governanceSource = governance.governanceSource;
  if (typeof governanceSource !== 'string' || governanceSource.trim().length === 0) {
    throw new Error(
      'Invalid team_week_raw_v0 candidate artifact: metadata.governance.governanceSource must be a non-empty string.'
    );
  }

  const deferredFieldsRaw = metadata.deferredFields;
  const deferredFields = Array.isArray(deferredFieldsRaw)
    ? deferredFieldsRaw.filter((field): field is string => typeof field === 'string')
    : [];

  const validationReportPath = typeof metadata.validationReportPath === 'string' ? metadata.validationReportPath : null;
  const lineageManifestPath = typeof metadata.lineageManifestPath === 'string' ? metadata.lineageManifestPath : null;

  return {
    sourceArtifactPath,
    generatedAt: typeof generatedAt === 'string' ? generatedAt : null,
    season: typeof season === 'number' && Number.isInteger(season) ? season : null,
    provenanceStatus,
    governanceStatus,
    governanceSource,
    deferredFields,
    validationReportPath,
    lineageManifestPath
  };
};

/**
 * Adapts a parsed `team_week_raw_v0` candidate artifact into Teamstate-shaped rows while preserving
 * upstream candidate status and null metric values. Fails closed (throws) on any artifact that does
 * not explicitly declare an accepted `partial_real_data`/`ungoverned`-style candidate status, on any
 * artifact missing governance metadata, and on any row with a missing or malformed field.
 */
export const adaptTeamWeekRawV0Candidate = (raw: unknown, sourceArtifactPath: string): TeamWeekRawCandidateConsumption => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Invalid team_week_raw_v0 candidate artifact: expected object envelope.');
  }

  const artifact = raw as Partial<TeamWeekRawV0CandidateArtifact>;
  if (artifact.artifact !== 'team_week_raw_v0') {
    throw new Error(`Invalid artifact literal: expected team_week_raw_v0, received ${String(artifact.artifact)}`);
  }

  if (!Array.isArray(artifact.rows)) {
    throw new Error('Invalid team_week_raw_v0 candidate artifact: rows must be an array.');
  }

  const upstream = requireUpstreamContext(artifact.metadata, sourceArtifactPath, artifact.generatedAt, artifact.season);
  const rows = artifact.rows.map((row, index) => validateRow(row, index));

  return { upstream, rows };
};
