import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { loadTeamWeekRawV0Governed } from '../src/ingest/loadTeamWeekRawV0Governed.js';
import {
  buildTeamWeekRawV0ForecastRun2Artifact,
  buildTeamWeekRawV0ForecastRun2ArtifactFile,
  FORECAST_RUN2_DEFAULT_CUTOFF_AS_OF,
  FORECAST_RUN2_TARGET_SEASON_START
} from '../src/governed/teamWeekRawV0ForecastRun2Artifact.js';
import { buildForecastRun2FullSourceCoverageEvidence } from '../src/governed/forecastRun2FullSourceCoverageEvidence.js';
import { NFL_TEAM_CODES_32 } from '../src/fixtures/teamWeekRawV0FullLeagueScaffold.js';
import { TEAM_WEEK_RAW_V0_FANTASY_FIELDS } from '../src/adapters/teamWeekRawV0GovernedAdapter.js';

// Repo-relative paths of the vendored governed mirror and the committed full-mode evidence bundle.
const SOURCE_REL = 'data/governed/team_week_raw_v0_2024_real_source_candidate.json';
const ARTIFACT_REL = 'data/fixtures/team_week_raw_forecast_run2/team_week_raw_v0_2024_forecast_run2.full.json';
const EVIDENCE_REL = 'data/fixtures/team_week_raw_forecast_run2/team_week_raw_v0_2024_forecast_run2.coverage_evidence.json';
const MIRROR_REL = 'data/governed/team_week_raw_v0_2024_real_source_candidate.mirror.json';

const sourceAbs = path.resolve(process.cwd(), SOURCE_REL);
const readJson = (rel: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path.resolve(process.cwd(), rel), 'utf-8')) as Record<string, unknown>;

// Pinned sha256 of the governed TIBER-Data 2024 team_week_raw_v0 source (TIBER-Data #181/#182). The
// vendored mirror must stay byte-identical; a drifted source is caught here independent of the export
// script's own fail-closed guard.
const EXPECTED_GOVERNED_SOURCE_SHA256 = '2aed00e68c1620af10d2ea4350104f7e183ff6ee050f5d385a503ef027281de9';
const sourceSha256 = createHash('sha256').update(readFileSync(sourceAbs)).digest('hex');
const consumption = loadTeamWeekRawV0Governed(sourceAbs);
const fullArtifact = buildTeamWeekRawV0ForecastRun2Artifact(consumption, { asOf: FORECAST_RUN2_DEFAULT_CUTOFF_AS_OF });
const presentTeams = [...new Set(consumption.rows.map((row) => row.teamCode))].sort();

describe('Forecast Run 2 emission from the full governed TIBER-Data source (#72)', () => {
  it('consumes the full governed 544-row / 32-team source, not an excerpt/scaffold', () => {
    expect(consumption.rows).toHaveLength(544);
    expect(presentTeams).toEqual([...NFL_TEAM_CODES_32].sort());
    expect(presentTeams).toHaveLength(32);
    // The vendored mirror is the real governed source: explicit-marker governance, governed provenance.
    expect(consumption.upstream.provenanceStatus).toBe('governed_real_data');
    expect(consumption.upstream.governance.governanceStatus).toBe('governed');
    expect(consumption.upstream.governance.governanceSource).toBe('explicit_marker');
  });

  it('emits full-mode coverage: 32 teams, 544 played rows, full league, ready boundary', () => {
    expect(fullArtifact.teamCount).toBe(32);
    expect(fullArtifact.rowCount).toBe(544);
    expect(fullArtifact.coverage.teamCount).toBe(32);
    expect(fullArtifact.coverage.totalRowCount).toBe(544);
    expect(fullArtifact.coverage.valid).toBe(true);
    expect(fullArtifact.coverage.isFullLeague).toBe(true);
    expect(fullArtifact.readinessStatus).toBe('ready_minimal_boundary');
    expect(fullArtifact.rowGrain).toBe('team_week');
  });

  it('REGRESSION: does not regress to the previous 3-team BAL/CIN/PHI output', () => {
    expect(fullArtifact.teamCount).not.toBe(3);
    // Every team the earlier failure missed is present, and the coverage is the full league, not 3 teams.
    expect(presentTeams).not.toEqual(['BAL', 'CIN', 'PHI']);
    for (const team of NFL_TEAM_CODES_32) {
      expect(presentTeams).toContain(team);
    }

    // The previous 3-team shape cannot pass as full-mode output: filtered to BAL/CIN/PHI under the real
    // 32-team expectation, coverage is invalid and the boundary is withheld (never a ready boundary).
    const threeTeam = {
      upstream: consumption.upstream,
      rows: consumption.rows.filter((row) => ['BAL', 'CIN', 'PHI'].includes(row.teamCode))
    };
    const threeTeamArtifact = buildTeamWeekRawV0ForecastRun2Artifact(threeTeam, { asOf: FORECAST_RUN2_DEFAULT_CUTOFF_AS_OF });
    expect(threeTeamArtifact.teamCount).toBe(3);
    expect(threeTeamArtifact.coverage.valid).toBe(false);
    expect(threeTeamArtifact.readinessStatus).toBe('withheld_invalid_coverage');
  });

  it('REGRESSION: source path is the governed mirror, never a sample/excerpt/scaffold', () => {
    const committed = readJson(ARTIFACT_REL);
    expect(committed.sourceArtifactPath).toBe(SOURCE_REL);
    const lowered = (committed.sourceArtifactPath as string).toLowerCase();
    expect(lowered).not.toContain('sample');
    expect(lowered).not.toContain('excerpt');
    expect(lowered).not.toContain('scaffold');
    expect(committed.readinessStatus).toBe('ready_minimal_boundary');
    expect(committed.teamCount).toBe(32);
  });

  it('keeps offensive-environment Forecast input columns non-null-dominated (not absent-team nulls)', () => {
    // The earlier failure was null-dominated because most teams were absent; here every offensive
    // column is fully populated across all 544 rows.
    for (const column of ['epaPerPlay', 'successRate', 'passRate', 'rushRate', 'pointsPerDrive']) {
      const readiness = fullArtifact.fieldReadiness.find((f) => f.field === column);
      expect(readiness?.status).toBe('available');
      expect(readiness?.nullCount).toBe(0);
      expect(readiness?.finiteCount).toBe(544);
      expect(fullArtifact.forecastInputColumns).toContain(column);
    }
    // redZoneTdRate stays partial-null (11 zero-red-zone-trip rows), null-aware, never zero-filled.
    const redZone = fullArtifact.fieldReadiness.find((f) => f.field === 'redZoneTdRate');
    expect(redZone?.status).toBe('partial_nulls');
    expect(redZone?.nullCount).toBe(11);
    expect(fullArtifact.forecastInputColumns).toContain('redZoneTdRate');
  });

  it('preserves null semantics: pressure deferred, fantasy excluded, no zero-fill', () => {
    const pressure = fullArtifact.fieldReadiness.find((f) => f.field === 'pressureRateAllowed');
    expect(pressure?.status).toBe('deferred_insufficient_data');
    expect(pressure?.finiteCount).toBe(0);
    expect(pressure?.nullCount).toBe(544);
    expect(fullArtifact.forecastInputColumns).not.toContain('pressureRateAllowed');
    for (const fantasyField of TEAM_WEEK_RAW_V0_FANTASY_FIELDS) {
      expect(fullArtifact.forecastInputColumns).not.toContain(fantasyField);
    }
    expect(fullArtifact.fantasySplitPosture.status).toBe('absent_excluded_from_forecast_use');
  });

  it('keeps the cutoff strictly before the 2025 target season', () => {
    expect(fullArtifact.forecastCutoff.inputSeason).toBe(2024);
    expect(fullArtifact.forecastCutoff.cutoffBeforeTargetSeason).toBe(true);
    expect(Date.parse(fullArtifact.forecastCutoff.asOf)).toBeLessThan(Date.parse(FORECAST_RUN2_TARGET_SEASON_START));
  });

  it('preserves source / validation / lineage references', () => {
    expect(fullArtifact.sourceArtifacts).toContain('nflverse-data:pbp/play_by_play_2024');
    expect(fullArtifact.validationReportPath).toContain('.validation.json');
    expect(fullArtifact.lineageManifestPath).toContain('.manifest.json');
  });
});

describe('committed full-mode Forecast Run 2 golden artifact and coverage evidence (#72)', () => {
  it('the committed full artifact matches a fresh full-mode emit', () => {
    const fresh = buildTeamWeekRawV0ForecastRun2ArtifactFile(sourceAbs, { asOf: FORECAST_RUN2_DEFAULT_CUTOFF_AS_OF });
    const committed = readJson(ARTIFACT_REL);
    // The committed file stores a repo-relative sourceArtifactPath; compare the rest.
    const { sourceArtifactPath: _freshPath, ...freshRest } = fresh as unknown as Record<string, unknown>;
    const { sourceArtifactPath: _committedPath, ...committedRest } = committed;
    expect(committedRest).toEqual(freshRest);
  });

  it('the committed coverage evidence matches a fresh build and shows full 32-team coverage', () => {
    const artifactForEvidence = { ...fullArtifact, sourceArtifactPath: SOURCE_REL };
    const freshEvidence = buildForecastRun2FullSourceCoverageEvidence(consumption, artifactForEvidence, sourceSha256);
    const committedEvidence = readJson(EVIDENCE_REL);
    expect(committedEvidence).toEqual(JSON.parse(JSON.stringify(freshEvidence)));

    expect(committedEvidence.kind).toBe('team_week_raw_v0_2024_forecast_run2_coverage_evidence');
    const input = committedEvidence.input as Record<string, unknown>;
    expect(input.teamCount).toBe(32);
    expect(input.rowCount).toBe(544);
    expect(input.missingTeams).toEqual([]);
    const emitted = committedEvidence.emitted as Record<string, unknown>;
    expect(emitted.teamCount).toBe(32);
    const projection = committedEvidence.forecastGateProjection as Record<string, unknown>;
    expect(projection.coversAllNflTeams).toBe(true);
    expect(projection.expectedTeamCoverage).toBe('32/32');
    expect(projection.doNotRunForecast).toBe(true);
  });

  it('the mirror manifest sha256 is byte-identical to the pinned governed source', () => {
    // The vendored source must match the pinned upstream checksum, and the manifest must record it.
    expect(sourceSha256).toBe(EXPECTED_GOVERNED_SOURCE_SHA256);
    const mirror = readJson(MIRROR_REL);
    expect(mirror.sha256).toBe(EXPECTED_GOVERNED_SOURCE_SHA256);
    expect(mirror.sha256).toBe(sourceSha256);
    expect(mirror.rowCount).toBe(544);
    expect(mirror.teamCount).toBe(32);
    const upstream = mirror.upstream as Record<string, unknown>;
    expect(upstream.repo).toBe('Prometheus-Frameworks/TIBER-Data');
    expect(upstream.refs).toContain('TIBER-Data#182');
  });
});
