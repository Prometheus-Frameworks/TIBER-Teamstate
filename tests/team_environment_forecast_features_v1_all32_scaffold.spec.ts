import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  validateTeamEnvironmentForecastFeaturesV1,
  TEAM_ENVIRONMENT_FORECAST_FEATURE_NAMES_V1,
  type TeamEnvironmentForecastFeaturesArtifactV1
} from '../src/contracts/teamEnvironmentForecastFeaturesV1.js';
import { buildAll32ForecastFeaturesScaffold } from '../src/fixtures/teamEnvironmentForecastFeaturesV1Scaffold.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_REL = '../data/fixtures/team_environment_forecast_features/team_environment_forecast_features_v1.all32_weeks1to6.scaffold.json';
const FIXTURE_PATH = resolve(here, FIXTURE_REL);

const loadFixture = (): TeamEnvironmentForecastFeaturesArtifactV1 =>
  JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as TeamEnvironmentForecastFeaturesArtifactV1;

describe('all-32 forecast-features fixture-scaffold — builder + reproducibility', () => {
  it('is deterministic (identical output across calls)', () => {
    expect(buildAll32ForecastFeaturesScaffold()).toEqual(buildAll32ForecastFeaturesScaffold());
  });

  it('matches the committed fixture exactly (committed file is reproducible from the chain)', () => {
    expect(loadFixture()).toEqual(buildAll32ForecastFeaturesScaffold());
  });

  it('lives under data/fixtures/, never output/', () => {
    expect(FIXTURE_REL).toContain('data/fixtures/');
    expect(FIXTURE_REL).not.toContain('output/');
  });
});

describe('all-32 forecast-features fixture-scaffold — contract gate (#43 validator)', () => {
  it('passes the #43 validator', () => {
    const result = validateTeamEnvironmentForecastFeaturesV1(loadFixture());
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('is full-league: 32 teams, isFullLeague true, weeks 1-6, season 2024', () => {
    const artifact = loadFixture();
    expect(artifact.coverage.teamCount).toBe(32);
    expect(artifact.coverage.expectedTeamCount).toBe(32);
    expect(artifact.coverage.isFullLeague).toBe(true);
    expect(artifact.coverage.weeks).toEqual([1, 2, 3, 4, 5, 6]);
    expect(artifact.coverage.seasons).toEqual([2024]);
    expect(new Set(artifact.teams.map((t) => t.teamId)).size).toBe(32);
  });

  it('uses featureSeason 2024 and targetSeason 2025 with a pre-cutoff cutoffAt', () => {
    const artifact = loadFixture();
    expect(artifact.featureSeason).toBe(2024);
    expect(artifact.targetSeason).toBe(2025);
    // cutoff is at/after the feature season and strictly before the target season window.
    expect(new Date(artifact.cutoffAt).getUTCFullYear()).toBe(2025);
  });

  it('declares exactly the canonical feature set and aligns every team row to it', () => {
    const artifact = loadFixture();
    const declared = artifact.featureDefinitions.map((d) => d.name).sort();
    expect(declared).toEqual([...TEAM_ENVIRONMENT_FORECAST_FEATURE_NAMES_V1].sort());
    for (const team of artifact.teams) {
      expect(Object.keys(team.features).sort()).toEqual([...TEAM_ENVIRONMENT_FORECAST_FEATURE_NAMES_V1].sort());
    }
  });
});

describe('all-32 forecast-features fixture-scaffold — honesty + derivation', () => {
  it('is an explicit fixture: governance fixture/explicit_marker, never governed, confidence 0', () => {
    const artifact = loadFixture();
    expect(artifact.governance.governanceStatus).toBe('fixture');
    expect(artifact.governance.governanceSource).toBe('explicit_marker');
    expect(artifact.governance.governanceStatus).not.toBe('governed');
    for (const team of artifact.teams) {
      expect(team.confidence).toBe(0);
      expect(team.featureCoverageStatus).toBe('partial');
      expect(team.warnings.length).toBeGreaterThan(0);
      expect(team.sourceDatasetRefs).toContain(
        'data/fixtures/team_week_raw/team_week_raw_v0.all32_weeks1to6.scaffold.json'
      );
    }
  });

  it('carries no fantasy-point fields anywhere', () => {
    const serialized = JSON.stringify(loadFixture()).toLowerCase();
    expect(serialized).not.toContain('fantasypoint');
    expect(serialized).not.toContain('fantasy_point');
  });

  it('reflects the neutral upstream scaffold: tiers unknown, uniform values across teams', () => {
    const artifact = loadFixture();
    for (const team of artifact.teams) {
      expect(team.features.offense_tier).toBe('unknown');
      expect(team.features.volatility_tier).toBe('unknown');
    }
    // Uniform neutral input => identical numeric feature values across all teams (no invented signal).
    expect(new Set(artifact.teams.map((t) => t.features.points_per_drive)).size).toBe(1);
    expect(new Set(artifact.teams.map((t) => t.features.epa_per_play)).size).toBe(1);
  });

  it('emits teams in deterministic teamId order', () => {
    const ids = loadFixture().teams.map((t) => t.teamId);
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
  });
});

describe('all-32 forecast-features fixture-scaffold — validator fails closed on tampering', () => {
  it('fails closed when a team is dropped (coverage no longer matches rows)', () => {
    const artifact = loadFixture();
    artifact.teams = artifact.teams.filter((t) => t.teamId !== 'KC');
    const result = validateTeamEnvironmentForecastFeaturesV1(artifact);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('number of team rows'))).toBe(true);
  });

  it('fails closed when a declared feature is removed from a row', () => {
    const artifact = loadFixture();
    delete (artifact.teams[0].features as unknown as Record<string, unknown>).neutral_pass_rate;
    const result = validateTeamEnvironmentForecastFeaturesV1(artifact);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('neutral_pass_rate'))).toBe(true);
  });

  it('fails closed on a malformed numeric feature value', () => {
    const artifact = loadFixture();
    (artifact.teams[0].features as unknown as Record<string, unknown>).points_per_drive = 'n/a';
    const result = validateTeamEnvironmentForecastFeaturesV1(artifact);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('points_per_drive must be a finite number or null'))).toBe(true);
  });
});
