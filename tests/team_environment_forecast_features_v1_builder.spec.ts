import { describe, expect, it } from 'vitest';
import { adaptTeamWeekRawV0Artifact } from '../src/adapters/teamWeekRawV0Adapter.js';
import { mapRawTeamWeekToTeamStateInput } from '../src/adapters/mapRawTeamWeekToTeamStateInput.js';
import { buildTeamWeekStates } from '../src/transform/buildTeamWeekState.js';
import { buildTeamEnvironmentMovementV1 } from '../src/pipeline/teamEnvironmentMovementV1.js';
import {
  buildTeamEnvironmentForecastFeaturesV1,
  type BuildForecastFeaturesOptions
} from '../src/pipeline/teamEnvironmentForecastFeaturesV1.js';
import {
  buildTeamWeekRawV0FullLeagueScaffold,
  NFL_TEAM_CODES_32
} from '../src/fixtures/teamWeekRawV0FullLeagueScaffold.js';
import { validateTeamEnvironmentForecastFeaturesV1 } from '../src/contracts/teamEnvironmentForecastFeaturesV1.js';
import type { TeamEnvironmentMovementArtifactV1 } from '../src/contracts/teamEnvironmentMovementV1.js';

const baseMovement = (): TeamEnvironmentMovementArtifactV1 => {
  const raw = buildTeamWeekRawV0FullLeagueScaffold(2024);
  const adapted = adaptTeamWeekRawV0Artifact(raw);
  const states = buildTeamWeekStates(mapRawTeamWeekToTeamStateInput(adapted.rows));
  return buildTeamEnvironmentMovementV1(states, '2026-06-24T00:00:00.000Z', 'fixture.json', adapted.provenanceStatus);
};

const baseOptions = (overrides: Partial<BuildForecastFeaturesOptions> = {}): BuildForecastFeaturesOptions => ({
  generatedAt: '2026-06-24T00:00:00.000Z',
  cutoffAt: '2025-09-01T00:00:00.000Z',
  featureSeason: 2024,
  targetSeason: 2025,
  expectedTeams: NFL_TEAM_CODES_32,
  ...overrides
});

const clone = (movement: TeamEnvironmentMovementArtifactV1): TeamEnvironmentMovementArtifactV1 =>
  structuredClone(movement);

describe('buildTeamEnvironmentForecastFeaturesV1 — fail-closed input guards', () => {
  it('fails closed when a movement row is outside featureSeason (leakage guard)', () => {
    const movement = clone(baseMovement());
    movement.teams[0].season = 2025;
    expect(() => buildTeamEnvironmentForecastFeaturesV1(movement, baseOptions())).toThrow(
      /cross-season rows|not matching featureSeason/
    );
  });

  it('fails closed on a duplicate team in the movement input', () => {
    const movement = clone(baseMovement());
    movement.teams.push(structuredClone(movement.teams[0]!));
    expect(() => buildTeamEnvironmentForecastFeaturesV1(movement, baseOptions())).toThrow(/duplicate team/);
  });

  it('fails closed on an unexpected team when expectedTeams is provided', () => {
    const movement = clone(baseMovement());
    movement.teams[0].teamId = 'XXX';
    expect(() => buildTeamEnvironmentForecastFeaturesV1(movement, baseOptions())).toThrow(/unexpected team "XXX"/);
  });

  it('emits a partial (not full-league) artifact when a team is missing — no false full-league', () => {
    const movement = clone(baseMovement());
    movement.teams = movement.teams.filter((team) => team.teamId !== 'KC');
    const artifact = buildTeamEnvironmentForecastFeaturesV1(movement, baseOptions());
    expect(artifact.coverage.teamCount).toBe(31);
    expect(artifact.coverage.expectedTeamCount).toBe(32);
    expect(artifact.coverage.isFullLeague).toBe(false);
    // Still a structurally valid artifact — just honestly not full-league.
    expect(validateTeamEnvironmentForecastFeaturesV1(artifact).valid).toBe(true);
  });

  it('builds a clean full-league artifact for the 32-team single-season movement', () => {
    const artifact = buildTeamEnvironmentForecastFeaturesV1(baseMovement(), baseOptions());
    expect(artifact.coverage.teamCount).toBe(32);
    expect(artifact.coverage.isFullLeague).toBe(true);
    expect(validateTeamEnvironmentForecastFeaturesV1(artifact).valid).toBe(true);
  });
});
