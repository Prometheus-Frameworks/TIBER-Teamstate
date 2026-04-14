import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapRawTeamWeekToTeamStateInput, type RawTeamWeekRow } from '../adapters/mapRawTeamWeekToTeamStateInput.js';
import { validateTeamWeekInputRow } from '../ingest/loadTeamWeekInputs.js';
import { buildTeamWeekStates } from '../transform/buildTeamWeekState.js';
import { writeJsonFile } from '../utils/writeJsonFile.js';
import { rankByScore, rankMatchupsByAllowedPoints, type RankingRow } from './rankings.js';

export interface TeamStatePipelineResult {
  teamStates: ReturnType<typeof buildTeamWeekStates>;
  rankings: Record<string, RankingRow[]>;
}

export const isDirectExecution = (metaUrl: string, argvPath: string | undefined): boolean => {
  if (!argvPath) {
    return false;
  }

  const moduleFilePath = path.normalize(path.resolve(fileURLToPath(metaUrl)));
  const entryFilePath = path.normalize(path.resolve(argvPath));

  return moduleFilePath === entryFilePath;
};

export const runTeamStatePipeline = (rawInputPath: string, outputDir: string): TeamStatePipelineResult => {
  const rawJson = readFileSync(rawInputPath, 'utf-8');
  const parsed = JSON.parse(rawJson) as RawTeamWeekRow[];

  if (!Array.isArray(parsed)) {
    throw new Error('Expected array of raw team-week records.');
  }

  const mappedRows = mapRawTeamWeekToTeamStateInput(parsed);
  const validatedRows = mappedRows.map(validateTeamWeekInputRow);
  const teamStates = buildTeamWeekStates(validatedRows);

  const rankings: Record<string, RankingRow[]> = {
    'rankings.team_power.json': rankByScore(teamStates, 'teamPowerScore'),
    'rankings.fantasy_environment.json': rankByScore(teamStates, 'fantasyEnvironmentScore'),
    'rankings.matchup_environment.json': rankByScore(teamStates, 'matchupEnvironmentScore'),
    'rankings.qb_matchups.json': rankMatchupsByAllowedPoints(teamStates, 'QB'),
    'rankings.rb_matchups.json': rankMatchupsByAllowedPoints(teamStates, 'RB'),
    'rankings.wr_matchups.json': rankMatchupsByAllowedPoints(teamStates, 'WR'),
    'rankings.te_matchups.json': rankMatchupsByAllowedPoints(teamStates, 'TE')
  };

  writeJsonFile(path.join(outputDir, 'teamstate_weekly.json'), teamStates);
  for (const [fileName, rows] of Object.entries(rankings)) {
    writeJsonFile(path.join(outputDir, fileName), rows);
  }

  return { teamStates, rankings };
};

if (isDirectExecution(import.meta.url, process.argv[1])) {
  const cwd = process.cwd();
  const rawInputPath = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(cwd, 'data/sample/team_week_raw.sample.json');
  const outputDir = process.argv[3] ? path.resolve(process.argv[3]) : path.resolve(cwd, 'output');
  const result = runTeamStatePipeline(rawInputPath, outputDir);

  // eslint-disable-next-line no-console
  console.log(`Generated ${result.teamStates.length} team states to ${outputDir}`);
}
