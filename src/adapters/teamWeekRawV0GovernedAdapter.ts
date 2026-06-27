/**
 * Governed-source adapter for TIBER-Data `team_week_raw_v0` 2024 artifacts.
 *
 * This is Teamstate downstream consumption only: it accepts governance only from explicit upstream
 * metadata markers, preserves source/validation/lineage references, keeps pressure deferred/null, and
 * rejects fantasy split fields at the boundary.
 */

type NullableNumber = number | null;

export const TEAM_WEEK_RAW_V0_FANTASY_FIELDS = [
  'fantasyPointsForQB',
  'fantasyPointsForRB',
  'fantasyPointsForWR',
  'fantasyPointsForTE',
  'fantasyPointsAllowedQB',
  'fantasyPointsAllowedRB',
  'fantasyPointsAllowedWR',
  'fantasyPointsAllowedTE'
] as const;

export interface TeamWeekRawGovernedRow {
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
  pressureRateAllowed: null;
  turnovers: NullableNumber;
}

export interface TeamWeekRawGovernedUpstream {
  sourceArtifactPath: string;
  artifact: 'team_week_raw_v0';
  generatedAt: string | null;
  season: number | null;
  provenanceStatus: 'governed_real_data';
  sourceArtifacts: string[];
  governance: {
    governanceStatus: 'governed';
    governanceSource: 'explicit_marker';
    notes: unknown;
  };
  deferredFields: string[];
  fieldReadiness: unknown;
  validationReportPath: string | null;
  lineageManifestPath: string | null;
}

export interface TeamWeekRawGovernedConsumption {
  upstream: TeamWeekRawGovernedUpstream;
  rows: TeamWeekRawGovernedRow[];
}

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
  'turnovers'
] as const;

export const GOVERNED_TEAM_WEEK_RAW_V0_METRIC_FIELDS = [
  ...REQUIRED_NUMERIC_OR_NULL_FIELDS,
  'pressureRateAllowed'
] as const satisfies ReadonlyArray<keyof TeamWeekRawGovernedRow>;

const isFiniteNumberOrNull = (value: unknown): value is NullableNumber =>
  value === null || (typeof value === 'number' && Number.isFinite(value));

const requiredString = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid governed team_week_raw_v0 artifact: ${label} must be a non-empty string.`);
  }
  return value;
};

const stringArray = (value: unknown, label: string): string[] => {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string' && entry.trim().length > 0)) {
    throw new Error(`Invalid governed team_week_raw_v0 artifact: ${label} must be an array of non-empty strings.`);
  }
  return [...value];
};

const optionalString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const validateRow = (row: unknown, index: number): TeamWeekRawGovernedRow => {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) {
    throw new Error(`Invalid governed team_week_raw_v0 row at index ${index}: expected object.`);
  }
  const candidate = row as Record<string, unknown>;

  for (const field of TEAM_WEEK_RAW_V0_FANTASY_FIELDS) {
    if (field in candidate) {
      throw new Error(`Invalid governed team_week_raw_v0 row at index ${index}: forbidden fantasy split field ${field}.`);
    }
  }

  if (typeof candidate.season !== 'number' || !Number.isInteger(candidate.season)) {
    throw new Error(`Invalid governed team_week_raw_v0 row at index ${index}: season must be an integer.`);
  }
  if (typeof candidate.week !== 'number' || !Number.isInteger(candidate.week)) {
    throw new Error(`Invalid governed team_week_raw_v0 row at index ${index}: week must be an integer.`);
  }
  if (typeof candidate.teamCode !== 'string' || candidate.teamCode.trim().length === 0) {
    throw new Error(`Invalid governed team_week_raw_v0 row at index ${index}: teamCode must be a non-empty string.`);
  }
  if (typeof candidate.opponentCode !== 'string' || candidate.opponentCode.trim().length === 0) {
    throw new Error(`Invalid governed team_week_raw_v0 row at index ${index}: opponentCode must be a non-empty string.`);
  }
  for (const field of REQUIRED_NUMERIC_OR_NULL_FIELDS) {
    if (!(field in candidate) || !isFiniteNumberOrNull(candidate[field])) {
      throw new Error(`Invalid governed team_week_raw_v0 row at index ${index}: ${field} must be a finite number or null.`);
    }
  }
  if (!('pressureRateAllowed' in candidate) || candidate.pressureRateAllowed !== null) {
    throw new Error(`Invalid governed team_week_raw_v0 row at index ${index}: pressureRateAllowed must be null/deferred, never inferred or zero-filled.`);
  }

  return Object.fromEntries([
    ['season', candidate.season], ['week', candidate.week], ['teamCode', candidate.teamCode],
    ['opponentCode', candidate.opponentCode],
    ...REQUIRED_NUMERIC_OR_NULL_FIELDS.map((field) => [field, candidate[field]] as const),
    ['pressureRateAllowed', null]
  ]) as unknown as TeamWeekRawGovernedRow;
};

export const adaptTeamWeekRawV0Governed = (raw: unknown, sourceArtifactPath: string): TeamWeekRawGovernedConsumption => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Invalid governed team_week_raw_v0 artifact: expected object envelope.');
  }
  const artifact = raw as Record<string, unknown>;
  if (artifact.artifact !== 'team_week_raw_v0') {
    throw new Error(`Invalid governed team_week_raw_v0 artifact: expected artifact team_week_raw_v0, received ${String(artifact.artifact)}.`);
  }
  if (!Array.isArray(artifact.rows)) {
    throw new Error('Invalid governed team_week_raw_v0 artifact: rows must be an array.');
  }
  const metadata = artifact.metadata;
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
    throw new Error('Invalid governed team_week_raw_v0 artifact: metadata block is required.');
  }
  const md = metadata as Record<string, unknown>;
  const provenanceStatus = requiredString(md.provenanceStatus, 'metadata.provenanceStatus');
  if (provenanceStatus !== 'governed_real_data') {
    throw new Error(`Refusing governed team_week_raw_v0 source: provenanceStatus must be governed_real_data, received ${provenanceStatus}.`);
  }
  const governance = md.governance;
  if (typeof governance !== 'object' || governance === null || Array.isArray(governance)) {
    throw new Error('Invalid governed team_week_raw_v0 artifact: metadata.governance block is required.');
  }
  const gov = governance as Record<string, unknown>;
  if (requiredString(gov.governanceStatus, 'metadata.governance.governanceStatus') !== 'governed') {
    throw new Error('Refusing governed team_week_raw_v0 source: metadata.governance.governanceStatus must be governed.');
  }
  if (requiredString(gov.governanceSource, 'metadata.governance.governanceSource') !== 'explicit_marker') {
    throw new Error('Refusing governed team_week_raw_v0 source: metadata.governance.governanceSource must be explicit_marker.');
  }

  const deferredFields = stringArray(md.deferredFields, 'metadata.deferredFields');
  if (!deferredFields.includes('pressureRateAllowed')) {
    throw new Error('Invalid governed team_week_raw_v0 artifact: metadata.deferredFields must include pressureRateAllowed.');
  }

  return {
    upstream: {
      sourceArtifactPath,
      artifact: 'team_week_raw_v0',
      generatedAt: optionalString(artifact.generatedAt),
      season: typeof artifact.season === 'number' && Number.isInteger(artifact.season) ? artifact.season : null,
      provenanceStatus: 'governed_real_data',
      sourceArtifacts: stringArray(artifact.sourceArtifacts, 'sourceArtifacts'),
      governance: { governanceStatus: 'governed', governanceSource: 'explicit_marker', notes: gov.notes ?? null },
      deferredFields,
      fieldReadiness: md.fieldReadiness ?? null,
      validationReportPath: optionalString(md.validationReportPath),
      lineageManifestPath: optionalString(md.lineageManifestPath)
    },
    rows: artifact.rows.map(validateRow)
  };
};
