import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mapRawTeamWeekToTeamStateInput, type RawTeamWeekRow } from '../src/adapters/mapRawTeamWeekToTeamStateInput.js';
import { loadTeamWeekInputs, validateTeamWeekInputRow } from '../src/ingest/loadTeamWeekInputs.js';
import { isDirectExecution, runTeamStatePipeline } from '../src/pipeline/runTeamStatePipeline.js';
import { rankByScore } from '../src/pipeline/rankings.js';
import { buildLatestWeekReports } from '../src/reports/buildLatestWeekReports.js';
import { buildSeasonToDateReports } from '../src/reports/buildSeasonToDateReports.js';
import { buildTeamWeekState, buildTeamWeekStates } from '../src/transform/buildTeamWeekState.js';

const canonicalSamplePath = path.resolve(process.cwd(), 'data/sample/team_week_input.sample.json');
const rawSamplePath = path.resolve(process.cwd(), 'data/sample/team_week_raw.sample.json');

describe('teamstate pipeline', () => {
  it('maps raw team-week rows into canonical rows', () => {
    const rawRows = JSON.parse(readFileSync(rawSamplePath, 'utf-8')) as RawTeamWeekRow[];
    const mappedRows = mapRawTeamWeekToTeamStateInput(rawRows);

    expect(mappedRows).toHaveLength(rawRows.length);
    expect(mappedRows[0].team).toBe(rawRows[0].team_code);
    expect(mappedRows[0].pointsFor).toBe(rawRows[0].points_for);
    expect(mappedRows[2].teInlineAllowed).toBeUndefined();
    expect(mappedRows[3].wrSlotAllowed).toBeUndefined();
  });

  it('transforms sample inputs into valid team states', () => {
    const rows = loadTeamWeekInputs(canonicalSamplePath);
    const states = buildTeamWeekStates(rows);

    expect(states).toHaveLength(rows.length);

    for (const state of states) {
      expect(state.team).toBeTypeOf('string');
      expect(state.explanation.summary.length).toBeGreaterThan(0);
      expect(state.explanation.strengths.length).toBeGreaterThan(0);
      expect(state.explanation.risks.length).toBeGreaterThan(0);
    }
  });

  it('keeps all scores bounded and finite', () => {
    const rows = loadTeamWeekInputs(canonicalSamplePath);
    const states = buildTeamWeekStates(rows);

    for (const state of states) {
      for (const score of Object.values(state.scores)) {
        expect(Number.isFinite(score)).toBe(true);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    }
  });

  it('is deterministic for fixed inputs including tags', () => {
    const rows = loadTeamWeekInputs(canonicalSamplePath);
    const one = buildTeamWeekState(rows[0]);
    const two = buildTeamWeekState(rows[0]);

    expect(two.scores).toEqual(one.scores);
    expect(two.tags).toEqual(one.tags);
    expect(two.explanation).toEqual(one.explanation);
  });

  it('produces deterministic ranking output for fixed rows', () => {
    const rows = loadTeamWeekInputs(canonicalSamplePath);
    const states = buildTeamWeekStates(rows);
    const one = rankByScore(states, 'teamPowerScore');
    const two = rankByScore(states, 'teamPowerScore');

    expect(two).toEqual(one);
  });

  it('keeps explanation tags identical to derived state tags', () => {
    const rows = loadTeamWeekInputs(canonicalSamplePath);
    const state = buildTeamWeekState(rows[2]);

    expect(state.explanation.tags).toEqual(state.tags);
  });

  it('degrades gracefully when optional split fields are missing', () => {
    const [row] = loadTeamWeekInputs(canonicalSamplePath);
    const { qbPassAllowed, qbRushAllowed, rbRushAllowed, rbRecAllowed, wrSlotAllowed, wrWideAllowed, teInlineAllowed, teSplitAllowed, ...withoutSplits } =
      row;

    const state = buildTeamWeekState(withoutSplits);

    expect(state.scores.matchupEnvironmentScore).toBeGreaterThanOrEqual(0);
    expect(state.scores.matchupEnvironmentScore).toBeLessThanOrEqual(100);
    expect(Number.isFinite(state.scores.matchupEnvironmentScore)).toBe(true);
  });

  it('produces no NaN/Infinity values in components', () => {
    const rows = loadTeamWeekInputs(canonicalSamplePath);
    const state = buildTeamWeekState(rows[1]);

    for (const componentGroup of Object.values(state.components)) {
      for (const value of Object.values(componentGroup)) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it('fails fast on invalid rate inputs', () => {
    const [row] = loadTeamWeekInputs(canonicalSamplePath);
    expect(() =>
      validateTeamWeekInputRow({
        ...row,
        neutralPassRate: 1.3
      })
    ).toThrow(/Invalid rate field neutralPassRate/);
  });

  it('detects direct CLI execution using URL/path normalization', () => {
    const cliFilePath = path.resolve(process.cwd(), 'dist/src/pipeline/runTeamStatePipeline.js');
    const metaUrl = pathToFileURL(cliFilePath).href;

    expect(isDirectExecution(metaUrl, cliFilePath)).toBe(true);
    expect(isDirectExecution(metaUrl, path.resolve(process.cwd(), 'dist/src/pipeline/other.js'))).toBe(false);

    const spacedFilePath = path.resolve(process.cwd(), 'tmp folder/runTeamStatePipeline.js');
    const spacedMetaUrl = pathToFileURL(spacedFilePath).href;
    expect(isDirectExecution(spacedMetaUrl, spacedFilePath)).toBe(true);
  });

  it('builds latest-week reports from the latest week per season', () => {
    const states = buildTeamWeekStates(loadTeamWeekInputs(canonicalSamplePath));
    const latest = buildLatestWeekReports(states);

    const latestWeekSet = new Set(Object.values(latest.latestWeekBySeason));

    for (const row of latest.rows.teamPower) {
      expect(latestWeekSet.has(row.week)).toBe(true);
    }

    const one = buildLatestWeekReports(states);
    const two = buildLatestWeekReports(states);
    expect(two.rows.matchupEnvironment).toEqual(one.rows.matchupEnvironment);
  });

  it('builds deterministic season-to-date aggregates and rankings', () => {
    const states = buildTeamWeekStates(loadTeamWeekInputs(canonicalSamplePath));
    const one = buildSeasonToDateReports(states);
    const two = buildSeasonToDateReports(states);

    expect(two.aggregates).toEqual(one.aggregates);
    expect(two.rows.teamPower).toEqual(one.rows.teamPower);
    expect(one.aggregates[0].averages.teamPowerScore).toBeTypeOf('number');
    expect(one.aggregates[0].games).toBeGreaterThan(0);
  });

  it('keeps offense environment outputs separate from defense matchup outputs', () => {
    const states = buildTeamWeekStates(loadTeamWeekInputs(canonicalSamplePath));
    const reports = buildSeasonToDateReports(states);

    expect(reports.rows.qbOffenseEnvironment[0].summary).toContain('offense environment');
    expect(reports.rows.qbMatchups[0].summary).toContain('matchup environment');
    expect(reports.rows.qbOffenseEnvironment[0].position).toBe('QB');
    expect(reports.rows.qbMatchups[0].position).toBe('QB');
  });

  it('runs the pipeline from raw sample input and writes PR2 + PR3 artifacts', () => {
    const outputDir = mkdtempSync(path.join(os.tmpdir(), 'teamstate-output-'));

    const result = runTeamStatePipeline(rawSamplePath, outputDir);

    expect(result.teamStates.length).toBeGreaterThan(0);
    expect(result.latestWeekReports.rows.teamPower.length).toBeGreaterThan(0);
    expect(result.seasonToDateReports.rows.teamPower.length).toBeGreaterThan(0);

    const expectedFiles = [
      'teamstate_weekly.json',
      'rankings.team_power.json',
      'rankings.fantasy_environment.json',
      'rankings.matchup_environment.json',
      'rankings.qb_matchups.json',
      'rankings.rb_matchups.json',
      'rankings.wr_matchups.json',
      'rankings.te_matchups.json',
      'latest_week.team_power.json',
      'latest_week.fantasy_environment.json',
      'latest_week.matchup_environment.json',
      'latest_week.qb_matchups.json',
      'latest_week.rb_matchups.json',
      'latest_week.wr_matchups.json',
      'latest_week.te_matchups.json',
      'season_to_date.team_power.json',
      'season_to_date.fantasy_environment.json',
      'season_to_date.matchup_environment.json',
      'season_to_date.qb_offense_environment.json',
      'season_to_date.rb_offense_environment.json',
      'season_to_date.wr_offense_environment.json',
      'season_to_date.te_offense_environment.json',
      'season_to_date.qb_matchups.json',
      'season_to_date.rb_matchups.json',
      'season_to_date.wr_matchups.json',
      'season_to_date.te_matchups.json'
    ];

    for (const fileName of expectedFiles) {
      expect(existsSync(path.join(outputDir, fileName))).toBe(true);
    }
  });
});
