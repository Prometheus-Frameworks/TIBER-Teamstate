import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { adaptTeamWeekRawV0Governed } from '../src/adapters/teamWeekRawV0GovernedAdapter.js';
import {
  buildTeamWeekRawV0ForecastRun2Artifact,
  buildTeamWeekRawV0ForecastRun2ArtifactFile,
  EXCERPT_GOVERNED_COVERAGE_EXPECTATION,
  FORECAST_RUN2_INPUT_SEASON,
  FORECAST_RUN2_TARGET_SEASON,
  TEAM_WEEK_GRAIN_KEYS
} from '../src/governed/teamWeekRawV0ForecastRun2Artifact.js';
import { TEAM_WEEK_RAW_V0_FANTASY_FIELDS } from '../src/adapters/teamWeekRawV0GovernedAdapter.js';

const fixturePath = path.resolve(
  process.cwd(),
  'data/fixtures/team_week_raw_governed/team_week_raw_v0_2024_governed.sample.json'
);
const loadFixture = (): Record<string, unknown> => JSON.parse(readFileSync(fixturePath, 'utf-8')) as Record<string, unknown>;
const buildFromFixture = () =>
  buildTeamWeekRawV0ForecastRun2Artifact(adaptTeamWeekRawV0Governed(loadFixture(), fixturePath), {
    coverageExpectation: EXCERPT_GOVERNED_COVERAGE_EXPECTATION
  });

describe('team_week_raw_v0 governed Forecast Run 2 artifact', () => {
  it('carries explicit-marker governance, not inferred from path/name/build/validation/demand', () => {
    const artifact = buildFromFixture();

    expect(artifact.teamstateGovernedArtifact).toBe(true);
    expect(artifact.forecastRun2Artifact).toBe(true);
    expect(artifact.provenanceStatus).toBe('governed_real_data');
    expect(artifact.governance.governanceStatus).toBe('governed');
    expect(artifact.governance.governanceSource).toBe('explicit_marker');
    expect(artifact.emittedBy).toBe('teamstate');
    // The governance markers are echoed from the source's explicit metadata, never derived here.
    expect(artifact.governance.governanceSource).not.toBe('path_inference');
  });

  it('fails closed (no governed artifact emitted) when explicit governance markers are absent', () => {
    const ungoverned = loadFixture();
    const metadata = { ...(ungoverned.metadata as Record<string, unknown>) };
    metadata.governance = { governanceStatus: 'ungoverned', governanceSource: 'not_set' };
    ungoverned.metadata = metadata;
    expect(() => adaptTeamWeekRawV0Governed(ungoverned, fixturePath)).toThrow(/governanceStatus must be governed/);
  });

  it('records a forecast cutoff equal to the 2024 input season and before the 2025 target season', () => {
    const artifact = buildFromFixture();

    expect(artifact.forecastCutoff.inputSeason).toBe(2024);
    expect(artifact.forecastCutoff.inputSeason).toBe(FORECAST_RUN2_INPUT_SEASON);
    expect(artifact.forecastCutoff.targetSeason).toBe(FORECAST_RUN2_TARGET_SEASON);
    expect(artifact.forecastCutoff.inputSeason).toBeLessThan(artifact.forecastCutoff.targetSeason);
    expect(artifact.forecastCutoff.inputSeason).toBeLessThan(2025);
    expect(artifact.forecastCutoff.cutoffBeforeTargetSeason).toBe(true);
    // A recorded as-of timestamp must be present.
    expect(typeof artifact.forecastCutoff.asOf).toBe('string');
    expect(artifact.forecastCutoff.asOf.length).toBeGreaterThan(0);
  });

  it('refuses to emit a 2024-cutoff artifact for a non-2024 governed source', () => {
    const wrongSeason = loadFixture();
    wrongSeason.season = 2023;
    expect(() => buildTeamWeekRawV0ForecastRun2Artifact(adaptTeamWeekRawV0Governed(wrongSeason, fixturePath), {
      coverageExpectation: EXCERPT_GOVERNED_COVERAGE_EXPECTATION
    })).toThrow(/recorded cutoff is pinned to input season 2024/);
  });

  it('requires a recorded as-of and accepts an explicit override', () => {
    const noStamp = loadFixture();
    delete noStamp.generatedAt;
    expect(() => buildTeamWeekRawV0ForecastRun2Artifact(adaptTeamWeekRawV0Governed(noStamp, fixturePath), {
      coverageExpectation: EXCERPT_GOVERNED_COVERAGE_EXPECTATION
    })).toThrow(/requires a recorded forecast cutoff as-of/);

    const overridden = buildTeamWeekRawV0ForecastRun2Artifact(adaptTeamWeekRawV0Governed(noStamp, fixturePath), {
      coverageExpectation: EXCERPT_GOVERNED_COVERAGE_EXPECTATION,
      asOf: '2026-01-15T00:00:00+00:00'
    });
    expect(overridden.forecastCutoff.asOf).toBe('2026-01-15T00:00:00+00:00');
  });

  it('preserves source / validation / lineage references', () => {
    const artifact = buildFromFixture();

    expect(artifact.sourceArtifacts).toContain('nflverse-data:pbp/play_by_play_2024');
    expect(artifact.sourceArtifacts.length).toBeGreaterThan(0);
    expect(artifact.validationReportPath).toContain('.validation.json');
    expect(artifact.lineageManifestPath).toContain('.manifest.json');
  });

  it('keeps the team-week row grain and a machine-readable player-season join posture', () => {
    const artifact = buildFromFixture();

    expect(artifact.rowGrain).toBe('team_week');
    expect(artifact.downstreamBinding.teamstateRowGrain).toBe('team_week');
    expect([...artifact.downstreamBinding.teamWeekGrainKeys]).toEqual([...TEAM_WEEK_GRAIN_KEYS]);
    expect(artifact.downstreamBinding.bindsToForecastHere).toBe(false);
    // Join keys are stated explicitly for later player-season binding.
    expect(artifact.downstreamBinding.joinKeysRequired).toContain('input_season');
    expect(artifact.downstreamBinding.joinKeysRequired).toContain('player_input_season_team (team_2024)');
    // The Teamstate→Forecast field-name mapping is documented in machine-readable form.
    const seasonMap = artifact.downstreamBinding.fieldMapping.find((m) => m.teamstateField === 'season');
    expect(seasonMap?.forecastField).toBe('input_season');
    const teamMap = artifact.downstreamBinding.fieldMapping.find((m) => m.teamstateField === 'teamCode');
    expect(teamMap?.forecastField).toContain('player_input_season_team');
  });

  it('reports row count, team count, and week coverage at the team-week grain', () => {
    const artifact = buildFromFixture();

    expect(artifact.rowCount).toBe(4);
    expect(artifact.teamCount).toBe(4);
    expect(artifact.weekCoverage.coverage.valid).toBe(true);
    expect(artifact.weekCoverage.expectedSeason).toBe(2024);
    expect(artifact.readinessStatus).toBe('ready_minimal_boundary');
  });

  it('preserves available / partial-null / deferred field readiness', () => {
    const artifact = buildFromFixture();

    expect(artifact.availableFields.length).toBeGreaterThan(0);
    expect(artifact.partialNullFields).toContain('redZoneTdRate');
    expect(artifact.deferredInsufficientFields).toContain('pressureRateAllowed');
    const redZone = artifact.fieldReadiness.find((f) => f.field === 'redZoneTdRate');
    expect(redZone?.status).toBe('partial_nulls');
    expect(redZone?.nullCount).toBeGreaterThan(0);
    // Partial-null columns stay eligible as Forecast inputs but null-aware (never zero-filled).
    expect(artifact.forecastInputColumns).toContain('redZoneTdRate');
  });

  it('keeps pressure unavailable / insufficient_data / deferred / excluded with no numeric pressure feature', () => {
    const artifact = buildFromFixture();

    expect(artifact.pressurePosture).toBe('unavailable_insufficient_data_deferred');
    expect(artifact.pressureForecastPosture).toBe('unavailable_insufficient_data_deferred_excluded');
    expect(artifact.deferredInsufficientFields).toContain('pressureRateAllowed');
    expect(artifact.availableFields).not.toContain('pressureRateAllowed');
    expect(artifact.partialNullFields).not.toContain('pressureRateAllowed');
    // No pressure column reaches the Forecast input set, and its readiness entry holds no number.
    expect(artifact.forecastInputColumns).not.toContain('pressureRateAllowed');
    const pressure = artifact.fieldReadiness.find((f) => f.field === 'pressureRateAllowed');
    expect(pressure?.status).toBe('deferred_insufficient_data');
    expect(pressure?.finiteCount).toBe(0);
  });

  it('keeps fantasy split fields absent / excluded from Forecast input use', () => {
    const artifact = buildFromFixture();

    expect(artifact.fantasySplitPosture.status).toBe('absent_excluded_from_forecast_use');
    expect(artifact.fantasySplitPosture.presentInForecastInputColumns).toBe(false);
    expect(artifact.fantasySplitPosture.presentInTeamstateRows).toBe(false);
    expect([...artifact.fantasySplitPosture.fields]).toEqual([...TEAM_WEEK_RAW_V0_FANTASY_FIELDS]);
    for (const fantasyField of TEAM_WEEK_RAW_V0_FANTASY_FIELDS) {
      expect(artifact.forecastInputColumns).not.toContain(fantasyField);
    }
  });

  it('emits no target / future / leakage column as a Forecast input', () => {
    const artifact = buildFromFixture();

    expect(artifact.targetLeakageStatus).toBe('no_target_future_leakage_fields_emitted_as_input');
    for (const column of artifact.forecastInputColumns) {
      const lowered = column.toLowerCase();
      expect(lowered).not.toContain('2025');
      expect(lowered).not.toContain('target');
      expect(lowered).not.toContain('label');
      expect(lowered).not.toContain('future');
      expect(lowered).not.toContain('next');
      expect(lowered).not.toContain('fantasy');
      expect(lowered).not.toContain('pressure');
    }
  });

  it('stays Teamstate-owned: report-oriented, never training / evaluating / scoring / predicting', () => {
    const artifact = buildFromFixture();

    expect(artifact.productionReady).toBe(false);
    expect(artifact.kind).toBe('team_week_raw_v0_governed_readiness');
    expect(artifact.artifact).toBe('team_week_raw_v0');

    // No model-output-bearing key appears anywhere in the emitted artifact (disclaimer prose is fine).
    const collectKeys = (value: unknown, acc: string[] = []): string[] => {
      if (Array.isArray(value)) value.forEach((entry) => collectKeys(entry, acc));
      else if (value !== null && typeof value === 'object') {
        for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
          acc.push(key);
          collectKeys(nested, acc);
        }
      }
      return acc;
    };
    const keys = collectKeys(artifact).map((key) => key.toLowerCase());
    for (const forbidden of ['prediction', 'predicted', 'trainedmodel', 'evaluation', 'ranking', 'startsit', 'projection']) {
      expect(keys.some((key) => key.includes(forbidden))).toBe(false);
    }
  });

  it('emits the same artifact from the file wrapper as from the in-memory builder', () => {
    const fromFile = buildTeamWeekRawV0ForecastRun2ArtifactFile(fixturePath, {
      coverageExpectation: EXCERPT_GOVERNED_COVERAGE_EXPECTATION
    });
    expect(fromFile.forecastRun2Artifact).toBe(true);
    expect(fromFile.forecastCutoff.inputSeason).toBe(2024);
    expect(fromFile.readinessStatus).toBe('ready_minimal_boundary');
  });
});

describe('committed governed Forecast Run 2 sample export', () => {
  const samplePath = path.resolve(
    process.cwd(),
    'data/fixtures/team_week_raw_forecast_run2/team_week_raw_v0_2024_forecast_run2.sample.json'
  );
  const sample = JSON.parse(readFileSync(samplePath, 'utf-8')) as Record<string, unknown>;

  it('matches the freshly-emitted artifact for the governed sample source', () => {
    const fresh = buildTeamWeekRawV0ForecastRun2ArtifactFile(fixturePath, {
      coverageExpectation: EXCERPT_GOVERNED_COVERAGE_EXPECTATION
    });
    // The committed sample stores a repo-relative sourceArtifactPath; compare on the rest.
    const { sourceArtifactPath: _freshPath, ...freshRest } = fresh as unknown as Record<string, unknown>;
    const { sourceArtifactPath: _samplePath, ...sampleRest } = sample;
    expect(sampleRest).toEqual(freshRest);
    expect(sample.sourceArtifactPath).toBe('data/fixtures/team_week_raw_governed/team_week_raw_v0_2024_governed.sample.json');
  });

  it('is a self-consistent Forecast-consumable evidence packet', () => {
    expect(sample.forecastRun2Artifact).toBe(true);
    expect(sample.readinessStatus).toBe('ready_minimal_boundary');
    expect((sample.forecastCutoff as Record<string, unknown>).inputSeason).toBe(2024);
  });
});
