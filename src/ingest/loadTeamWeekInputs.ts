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

  if (!Number.isInteger(row.season) || row.season < 1999) {
    throw new Error(`Invalid season: ${row.season}`);
  }

  if (!Number.isInteger(row.week) || row.week < 1 || row.week > 22) {
    throw new Error(`Invalid week: ${row.week}`);
  }

  if (!row.team.trim() || !row.opponent.trim()) {
    throw new Error('Team and opponent must be non-empty strings.');
  }

  const rateFields: Array<keyof TeamWeekInputRow> = [
    'passRate',
    'neutralPassRate',
    'rushRate',
    'successRate',
    'explosivePlayRate',
    'redZoneTdRate',
    'pressureRateAllowed'
  ];

  for (const field of rateFields) {
    const value = row[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`Invalid rate field ${field}: ${String(value)}`);
    }
  }

  const nonNegativeFields: Array<keyof TeamWeekInputRow> = [
    'pointsFor',
    'pointsAgainst',
    'offensivePlays',
    'neutralPlays',
    'secondsPerPlay',
    'drives',
    'pointsPerDrive',
    'redZoneTrips',
    'sacksAllowed',
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

  for (const field of nonNegativeFields) {
    const value = row[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid non-negative field ${field}: ${String(value)}`);
    }
  }

  if (Math.abs(row.passRate + row.rushRate - 1) > 0.08) {
    throw new Error(`passRate + rushRate must be near 1.0. Received ${row.passRate + row.rushRate}`);
  }

  const optionalSplitFields: Array<keyof TeamWeekInputRow> = [
    'qbPassAllowed',
    'qbRushAllowed',
    'rbRushAllowed',
    'rbRecAllowed',
    'wrSlotAllowed',
    'wrWideAllowed',
    'teInlineAllowed',
    'teSplitAllowed'
  ];

  for (const field of optionalSplitFields) {
    const value = row[field];
    if (value !== undefined && (!Number.isFinite(value) || (value as number) < 0)) {
      throw new Error(`Invalid optional split field ${field}: ${String(value)}`);
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
