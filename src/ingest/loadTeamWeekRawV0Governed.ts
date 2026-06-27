import { readFileSync } from 'node:fs';
import path from 'node:path';
import { adaptTeamWeekRawV0Governed, type TeamWeekRawGovernedConsumption } from '../adapters/teamWeekRawV0GovernedAdapter.js';

/** Read-only governed `team_week_raw_v0` loader. Governance is accepted only from explicit metadata. */
export const loadTeamWeekRawV0Governed = (filePath: string): TeamWeekRawGovernedConsumption => {
  const resolvedPath = path.resolve(filePath);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(resolvedPath, 'utf-8')) as unknown;
  } catch (error) {
    throw new Error(`Invalid JSON in ${resolvedPath}: ${(error as Error).message}`);
  }
  return adaptTeamWeekRawV0Governed(parsed, resolvedPath);
};
