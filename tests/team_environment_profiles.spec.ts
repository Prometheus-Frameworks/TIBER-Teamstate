import { describe, expect, it } from 'vitest';
import { buildTeamEnvironmentProfilesV0 } from '../src/pipeline/teamEnvironmentProfiles.js';
import type { SeasonToDateReports } from '../src/reports/types.js';

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
    const one = buildTeamEnvironmentProfilesV0(reports, '2026-05-25T00:00:00.000Z', '2026-05-25T00:00:00.000Z');
    const two = buildTeamEnvironmentProfilesV0(reports, '2026-05-25T00:00:00.000Z', '2026-05-25T00:00:00.000Z');
    expect(two).toEqual(one);
    expect(one.artifact).toBe('team_environment_profiles_v0');
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
  });
});
