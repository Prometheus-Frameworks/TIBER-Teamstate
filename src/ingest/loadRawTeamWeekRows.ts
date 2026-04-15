import { Dirent, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { RawTeamWeekRow } from '../adapters/mapRawTeamWeekToTeamStateInput.js';

interface LoadedRawRows {
  sourceInputPath: string;
  sourceFiles: string[];
  rows: RawTeamWeekRow[];
}

const REQUIRED_RAW_KEYS: Array<keyof RawTeamWeekRow> = [
  'season',
  'week',
  'team_code',
  'opponent_code',
  'points_for',
  'points_against',
  'offensive_plays',
  'neutral_plays',
  'seconds_per_play',
  'pass_rate',
  'neutral_pass_rate',
  'rush_rate',
  'epa_per_play',
  'pass_epa_per_play',
  'rush_epa_per_play',
  'success_rate',
  'explosive_play_rate',
  'drives',
  'points_per_drive',
  'red_zone_trips',
  'red_zone_td_rate',
  'sacks_allowed',
  'pressure_rate_allowed',
  'turnovers',
  'fantasy_points_for_qb',
  'fantasy_points_for_rb',
  'fantasy_points_for_wr',
  'fantasy_points_for_te',
  'fantasy_points_allowed_qb',
  'fantasy_points_allowed_rb',
  'fantasy_points_allowed_wr',
  'fantasy_points_allowed_te'
];

const readRawRowsFile = (filePath: string): RawTeamWeekRow[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown;
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${(error as Error).message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Invalid raw input shape in ${filePath}: expected an array of raw team-week rows.`);
  }

  for (const [index, row] of parsed.entries()) {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      throw new Error(`Invalid raw row in ${filePath} at index ${index}: expected object.`);
    }

    const candidate = row as Partial<RawTeamWeekRow>;
    for (const key of REQUIRED_RAW_KEYS) {
      if (!(key in candidate)) {
        throw new Error(`Invalid raw row in ${filePath} at index ${index}: missing required key ${key}.`);
      }
    }
  }

  return parsed as RawTeamWeekRow[];
};

const getDirectoryJsonFiles = (dirPath: string): string[] =>
  readdirSync(dirPath, { withFileTypes: true })
    .filter((entry: Dirent) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map((entry) => path.join(dirPath, entry.name))
    .sort((a, b) => a.localeCompare(b));

export const loadRawTeamWeekRows = (inputPath: string): LoadedRawRows => {
  const resolvedInputPath = path.resolve(inputPath);
  const stat = statSync(resolvedInputPath);

  const sourceFiles = stat.isDirectory() ? getDirectoryJsonFiles(resolvedInputPath) : [resolvedInputPath];

  if (sourceFiles.length === 0) {
    throw new Error(`No .json files found in input directory: ${resolvedInputPath}`);
  }

  const rows: RawTeamWeekRow[] = [];
  for (const filePath of sourceFiles) {
    rows.push(...readRawRowsFile(filePath));
  }

  return {
    sourceInputPath: resolvedInputPath,
    sourceFiles,
    rows
  };
};

export type { LoadedRawRows };
