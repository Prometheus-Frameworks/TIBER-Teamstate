import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  adaptTeamWeekRawV0Candidate,
  type TeamWeekRawCandidateConsumption
} from '../adapters/teamWeekRawV0CandidateAdapter.js';

/**
 * Reads a single `team_week_raw_v0` candidate artifact file (e.g. a TIBER-Data
 * `*_real_source_candidate.json` export) and adapts it via `adaptTeamWeekRawV0Candidate`.
 *
 * This loader is read-only: it never writes to, nor mutates, the source file, and it never infers
 * provenance or governance status from `filePath` — only from the artifact's own `metadata` block.
 */
export const loadTeamWeekRawV0Candidate = (filePath: string): TeamWeekRawCandidateConsumption => {
  const resolvedPath = path.resolve(filePath);

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(resolvedPath, 'utf-8')) as unknown;
  } catch (error) {
    throw new Error(`Invalid JSON in ${resolvedPath}: ${(error as Error).message}`);
  }

  return adaptTeamWeekRawV0Candidate(parsed, resolvedPath);
};
