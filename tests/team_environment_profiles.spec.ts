import { describe, expect, it } from 'vitest';
import { buildTeamEnvironmentProfilesV0 } from '../src/pipeline/teamEnvironmentProfiles.js';
import type { SeasonToDateReports } from '../src/reports/types.js';

const NFL_TEAM_ABBRS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
  'LV', 'LAC', 'LAR', 'MIA', 'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS'
];

const reports: SeasonToDateReports = {
  aggregates: [
    {
      team: 'AAA', season: 2026, games: 2, latestWeek: 2, tags: [], summary: 'x',
      averages: {
        teamPowerScore: 70, fantasyEnvironmentScore: 86, matchupEnvironmentScore: 50, stabilityScore: 80, volatilityScore: 40,
        offensivePlays: 67, secondsPerPlay: 26.5, neutralPassRate: 0.59, rushRate: 0.41, redZoneTrips: 4, redZoneTdRate: 0.6,
        explosivePlayRate: 0.12, fantasyPointsForQB: 20, fantasyPointsForRB: 22, fantasyPointsForWR: 30, fantasyPointsForTE: 10,
        fantasyPointsAllowedQB: 18, fantasyPointsAllowedRB: 17, fantasyPointsAllowedWR: 28, fantasyPointsAllowedTE: 8
      }
    },
    {
      team: 'BBB', season: 2026, games: 2, latestWeek: 2, tags: [], summary: 'x',
      averages: {
        teamPowerScore: 45, fantasyEnvironmentScore: 49, matchupEnvironmentScore: 50, stabilityScore: 52, volatilityScore: 65,
        offensivePlays: 59, secondsPerPlay: 29.4, neutralPassRate: 0.4, rushRate: 0.6, redZoneTrips: 2, redZoneTdRate: 0.4,
        explosivePlayRate: 0.08, fantasyPointsForQB: 14, fantasyPointsForRB: 16, fantasyPointsForWR: 20, fantasyPointsForTE: 7,
        fantasyPointsAllowedQB: 24, fantasyPointsAllowedRB: 22, fantasyPointsAllowedWR: 31, fantasyPointsAllowedTE: 11
      }
    }
  ],
  rows: { teamPower: [], fantasyEnvironment: [], matchupEnvironment: [], qbOffenseEnvironment: [], rbOffenseEnvironment: [], wrOffenseEnvironment: [], teOffenseEnvironment: [], qbMatchups: [], rbMatchups: [], wrMatchups: [], teMatchups: [] }
};

describe('team environment profiles v0', () => {
  it('builds deterministic artifact shape and tier mappings', () => {
    const one = buildTeamEnvironmentProfilesV0(reports, '2026-05-25T00:00:00.000Z', '2026-05-25T00:00:00.000Z', 'data/sample/team_week_raw.sample.json');
    const two = buildTeamEnvironmentProfilesV0(reports, '2026-05-25T00:00:00.000Z', '2026-05-25T00:00:00.000Z', 'data/sample/team_week_raw.sample.json');
    expect(two).toEqual(one);
    expect(one.artifact).toBe('team_environment_profiles_v0');
    expect(one.metadata.provenanceStatus).toBe('fixture_scaffold');
    expect(one.metadata.coverage.teamCount).toBe(2);
    expect(one.metadata.coverage.expectedTeamCount).toBe(32);
    expect(one.metadata.coverage.isFullLeague).toBe(false);
    expect(one.metadata.coverage.unexpectedTeams).toEqual(['AAA', 'BBB']);
    expect(one.metadata.inputSources[0]?.path).toBe('data/sample/team_week_raw.sample.json');
    expect(one.profiles).toHaveLength(2);
    expect(one.profiles[0].offenseTier).toBe('elite');
    expect(one.profiles[0].passEnvironmentTier).toBe('pass_heavy');
    expect(one.profiles[0].paceTier).toBe('fast');
    expect(one.profiles[0].volatilityTier).toBe('stable');
    expect(one.profiles[1].offenseTier).toBe('weak');
    expect(one.profiles[1].passEnvironmentTier).toBe('run_heavy');
    expect(one.profiles[1].paceTier).toBe('slow');
    expect(one.profiles[1].volatilityTier).toBe('volatile');
  });

  it('never marks incomplete coverage as governed real data', () => {
    const artifact = buildTeamEnvironmentProfilesV0(reports, '2026-05-25T00:00:00.000Z', null, 'data/unknown/raw.json');
    expect(artifact.metadata.coverage.teamCount).toBeLessThan(artifact.metadata.coverage.expectedTeamCount);
    expect(artifact.metadata.provenanceStatus).not.toBe('governed_real_data');
    expect(artifact.metadata.provenanceNotes.some((note) => note.includes('incomplete'))).toBe(true);
  });

  it('uses canonical membership for full-league coverage', () => {
    const completeButInvalid = structuredClone(reports);
    completeButInvalid.aggregates = [...NFL_TEAM_ABBRS.filter((team) => team !== 'WAS'), 'XXX'].map((team) => ({
      ...reports.aggregates[0],
      team
    }));

    const artifact = buildTeamEnvironmentProfilesV0(completeButInvalid, '2026-05-25T00:00:00.000Z', null, 'data/sample/team_week_raw.sample.json');
    expect(artifact.metadata.coverage.teamCount).toBe(32);
    expect(artifact.metadata.coverage.missingTeams).toContain('WAS');
    expect(artifact.metadata.coverage.unexpectedTeams).toContain('XXX');
    expect(artifact.metadata.coverage.isFullLeague).toBe(false);
  });

  it('emits unknown + warnings for missing lanes', () => {
    const unknownReports = structuredClone(reports);
    unknownReports.aggregates[0].averages.neutralPassRate = Number.NaN;
    unknownReports.aggregates[0].averages.secondsPerPlay = Number.NaN;
    unknownReports.aggregates[0].averages.fantasyEnvironmentScore = Number.NaN;
    unknownReports.aggregates[0].averages.volatilityScore = 50;

    const artifact = buildTeamEnvironmentProfilesV0(unknownReports, '2026-05-25T00:00:00.000Z', null);
    const profile = artifact.profiles.find((row) => row.teamAbbr === 'AAA');
    expect(profile?.marketTier).toBe('unknown');
    expect(profile?.offenseTier).toBe('unknown');
    expect(profile?.passEnvironmentTier).toBe('unknown');
    expect(profile?.paceTier).toBe('unknown');
    expect(profile?.volatilityTier).toBe('unknown');
    expect(profile?.warnings.length).toBeGreaterThan(1);
    const signalByName = new Map((profile?.signals ?? []).map((signal) => [signal.name, signal.value]));
    expect(signalByName.get('fantasyEnvironmentScore')).toBeNull();
    expect(signalByName.get('neutralPassRate')).toBeNull();
    expect(signalByName.get('secondsPerPlay')).toBeNull();
  });

  it('marks non-finite numeric signals as null', () => {
    const unknownReports = structuredClone(reports);
    unknownReports.aggregates[0].averages.volatilityScore = Number.POSITIVE_INFINITY;

    const artifact = buildTeamEnvironmentProfilesV0(unknownReports, '2026-05-25T00:00:00.000Z', null);
    const profile = artifact.profiles.find((row) => row.teamAbbr === 'AAA');
    const signalByName = new Map((profile?.signals ?? []).map((signal) => [signal.name, signal.value]));
    expect(signalByName.get('volatilityScore')).toBeNull();
  });
});
