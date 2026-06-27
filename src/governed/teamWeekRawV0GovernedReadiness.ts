import { loadTeamWeekRawV0Governed } from '../ingest/loadTeamWeekRawV0Governed.js';
import {
  GOVERNED_TEAM_WEEK_RAW_V0_METRIC_FIELDS,
  type TeamWeekRawGovernedConsumption,
  type TeamWeekRawGovernedRow
} from '../adapters/teamWeekRawV0GovernedAdapter.js';
import { REAL_2024_CANDIDATE_COVERAGE_EXPECTATION } from '../dryrun/teamWeekRawV0CandidateDryRun.js';
import { validateTeamWeekByeAwareCoverage, type ByeAwareCoverageExpectation, type ByeAwareCoverageValidationResult } from '../validation/teamWeekRawV0Coverage.js';

export type GovernedFieldReadinessStatus = 'available' | 'partial_nulls' | 'deferred_insufficient_data';
export interface GovernedFieldReadiness { field: string; finiteCount: number; nullCount: number; status: GovernedFieldReadinessStatus; }

export interface TeamWeekRawV0GovernedReadinessReport {
  kind: 'team_week_raw_v0_governed_readiness';
  artifact: 'team_week_raw_v0';
  teamstateGovernedArtifact: true;
  productionReady: false;
  sourceArtifactPath: string;
  sourceArtifacts: string[];
  validationReportPath: string | null;
  lineageManifestPath: string | null;
  provenanceStatus: 'governed_real_data';
  governance: { governanceStatus: 'governed'; governanceSource: 'explicit_marker'; notes: unknown };
  upstreamFieldReadiness: unknown;
  rowCount: number;
  pressurePosture: 'unavailable_insufficient_data_deferred';
  deferredFields: string[];
  coverage: ByeAwareCoverageValidationResult;
  readinessStatus: 'ready_minimal_boundary' | 'withheld_invalid_coverage';
  fieldReadiness: GovernedFieldReadiness[];
  availableFields: string[];
  deferredInsufficientFields: string[];
  partialNullFields: string[];
  notes: string[];
}

const classify = (field: keyof TeamWeekRawGovernedRow, rows: readonly TeamWeekRawGovernedRow[], deferred: ReadonlySet<string>): GovernedFieldReadiness => {
  const finiteCount = rows.reduce((count, row) => count + (typeof row[field] === 'number' && Number.isFinite(row[field]) ? 1 : 0), 0);
  const nullCount = rows.length - finiteCount;
  const status: GovernedFieldReadinessStatus = field === 'pressureRateAllowed' || deferred.has(field)
    ? 'deferred_insufficient_data'
    : rows.length > 0 && nullCount === 0
      ? 'available'
      : 'partial_nulls';
  return { field, finiteCount, nullCount, status };
};

/** Build Teamstate's smallest safe governed readiness boundary; no scoring, training, or inference. */
export const buildTeamWeekRawV0GovernedReadiness = (
  consumption: TeamWeekRawGovernedConsumption,
  expectation: ByeAwareCoverageExpectation = REAL_2024_CANDIDATE_COVERAGE_EXPECTATION
): TeamWeekRawV0GovernedReadinessReport => {
  const coverage = validateTeamWeekByeAwareCoverage(
    consumption.rows.map((row) => ({ team_code: row.teamCode, week: row.week, season: row.season })),
    expectation
  );
  const deferred = new Set(consumption.upstream.deferredFields);
  const fieldReadiness = GOVERNED_TEAM_WEEK_RAW_V0_METRIC_FIELDS.map((field) => classify(field, consumption.rows, deferred));
  const availableFields = fieldReadiness.filter((field) => field.status === 'available').map((field) => field.field);
  const deferredInsufficientFields = fieldReadiness.filter((field) => field.status === 'deferred_insufficient_data').map((field) => field.field);
  const partialNullFields = fieldReadiness.filter((field) => field.status === 'partial_nulls').map((field) => field.field);

  return {
    kind: 'team_week_raw_v0_governed_readiness',
    artifact: 'team_week_raw_v0',
    teamstateGovernedArtifact: true,
    productionReady: false,
    sourceArtifactPath: consumption.upstream.sourceArtifactPath,
    sourceArtifacts: consumption.upstream.sourceArtifacts,
    validationReportPath: consumption.upstream.validationReportPath,
    lineageManifestPath: consumption.upstream.lineageManifestPath,
    provenanceStatus: consumption.upstream.provenanceStatus,
    governance: consumption.upstream.governance,
    upstreamFieldReadiness: consumption.upstream.fieldReadiness,
    rowCount: consumption.rows.length,
    pressurePosture: 'unavailable_insufficient_data_deferred',
    deferredFields: consumption.upstream.deferredFields,
    coverage,
    readinessStatus: coverage.valid ? 'ready_minimal_boundary' : 'withheld_invalid_coverage',
    fieldReadiness,
    availableFields,
    deferredInsufficientFields,
    partialNullFields,
    notes: [
      'Teamstate downstream consumption only: source governance is accepted from TIBER-Data explicit markers and is not re-governed here.',
      'pressureRateAllowed remains unavailable/insufficient_data/deferred; it is never inferred from sacks, imputed, backfilled, or zero-filled.',
      'redZoneTdRate nulls remain partial_nulls when only some rows are null.',
      'Fantasy split fields are forbidden at this governed Teamstate boundary.'
    ]
  };
};

export const buildTeamWeekRawV0GovernedReadinessFile = (filePath: string): TeamWeekRawV0GovernedReadinessReport =>
  buildTeamWeekRawV0GovernedReadiness(loadTeamWeekRawV0Governed(filePath));
