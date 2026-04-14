import type { TeamExplanation, TeamTag, TeamWeekInputRow, TeamScoreBreakdown } from '../types/teamstate.js';

const TAG_MESSAGES: Record<TeamTag, string> = {
  elite_real_life_team: 'Profiled as an elite real-life team with strong down-to-down quality.',
  elite_fantasy_environment: 'Creates one of the strongest fantasy ecosystems in the league.',
  pass_funnel_offense: 'Leans pass-heavy in neutral situations, supporting QB/WR volume.',
  run_heavy_low_ceiling: 'Rush tendency suppresses broad fantasy ceiling despite some floor.',
  red_zone_machine: 'Generates frequent and efficient red-zone opportunities.',
  explosive_but_volatile: 'High-play volatility with spike-week capability and fragility.',
  stable_environment: 'Environment is repeatable with low week-to-week chaos.',
  fraudulent_td_environment: 'Touchdown efficiency appears unsustainably high versus drive quality.',
  qb_friendly_matchup: 'Defense allows elevated QB scoring outcomes to opponents.',
  wr_slot_funnel_defense: 'Defense is notably vulnerable to slot receiver production.',
  te_dead_zone_defense: 'Defense suppresses tight-end production across usage alignments.'
};

export const buildTeamExplanation = (
  input: TeamWeekInputRow,
  scores: TeamScoreBreakdown,
  tags: TeamTag[]
): TeamExplanation => {
  const strengths: string[] = [];
  const risks: string[] = [];

  if (scores.teamPowerScore >= 70) strengths.push('Strong team power driven by efficient and successful offense.');
  if (scores.fantasyEnvironmentScore >= 70) strengths.push('High fantasy-friendly environment with pace, volume, and scoring access.');
  if (scores.matchupEnvironmentScore >= 65) strengths.push('Defense allows productive fantasy matchups across key positions.');
  if (scores.stabilityScore >= 70) strengths.push('Scoring profile is repeatable with solid process indicators.');

  if (scores.teamPowerScore < 45) risks.push('Underlying team quality is weak and can collapse under pressure.');
  if (scores.fantasyEnvironmentScore < 45) risks.push('Limited play volume or red-zone access reduces fantasy viability.');
  if (scores.volatilityScore >= 65) risks.push('High volatility suggests unstable weekly outcomes.');
  if (input.turnovers >= 3) risks.push('Turnover risk can quickly break expected game environment.');

  if (!strengths.length) strengths.push('Balanced profile with no singular dominant strength this week.');
  if (!risks.length) risks.push('No immediate structural red flags beyond normal weekly variance.');

  const environmentType =
    scores.teamPowerScore >= 75 && scores.fantasyEnvironmentScore >= 75
      ? 'an elite real-life and fantasy environment'
      : scores.teamPowerScore >= 70
        ? 'a strong real-life team environment'
        : scores.fantasyEnvironmentScore >= 70
          ? 'a fantasy-friendly offense-first environment'
          : scores.volatilityScore >= 65
            ? 'a volatile, high-variance environment'
            : 'a balanced but middling environment';

  const topTagReason = tags.length ? TAG_MESSAGES[tags[0]] : 'No dominant tag signal was triggered this week.';
  const summary = `${input.team} in Week ${input.week} profiles as ${environmentType}. Core drivers were EPA/play ${input.epaPerPlay.toFixed(2)}, success rate ${(input.successRate * 100).toFixed(1)}%, and ${input.redZoneTrips} red-zone trips at ${(input.redZoneTdRate * 100).toFixed(1)}% TD conversion. ${topTagReason}`;

  return {
    summary,
    strengths,
    risks,
    tags
  };
};
