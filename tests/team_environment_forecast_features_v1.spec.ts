import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  validateTeamEnvironmentForecastFeaturesV1,
  TEAM_ENVIRONMENT_FORECAST_FEATURE_NAMES_V1,
  type TeamEnvironmentForecastFeaturesArtifactV1
} from '../src/contracts/teamEnvironmentForecastFeaturesV1.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(
  here,
  '../data/fixtures/team_environment_forecast_features/team_environment_forecast_features_v1.sample.json'
);

const loadFixture = (): TeamEnvironmentForecastFeaturesArtifactV1 =>
  JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as TeamEnvironmentForecastFeaturesArtifactV1;

describe('team environment forecast features v1 — committed fixture', () => {
  it('is a structurally valid, team-state-only v1 artifact', () => {
    const result = validateTeamEnvironmentForecastFeaturesV1(loadFixture());
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('is an explicit fixture: non-full-league, non-governed, confidence 0', () => {
    const artifact = loadFixture();
    expect(artifact.governance.governanceStatus).toBe('fixture');
    expect(artifact.governance.governanceSource).toBe('explicit_marker');
    expect(artifact.coverage.isFullLeague).toBe(false);
    expect(artifact.coverage.teamCount).toBeLessThan(artifact.coverage.expectedTeamCount);
    for (const team of artifact.teams) {
      expect(team.confidence).toBe(0);
      expect(team.featureCoverageStatus).toBe('unavailable');
    }
  });

  it('carries no fantasy-point fields anywhere', () => {
    const serialized = JSON.stringify(loadFixture()).toLowerCase();
    expect(serialized).not.toContain('fantasypoint');
    expect(serialized).not.toContain('fantasy_point');
  });

  it('declares every candidate feature and aligns each team row to it', () => {
    const artifact = loadFixture();
    const declared = artifact.featureDefinitions.map((definition) => definition.name).sort();
    expect(declared).toEqual([...TEAM_ENVIRONMENT_FORECAST_FEATURE_NAMES_V1].sort());
    for (const team of artifact.teams) {
      expect(Object.keys(team.features).sort()).toEqual([...TEAM_ENVIRONMENT_FORECAST_FEATURE_NAMES_V1].sort());
    }
  });
});

describe('team environment forecast features v1 — validator fails closed', () => {
  it('rejects a non-object', () => {
    expect(validateTeamEnvironmentForecastFeaturesV1(null).valid).toBe(false);
    expect(validateTeamEnvironmentForecastFeaturesV1('nope').valid).toBe(false);
  });

  it('rejects a missing cutoff', () => {
    const artifact = loadFixture() as unknown as Record<string, unknown>;
    delete artifact.cutoffAt;
    const result = validateTeamEnvironmentForecastFeaturesV1(artifact);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('cutoffAt'))).toBe(true);
  });

  it('rejects missing governance', () => {
    const artifact = loadFixture() as unknown as Record<string, unknown>;
    delete artifact.governance;
    const result = validateTeamEnvironmentForecastFeaturesV1(artifact);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('governance'))).toBe(true);
  });

  it('rejects missing coverage', () => {
    const artifact = loadFixture() as unknown as Record<string, unknown>;
    delete artifact.coverage;
    const result = validateTeamEnvironmentForecastFeaturesV1(artifact);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('coverage'))).toBe(true);
  });

  it('rejects an invalid governance status', () => {
    const artifact = loadFixture();
    (artifact.governance as unknown as Record<string, unknown>).governanceStatus = 'totally_governed';
    const result = validateTeamEnvironmentForecastFeaturesV1(artifact);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('governanceStatus'))).toBe(true);
  });

  it('fails closed when any fantasy-point field is injected', () => {
    const artifact = loadFixture();
    (artifact.teams[0].features as unknown as Record<string, unknown>).fantasyPointsForWR = 31;
    const result = validateTeamEnvironmentForecastFeaturesV1(artifact);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('fantasy-point'))).toBe(true);
  });

  it('rejects a team whose features do not match the declared definitions', () => {
    const artifact = loadFixture();
    delete (artifact.teams[0].features as unknown as Record<string, unknown>).neutral_pass_rate;
    const result = validateTeamEnvironmentForecastFeaturesV1(artifact);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('neutral_pass_rate'))).toBe(true);
  });

  it('rejects an out-of-range confidence', () => {
    const artifact = loadFixture();
    artifact.teams[0].confidence = 1.5;
    const result = validateTeamEnvironmentForecastFeaturesV1(artifact);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('confidence'))).toBe(true);
  });

  it('rejects a featureDefinitions manifest that drops a canonical feature from every row', () => {
    const artifact = loadFixture();
    artifact.featureDefinitions = artifact.featureDefinitions.filter(
      (definition) => definition.name !== 'neutral_pass_rate'
    );
    for (const team of artifact.teams) {
      delete (team.features as unknown as Record<string, unknown>).neutral_pass_rate;
    }
    const result = validateTeamEnvironmentForecastFeaturesV1(artifact);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('missing canonical feature "neutral_pass_rate"'))).toBe(true);
  });

  it('rejects a featureDefinitions manifest that declares an unknown feature', () => {
    const artifact = loadFixture();
    artifact.featureDefinitions = [
      ...artifact.featureDefinitions,
      { name: 'team_spirit', type: 'number', description: 'x', allowedInModel: true, allowedInPosthocExplanation: true }
    ] as typeof artifact.featureDefinitions;
    const result = validateTeamEnvironmentForecastFeaturesV1(artifact);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('unknown feature "team_spirit"'))).toBe(true);
  });

  it('rejects coverage that overstates teamCount / isFullLeague vs the actual rows', () => {
    const artifact = loadFixture();
    artifact.coverage.teamCount = 32;
    artifact.coverage.isFullLeague = true;
    const result = validateTeamEnvironmentForecastFeaturesV1(artifact);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('must equal the number of team rows'))).toBe(true);
  });

  it('rejects a malformed numeric feature value', () => {
    const artifact = loadFixture();
    (artifact.teams[0].features as unknown as Record<string, unknown>).points_per_drive = 'n/a';
    const result = validateTeamEnvironmentForecastFeaturesV1(artifact);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('points_per_drive must be a finite number or null'))).toBe(true);
  });

  it('rejects an out-of-vocabulary direction feature value', () => {
    const artifact = loadFixture();
    (artifact.teams[0].features as unknown as Record<string, unknown>).offense_direction = 'up';
    const result = validateTeamEnvironmentForecastFeaturesV1(artifact);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('offense_direction must be one of'))).toBe(true);
  });
});
