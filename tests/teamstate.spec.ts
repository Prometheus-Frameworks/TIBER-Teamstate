import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadTeamWeekInputs, validateTeamWeekInputRow } from '../src/ingest/loadTeamWeekInputs.js';
import { buildTeamWeekState, buildTeamWeekStates } from '../src/transform/buildTeamWeekState.js';

const samplePath = path.resolve(process.cwd(), 'data/sample/team_week_input.sample.json');

describe('teamstate pipeline', () => {
  it('transforms sample inputs into valid team states', () => {
    const rows = loadTeamWeekInputs(samplePath);
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
    const rows = loadTeamWeekInputs(samplePath);
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
    const rows = loadTeamWeekInputs(samplePath);
    const one = buildTeamWeekState(rows[0]);
    const two = buildTeamWeekState(rows[0]);

    expect(two.scores).toEqual(one.scores);
    expect(two.tags).toEqual(one.tags);
    expect(two.explanation).toEqual(one.explanation);
  });

  it('keeps explanation tags identical to derived state tags', () => {
    const rows = loadTeamWeekInputs(samplePath);
    const state = buildTeamWeekState(rows[2]);

    expect(state.explanation.tags).toEqual(state.tags);
  });

  it('degrades gracefully when optional split fields are missing', () => {
    const [row] = loadTeamWeekInputs(samplePath);
    const { qbPassAllowed, qbRushAllowed, rbRushAllowed, rbRecAllowed, wrSlotAllowed, wrWideAllowed, teInlineAllowed, teSplitAllowed, ...withoutSplits } = row;

    const state = buildTeamWeekState(withoutSplits);

    expect(state.scores.matchupEnvironmentScore).toBeGreaterThanOrEqual(0);
    expect(state.scores.matchupEnvironmentScore).toBeLessThanOrEqual(100);
    expect(Number.isFinite(state.scores.matchupEnvironmentScore)).toBe(true);
  });

  it('produces no NaN/Infinity values in components', () => {
    const rows = loadTeamWeekInputs(samplePath);
    const state = buildTeamWeekState(rows[1]);

    for (const componentGroup of Object.values(state.components)) {
      for (const value of Object.values(componentGroup)) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it('fails fast on invalid rate inputs', () => {
    const [row] = loadTeamWeekInputs(samplePath);
    expect(() =>
      validateTeamWeekInputRow({
        ...row,
        neutralPassRate: 1.3
      })
    ).toThrow(/Invalid rate field neutralPassRate/);
  });
});
