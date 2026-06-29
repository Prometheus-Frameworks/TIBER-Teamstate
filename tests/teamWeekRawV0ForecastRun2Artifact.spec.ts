import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { adaptTeamWeekRawV0Governed } from '../src/adapters/teamWeekRawV0GovernedAdapter.js';
import {
  buildTeamWeekRawV0ForecastRun2Artifact,
  buildTeamWeekRawV0ForecastRun2ArtifactFile,
  EXCERPT_GOVERNED_COVERAGE_EXPECTATION,
  FORECAST_RUN2_DEFAULT_CUTOFF_AS_OF,
  FORECAST_RUN2_INPUT_SEASON,
  FORECAST_RUN2_TARGET_SEASON,
  FORECAST_RUN2_TARGET_SEASON_START,
  parseTimezoneExplicitAsOf,
  TEAM_WEEK_GRAIN_KEYS,
  type BuildForecastRun2ArtifactOptions
} from '../src/governed/teamWeekRawV0ForecastRun2Artifact.js';
import { TEAM_WEEK_RAW_V0_FANTASY_FIELDS } from '../src/adapters/teamWeekRawV0GovernedAdapter.js';

const fixturePath = path.resolve(
  process.cwd(),
  'data/fixtures/team_week_raw_governed/team_week_raw_v0_2024_governed.sample.json'
);
const loadFixture = (): Record<string, unknown> => JSON.parse(readFileSync(fixturePath, 'utf-8')) as Record<string, unknown>;
const excerptOptions = (overrides: Partial<BuildForecastRun2ArtifactOptions> = {}): BuildForecastRun2ArtifactOptions => ({
  coverageExpectation: EXCERPT_GOVERNED_COVERAGE_EXPECTATION,
  asOf: FORECAST_RUN2_DEFAULT_CUTOFF_AS_OF,
  ...overrides
});
const buildFromFixture = (overrides: Partial<BuildForecastRun2ArtifactOptions> = {}) =>
  buildTeamWeekRawV0ForecastRun2Artifact(adaptTeamWeekRawV0Governed(loadFixture(), fixturePath), excerptOptions(overrides));

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
    // A recorded pre-target as-of timestamp must be present and parseable.
    expect(typeof artifact.forecastCutoff.asOf).toBe('string');
    expect(artifact.forecastCutoff.asOf.length).toBeGreaterThan(0);
    expect(Number.isNaN(Date.parse(artifact.forecastCutoff.asOf))).toBe(false);
    expect(Date.parse(artifact.forecastCutoff.asOf)).toBeLessThan(Date.parse(FORECAST_RUN2_TARGET_SEASON_START));
    expect(artifact.forecastCutoff.targetSeasonStart).toBe(FORECAST_RUN2_TARGET_SEASON_START);
  });

  it('distinguishes the forecast cutoff as-of from the source generated/build timestamp', () => {
    // The committed governed source's generatedAt is post-target (2026); it must NOT become the cutoff.
    const artifact = buildFromFixture();
    expect(artifact.forecastCutoff.sourceGeneratedAt).toBe('2026-06-25T19:20:51+00:00');
    expect(artifact.forecastCutoff.asOf).not.toBe(artifact.forecastCutoff.sourceGeneratedAt);
    expect(artifact.forecastCutoff.asOf).toBe(FORECAST_RUN2_DEFAULT_CUTOFF_AS_OF);
    // Even with no generatedAt at all, a valid as-of must still be supplied by the caller.
    const noStamp = loadFixture();
    delete noStamp.generatedAt;
    const fromNoStamp = buildTeamWeekRawV0ForecastRun2Artifact(adaptTeamWeekRawV0Governed(noStamp, fixturePath), excerptOptions());
    expect(fromNoStamp.forecastCutoff.sourceGeneratedAt).toBeNull();
    expect(fromNoStamp.forecastCutoff.asOf).toBe(FORECAST_RUN2_DEFAULT_CUTOFF_AS_OF);
  });

  it('refuses to emit a 2024-cutoff artifact for a non-2024 governed source', () => {
    const wrongSeason = loadFixture();
    wrongSeason.season = 2023;
    expect(() => buildTeamWeekRawV0ForecastRun2Artifact(adaptTeamWeekRawV0Governed(wrongSeason, fixturePath), excerptOptions()))
      .toThrow(/recorded cutoff is pinned to input season 2024/);
  });

  it('fails closed when no forecast cutoff as-of is supplied (generatedAt is never the cutoff)', () => {
    expect(() => buildTeamWeekRawV0ForecastRun2Artifact(adaptTeamWeekRawV0Governed(loadFixture(), fixturePath), {
      coverageExpectation: EXCERPT_GOVERNED_COVERAGE_EXPECTATION
    })).toThrow(/requires an explicit pre-target forecast cutoff as-of/);

    // An empty/whitespace as-of also fails closed.
    expect(() => buildFromFixture({ asOf: '   ' })).toThrow(/requires an explicit pre-target forecast cutoff as-of/);
  });

  it('fails closed on a malformed as-of timestamp', () => {
    expect(() => buildFromFixture({ asOf: 'not-a-timestamp' })).toThrow(/malformed forecast cutoff as-of/);
  });

  it('fails closed on a target-season / post-target / future-looking as-of', () => {
    // Exactly at the target-season start boundary (not strictly before) fails closed.
    expect(() => buildFromFixture({ asOf: FORECAST_RUN2_TARGET_SEASON_START })).toThrow(/on\/after the 2025 target season start/);
    // Inside the 2025 target season.
    expect(() => buildFromFixture({ asOf: '2025-10-01T00:00:00.000Z' })).toThrow(/on\/after the 2025 target season start/);
    // A post-target build-style timestamp (mirrors the old generatedAt default) fails closed.
    expect(() => buildFromFixture({ asOf: '2026-06-25T19:20:51+00:00' })).toThrow(/on\/after the 2025 target season start/);
  });

  it('succeeds with a valid pre-target as-of and computes cutoffBeforeTargetSeason from validation', () => {
    const artifact = buildFromFixture({ asOf: '2025-01-15T00:00:00.000Z' });
    expect(artifact.forecastCutoff.asOf).toBe('2025-01-15T00:00:00.000Z');
    expect(artifact.forecastCutoff.cutoffBeforeTargetSeason).toBe(true);
    // The boolean tracks the validation: the only path to a returned artifact is a pre-target as-of,
    // and a non-pre-target as-of throws instead of returning cutoffBeforeTargetSeason: false.
    expect(Date.parse(artifact.forecastCutoff.asOf)).toBeLessThan(Date.parse(artifact.forecastCutoff.targetSeasonStart));
  });

  it('fails closed on a timezone-ambiguous (offset-less) as-of', () => {
    // A target-boundary-looking offset-less string must not slip past the pre-target guard.
    expect(() => buildFromFixture({ asOf: '2025-09-01T00:00:00' })).toThrow(/timezone-ambiguous forecast cutoff as-of/);
    // An otherwise-valid pre-target-looking offset-less string also fails closed.
    expect(() => buildFromFixture({ asOf: '2025-03-01T00:00:00' })).toThrow(/timezone-ambiguous forecast cutoff as-of/);
    // Date-only (no time, no zone) is ambiguous too.
    expect(() => buildFromFixture({ asOf: '2025-03-01' })).toThrow(/timezone-ambiguous forecast cutoff as-of/);
  });

  it('accepts Z-qualified and explicit-offset pre-target as-of values deterministically', () => {
    const utc = buildFromFixture({ asOf: '2025-03-01T00:00:00.000Z' });
    expect(utc.forecastCutoff.asOf).toBe('2025-03-01T00:00:00.000Z');
    expect(utc.forecastCutoff.cutoffBeforeTargetSeason).toBe(true);

    // Explicit negative and zero offsets parse to a deterministic instant regardless of host TZ.
    const minus5 = buildFromFixture({ asOf: '2025-03-01T00:00:00-05:00' });
    expect(minus5.forecastCutoff.cutoffBeforeTargetSeason).toBe(true);
    const plus0 = buildFromFixture({ asOf: '2025-03-01T00:00:00+00:00' });
    expect(plus0.forecastCutoff.cutoffBeforeTargetSeason).toBe(true);
  });

  it('fails closed on explicit-offset target-boundary / post-target as-of values', () => {
    // Same wall-clock as the boundary but in an explicit offset that lands on/after it in UTC.
    expect(() => buildFromFixture({ asOf: '2025-09-01T00:00:00+00:00' })).toThrow(/on\/after the 2025 target season start/);
    // A +14:00 wall-clock string whose UTC instant is still on/after the boundary.
    expect(() => buildFromFixture({ asOf: '2025-09-02T00:00:00+14:00' })).toThrow(/on\/after the 2025 target season start/);
  });

  it('exposes a parseTimezoneExplicitAsOf helper with deterministic, TZ-independent semantics', () => {
    // Z and explicit offsets resolve to the same instant; offset-less and malformed fail closed.
    expect(parseTimezoneExplicitAsOf('2025-03-01T05:00:00.000Z')).toBe(parseTimezoneExplicitAsOf('2025-03-01T00:00:00-05:00'));
    expect(() => parseTimezoneExplicitAsOf('2025-03-01T00:00:00')).toThrow(/timezone-ambiguous/);
    expect(() => parseTimezoneExplicitAsOf('not-a-timestamp')).toThrow(/malformed/);
    // The repo constants are themselves timezone-explicit and accepted by the helper.
    expect(() => parseTimezoneExplicitAsOf(FORECAST_RUN2_DEFAULT_CUTOFF_AS_OF)).not.toThrow();
    expect(() => parseTimezoneExplicitAsOf(FORECAST_RUN2_TARGET_SEASON_START)).not.toThrow();
    expect(FORECAST_RUN2_TARGET_SEASON_START).toMatch(/(Z|[+-]\d{2}:\d{2})$/);
    expect(FORECAST_RUN2_DEFAULT_CUTOFF_AS_OF).toMatch(/(Z|[+-]\d{2}:\d{2})$/);
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
    const fromFile = buildTeamWeekRawV0ForecastRun2ArtifactFile(fixturePath, excerptOptions());
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
    const fresh = buildTeamWeekRawV0ForecastRun2ArtifactFile(fixturePath, excerptOptions());
    // The committed sample stores a repo-relative sourceArtifactPath; compare on the rest.
    const { sourceArtifactPath: _freshPath, ...freshRest } = fresh as unknown as Record<string, unknown>;
    const { sourceArtifactPath: _samplePath, ...sampleRest } = sample;
    expect(sampleRest).toEqual(freshRest);
    expect(sample.sourceArtifactPath).toBe('data/fixtures/team_week_raw_governed/team_week_raw_v0_2024_governed.sample.json');
  });

  it('is a self-consistent Forecast-consumable evidence packet with a pre-target as-of', () => {
    expect(sample.forecastRun2Artifact).toBe(true);
    expect(sample.readinessStatus).toBe('ready_minimal_boundary');
    const cutoff = sample.forecastCutoff as Record<string, unknown>;
    expect(cutoff.inputSeason).toBe(2024);
    // The committed sample records a pre-target as-of distinct from the source build timestamp.
    expect(cutoff.asOf).not.toBe(cutoff.sourceGeneratedAt);
    expect(cutoff.cutoffBeforeTargetSeason).toBe(true);
    expect(Date.parse(cutoff.asOf as string)).toBeLessThan(Date.parse(cutoff.targetSeasonStart as string));
  });
});
