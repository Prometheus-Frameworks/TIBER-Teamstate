/**
 * Forecast Run 2 full-governed-source coverage evidence (Teamstate issue #72).
 *
 * Durable, Teamstate-side coverage evidence proving the Forecast Run 2 artifact was emitted from the
 * full governed TIBER-Data 2024 `team_week_raw_v0` source (32 teams / 544 played team-game rows), not
 * an excerpt/scaffold. It is the evidence packet Forecast may later mirror against its Teamstate
 * coverage gate — it does NOT run Forecast, evaluate Forecast's gate, train, score, predict, rank, or
 * emit any fantasy product. Null semantics are preserved verbatim from the governed source: pressure
 * stays deferred/unavailable, fantasy splits stay absent/excluded, and partial nulls (redZoneTdRate)
 * stay null-aware — nothing is zero-filled.
 */

import { NFL_TEAM_CODES_32 } from '../fixtures/teamWeekRawV0FullLeagueScaffold.js';
import type { TeamWeekRawGovernedConsumption } from '../adapters/teamWeekRawV0GovernedAdapter.js';
import type { TeamWeekRawV0ForecastRun2Artifact } from './teamWeekRawV0ForecastRun2Artifact.js';

/** The TIBER-Data upstream coverage audit that established complete governed 2024 coverage. */
export const UPSTREAM_COVERAGE_AUDIT_REF =
  'TIBER-Data: exports/candidates/team_week_raw/team_week_raw_v0_2024_teamstate_coverage_audit.json (issue #181 / PR #182)';
/** The earlier failed Forecast Run 2 comparison team coverage this issue must not reproduce. */
export const PREVIOUS_FAILURE_TEAM_COVERAGE = '3/32 (BAL, CIN, PHI)';
export const EXPECTED_TEAM_COUNT = 32 as const;
export const EXPECTED_ROW_COUNT = 544 as const;

export interface ForecastRun2ColumnNullEvidence {
  column: string;
  status: 'available' | 'partial_nulls' | 'deferred_insufficient_data';
  nonNullCount: number;
  nullCount: number;
  forecastInput: boolean;
}

export interface ForecastRun2FullSourceCoverageEvidence {
  kind: 'team_week_raw_v0_2024_forecast_run2_coverage_evidence';
  issue: 'TIBER-Teamstate#72';
  emittedBy: 'teamstate';
  source: {
    sourceArtifactPath: string;
    sourceArtifactId: 'team_week_raw_v0';
    sha256: string | null;
    governanceStatus: 'governed';
    governanceSource: 'explicit_marker';
    provenanceStatus: 'governed_real_data';
    validationReportPath: string | null;
    lineageManifestPath: string | null;
    upstreamCoverageAudit: string;
  };
  input: {
    season: number | null;
    rowGrain: 'team_week';
    teamCount: number;
    rowCount: number;
    expectedTeamCount: typeof EXPECTED_TEAM_COUNT;
    expectedRowCount: typeof EXPECTED_ROW_COUNT;
    isFullLeague: boolean;
    presentTeams: string[];
    missingTeams: string[];
  };
  emitted: {
    readinessStatus: TeamWeekRawV0ForecastRun2Artifact['readinessStatus'];
    teamCount: number;
    rowGrain: 'team_week';
    preAggregationRowCount: number;
    forecastInputColumns: string[];
    forecastInputColumnCount: number;
  };
  nullSemantics: {
    perColumn: ForecastRun2ColumnNullEvidence[];
    pressureDisposition: 'unavailable_insufficient_data_deferred_excluded';
    fantasySplitDisposition: 'absent_excluded_from_forecast_use';
    noSilentZeroFill: true;
  };
  forecastGateProjection: {
    expectedTeamCoverage: '32/32';
    coversAllNflTeams: boolean;
    previousFailureTeamCoverage: string;
    nonNullForecastInputCellNote: string;
    knownBlockers: string[];
    doNotRunForecast: true;
  };
  notes: string[];
}

/**
 * Build the durable coverage evidence from an already-loaded governed consumption and its emitted
 * Forecast Run 2 artifact. Pure (no I/O). `sha256` is the verified mirror checksum of the consumed
 * source file when known (the runner computes it); pass `null` when unavailable.
 */
export const buildForecastRun2FullSourceCoverageEvidence = (
  consumption: TeamWeekRawGovernedConsumption,
  artifact: TeamWeekRawV0ForecastRun2Artifact,
  sha256: string | null = null
): ForecastRun2FullSourceCoverageEvidence => {
  const presentTeams = [...new Set(consumption.rows.map((row) => row.teamCode))].sort();
  const presentSet = new Set(presentTeams);
  const missingTeams = NFL_TEAM_CODES_32.filter((team) => !presentSet.has(team));
  const forecastInputSet = new Set(artifact.forecastInputColumns);

  const perColumn: ForecastRun2ColumnNullEvidence[] = artifact.fieldReadiness.map((field) => ({
    column: field.field,
    status: field.status,
    nonNullCount: field.finiteCount,
    nullCount: field.nullCount,
    forecastInput: forecastInputSet.has(field.field)
  }));

  const coversAllNflTeams = missingTeams.length === 0 && presentTeams.length === EXPECTED_TEAM_COUNT;

  return {
    kind: 'team_week_raw_v0_2024_forecast_run2_coverage_evidence',
    issue: 'TIBER-Teamstate#72',
    emittedBy: 'teamstate',
    source: {
      sourceArtifactPath: artifact.sourceArtifactPath,
      sourceArtifactId: 'team_week_raw_v0',
      sha256,
      governanceStatus: artifact.governance.governanceStatus,
      governanceSource: artifact.governance.governanceSource,
      provenanceStatus: artifact.provenanceStatus,
      validationReportPath: artifact.validationReportPath,
      lineageManifestPath: artifact.lineageManifestPath,
      upstreamCoverageAudit: UPSTREAM_COVERAGE_AUDIT_REF
    },
    input: {
      season: consumption.upstream.season,
      rowGrain: 'team_week',
      teamCount: presentTeams.length,
      rowCount: consumption.rows.length,
      expectedTeamCount: EXPECTED_TEAM_COUNT,
      expectedRowCount: EXPECTED_ROW_COUNT,
      isFullLeague: artifact.coverage.isFullLeague,
      presentTeams,
      missingTeams
    },
    emitted: {
      readinessStatus: artifact.readinessStatus,
      teamCount: artifact.teamCount,
      rowGrain: 'team_week',
      preAggregationRowCount: artifact.rowCount,
      forecastInputColumns: artifact.forecastInputColumns,
      forecastInputColumnCount: artifact.forecastInputColumns.length
    },
    nullSemantics: {
      perColumn,
      pressureDisposition: 'unavailable_insufficient_data_deferred_excluded',
      fantasySplitDisposition: 'absent_excluded_from_forecast_use',
      noSilentZeroFill: true
    },
    forecastGateProjection: {
      expectedTeamCoverage: '32/32',
      coversAllNflTeams,
      previousFailureTeamCoverage: PREVIOUS_FAILURE_TEAM_COVERAGE,
      nonNullForecastInputCellNote:
        'All 18 emitted offensive-environment Forecast input columns are non-null on all 544 team-game rows; redZoneTdRate carries 11 legitimate zero-red-zone-trip nulls (null-aware, never zero-filled). pressureRateAllowed and the eight fantasy split fields are excluded from the Forecast input column set, so Forecast must scope its non-null-cell gate to the emitted forecastInputColumns and not require those excluded fields.',
      knownBlockers: [],
      doNotRunForecast: true
    },
    notes: [
      'Teamstate-side coverage evidence only; this does not run Forecast, evaluate Forecast\'s gate, train, score, predict, rank, or emit fantasy product.',
      'Emitted from the full governed TIBER-Data 2024 team_week_raw_v0 source (32 teams x 17 played games = 544 rows), not an excerpt/scaffold/sample.',
      'Row grain is team-week (played games; bye weeks are expected absence, not missing truth). Any later aggregation to team-season is downstream of this evidence.',
      'Governance is explicit-marker only, echoed from the governed source; Teamstate does not re-govern.',
      'pressureRateAllowed stays deferred/unavailable and fantasy splits stay absent/excluded; no field is zero-filled, imputed, or invented.'
    ]
  };
};
