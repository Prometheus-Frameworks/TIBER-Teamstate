import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapRawTeamWeekToTeamStateInput } from '../adapters/mapRawTeamWeekToTeamStateInput.js';
import { loadRawTeamWeekRows } from '../ingest/loadRawTeamWeekRows.js';
import { validateTeamWeekInputRow } from '../ingest/loadTeamWeekInputs.js';
import { buildCurrentSnapshotArtifacts } from './currentArtifacts.js';
import { parsePipelineArgs } from './parsePipelineArgs.js';
import { buildLatestWeekReports } from '../reports/buildLatestWeekReports.js';
import { buildSeasonToDateReports } from '../reports/buildSeasonToDateReports.js';
import type { LatestWeekReports, SeasonToDateReports } from '../reports/types.js';
import type { TeamWeekInputRow } from '../types/teamstate.js';
import { buildTeamWeekStates } from '../transform/buildTeamWeekState.js';
import { writeJsonFile } from '../utils/writeJsonFile.js';
import { rankByScore, rankMatchupsByAllowedPoints, type RankingRow } from './rankings.js';

export interface PipelineFilters {
  season?: number;
  week?: number;
}

export interface PipelineMetadataArtifact {
  generatedAt: string;
  sourceInputPath: string;
  sourceFileCount: number;
  sourceRowCount: number;
  mappedRowCount: number;
  filteredRowCount: number;
  seasonsIncluded: number[];
  latestWeekBySeason: Record<number, number>;
  selectedSeason: number | null;
  selectedWeek: number | null;
}

export interface TeamStatePipelineResult {
  teamStates: ReturnType<typeof buildTeamWeekStates>;
  rankings: Record<string, RankingRow[]>;
  latestWeekReports: LatestWeekReports;
  seasonToDateReports: SeasonToDateReports;
  metadata: PipelineMetadataArtifact;
}

const buildLatestWeekBySeasonFromRows = (rows: TeamWeekInputRow[]): Record<number, number> => {
  const latest: Record<number, number> = {};

  for (const row of rows) {
    const current = latest[row.season];
    if (current === undefined || row.week > current) {
      latest[row.season] = row.week;
    }
  }

  return latest;
};

const applyFilters = (rows: TeamWeekInputRow[], filters: PipelineFilters): TeamWeekInputRow[] =>
  rows.filter((row) => {
    if (filters.season !== undefined && row.season !== filters.season) {
      return false;
    }

    if (filters.week !== undefined && row.week > filters.week) {
      return false;
    }

    return true;
  });

export const isDirectExecution = (metaUrl: string, argvPath: string | undefined): boolean => {
  if (!argvPath) {
    return false;
  }

  const moduleFilePath = path.normalize(path.resolve(fileURLToPath(metaUrl)));
  const entryFilePath = path.normalize(path.resolve(argvPath));

  return moduleFilePath === entryFilePath;
};

export const runTeamStatePipeline = (rawInputPath: string, outputDir: string, filters: PipelineFilters = {}): TeamStatePipelineResult => {
  const loadedRaw = loadRawTeamWeekRows(rawInputPath);
  const mappedRows = mapRawTeamWeekToTeamStateInput(loadedRaw.rows);
  const validatedRows = mappedRows.map(validateTeamWeekInputRow);
  const filteredRows = applyFilters(validatedRows, filters);

  if (filteredRows.length === 0) {
    throw new Error(
      `No rows remain after filters. selectedSeason=${String(filters.season ?? null)} selectedWeek=${String(filters.week ?? null)}`
    );
  }

  const teamStates = buildTeamWeekStates(filteredRows);

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

  const generatedAt = new Date().toISOString();
  const seasonsIncluded = [...new Set(filteredRows.map((row) => row.season))].sort((a, b) => b - a);
  const latestWeekBySeason = buildLatestWeekBySeasonFromRows(filteredRows);
  const metadata: PipelineMetadataArtifact = {
    generatedAt,
    sourceInputPath: loadedRaw.sourceInputPath,
    sourceFileCount: loadedRaw.sourceFiles.length,
    sourceRowCount: loadedRaw.rows.length,
    mappedRowCount: mappedRows.length,
    filteredRowCount: filteredRows.length,
    seasonsIncluded,
    latestWeekBySeason,
    selectedSeason: filters.season ?? null,
    selectedWeek: filters.week ?? null
  };

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

  writeJsonFile(path.join(outputDir, 'pipeline_metadata.json'), metadata);

  const currentArtifacts = buildCurrentSnapshotArtifacts(
    seasonToDateReports,
    generatedAt,
    metadata.selectedSeason,
    metadata.selectedWeek,
    metadata.seasonsIncluded,
    metadata.latestWeekBySeason
  );
  writeJsonFile(path.join(outputDir, 'current_snapshot.json'), currentArtifacts.currentSnapshot);
  writeJsonFile(path.join(outputDir, 'current_offense_environments.json'), currentArtifacts.currentOffenseEnvironments);
  writeJsonFile(path.join(outputDir, 'current_matchup_environments.json'), currentArtifacts.currentMatchupEnvironments);

  return { teamStates, rankings, latestWeekReports, seasonToDateReports, metadata };
};

if (isDirectExecution(import.meta.url, process.argv[1])) {
  const cwd = process.cwd();
  const cliArgs = parsePipelineArgs(process.argv.slice(2), {
    defaultInputPath: path.resolve(cwd, 'data/sample/team_week_raw.sample.json'),
    defaultOutputDir: path.resolve(cwd, 'output')
  });

  const result = runTeamStatePipeline(path.resolve(cliArgs.inputPath), path.resolve(cliArgs.outputDir), {
    season: cliArgs.season ?? undefined,
    week: cliArgs.week ?? undefined
  });

  // eslint-disable-next-line no-console
  console.log(`Generated ${result.teamStates.length} team states to ${path.resolve(cliArgs.outputDir)}`);
}
