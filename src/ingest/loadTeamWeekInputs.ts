import { readFileSync } from 'node:fs';
import type { TeamWeekInputRow } from '../types/teamstate.js';

const REQUIRED_FIELDS: Array<keyof TeamWeekInputRow> = [
  'season',
  'week',
  'team',
  'opponent',
  'pointsFor',
  'pointsAgainst',
  'offensivePlays',
  'neutralPlays',
  'secondsPerPlay',
  'passRate',
  'neutralPassRate',
  'rushRate',
  'epaPerPlay',
  'passEpaPerPlay',
  'rushEpaPerPlay',
  'successRate',
  'explosivePlayRate',
  'drives',
  'pointsPerDrive',
  'redZoneTrips',
  'redZoneTdRate',
  'sacksAllowed',
  'pressureRateAllowed',
  'turnovers',
  'fantasyPointsForQB',
  'fantasyPointsForRB',
  'fantasyPointsForWR',
  'fantasyPointsForTE',
  'fantasyPointsAllowedQB',
  'fantasyPointsAllowedRB',
  'fantasyPointsAllowedWR',
  'fantasyPointsAllowedTE'
];

export const validateTeamWeekInputRow = (row: TeamWeekInputRow): TeamWeekInputRow => {
  for (const field of REQUIRED_FIELDS) {
    const value = row[field];
    if (value === undefined || value === null) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  return row;
};

export const loadTeamWeekInputs = (filePath: string): TeamWeekInputRow[] => {
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as TeamWeekInputRow[];

  if (!Array.isArray(parsed)) {
    throw new Error('Expected an array of team-week rows in input JSON.');
  }

  return parsed.map(validateTeamWeekInputRow);
};
