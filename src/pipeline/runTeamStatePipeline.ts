import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapRawTeamWeekToTeamStateInput, type RawTeamWeekRow } from '../adapters/mapRawTeamWeekToTeamStateInput.js';
import { validateTeamWeekInputRow } from '../ingest/loadTeamWeekInputs.js';
import { buildLatestWeekReports } from '../reports/buildLatestWeekReports.js';
import { buildSeasonToDateReports } from '../reports/buildSeasonToDateReports.js';
import type { LatestWeekReports, SeasonToDateReports } from '../reports/types.js';
import { buildTeamWeekStates } from '../transform/buildTeamWeekState.js';
import { writeJsonFile } from '../utils/writeJsonFile.js';
import { rankByScore, rankMatchupsByAllowedPoints, type RankingRow } from './rankings.js';

export interface TeamStatePipelineResult {
  teamStates: ReturnType<typeof buildTeamWeekStates>;
  rankings: Record<string, RankingRow[]>;
  latestWeekReports: LatestWeekReports;
  seasonToDateReports: SeasonToDateReports;
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

  const latestWeekReports = buildLatestWeekReports(teamStates);
  const seasonToDateReports = buildSeasonToDateReports(teamStates);

  writeJsonFile(path.join(outputDir, 'teamstate_weekly.json'), teamStates);
  for (const [fileName, rows] of Object.entries(rankings)) {
    writeJsonFile(path.join(outputDir, fileName), rows);
  }

  writeJsonFile(path.join(outputDir, 'latest_week.team_power.json'), latestWeekReports.rows.teamPower);
  writeJsonFile(path.join(outputDir, 'latest_week.fantasy_environment.json'), latestWeekReports.rows.fantasyEnvironment);
  writeJsonFile(path.join(outputDir, 'latest_week.matchup_environment.json'), latestWeekReports.rows.matchupEnvironment);
  writeJsonFile(path.join(outputDir, 'latest_week.qb_matchups.json'), latestWeekReports.rows.qbMatchups);
  writeJsonFile(path.join(outputDir, 'latest_week.rb_matchups.json'), latestWeekReports.rows.rbMatchups);
  writeJsonFile(path.join(outputDir, 'latest_week.wr_matchups.json'), latestWeekReports.rows.wrMatchups);
  writeJsonFile(path.join(outputDir, 'latest_week.te_matchups.json'), latestWeekReports.rows.teMatchups);

  writeJsonFile(path.join(outputDir, 'season_to_date.team_power.json'), seasonToDateReports.rows.teamPower);
  writeJsonFile(path.join(outputDir, 'season_to_date.fantasy_environment.json'), seasonToDateReports.rows.fantasyEnvironment);
  writeJsonFile(path.join(outputDir, 'season_to_date.matchup_environment.json'), seasonToDateReports.rows.matchupEnvironment);
  writeJsonFile(path.join(outputDir, 'season_to_date.qb_offense_environment.json'), seasonToDateReports.rows.qbOffenseEnvironment);
  writeJsonFile(path.join(outputDir, 'season_to_date.rb_offense_environment.json'), seasonToDateReports.rows.rbOffenseEnvironment);
  writeJsonFile(path.join(outputDir, 'season_to_date.wr_offense_environment.json'), seasonToDateReports.rows.wrOffenseEnvironment);
  writeJsonFile(path.join(outputDir, 'season_to_date.te_offense_environment.json'), seasonToDateReports.rows.teOffenseEnvironment);
  writeJsonFile(path.join(outputDir, 'season_to_date.qb_matchups.json'), seasonToDateReports.rows.qbMatchups);
  writeJsonFile(path.join(outputDir, 'season_to_date.rb_matchups.json'), seasonToDateReports.rows.rbMatchups);
  writeJsonFile(path.join(outputDir, 'season_to_date.wr_matchups.json'), seasonToDateReports.rows.wrMatchups);
  writeJsonFile(path.join(outputDir, 'season_to_date.te_matchups.json'), seasonToDateReports.rows.teMatchups);

  return { teamStates, rankings, latestWeekReports, seasonToDateReports };
};

if (isDirectExecution(import.meta.url, process.argv[1])) {
  const cwd = process.cwd();
  const rawInputPath = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(cwd, 'data/sample/team_week_raw.sample.json');
  const outputDir = process.argv[3] ? path.resolve(process.argv[3]) : path.resolve(cwd, 'output');
  const result = runTeamStatePipeline(rawInputPath, outputDir);

  // eslint-disable-next-line no-console
  console.log(`Generated ${result.teamStates.length} team states to ${outputDir}`);
}
