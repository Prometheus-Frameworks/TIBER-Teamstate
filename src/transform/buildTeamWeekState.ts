import { scoreFantasyEnvironment } from '../score/scoreFantasyEnvironment.js';
import { scoreMatchupEnvironment } from '../score/scoreMatchupEnvironment.js';
import { scoreStability } from '../score/scoreStability.js';
import { scoreTeamPower } from '../score/scoreTeamPower.js';
import { deriveTeamTags } from '../tags/deriveTeamTags.js';
import type { TeamWeekInputRow, TeamWeekState } from '../types/teamstate.js';
import { buildTeamExplanation } from '../explain/buildTeamExplanation.js';

export const buildTeamWeekState = (input: TeamWeekInputRow): TeamWeekState => {
  const teamPower = scoreTeamPower(input);
  const fantasyEnvironment = scoreFantasyEnvironment(input);
  const matchupEnvironment = scoreMatchupEnvironment(input);
  const stability = scoreStability(input);

  const scores = {
    teamPowerScore: teamPower.score,
    fantasyEnvironmentScore: fantasyEnvironment.score,
    matchupEnvironmentScore: matchupEnvironment.score,
    stabilityScore: stability.stabilityScore,
    volatilityScore: stability.volatilityScore
  };

  const tags = deriveTeamTags(input, scores);

  return {
    season: input.season,
    week: input.week,
    team: input.team,
    opponent: input.opponent,
    input,
    scores,
    components: {
      teamPower: teamPower.components,
      fantasyEnvironment: fantasyEnvironment.components,
      matchupEnvironment: matchupEnvironment.components,
      stability: stability.components
    },
    tags,
    explanation: buildTeamExplanation(input, scores, tags)
  };
};

export const buildTeamWeekStates = (rows: TeamWeekInputRow[]): TeamWeekState[] => rows.map(buildTeamWeekState);
