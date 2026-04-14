# TIBER-Teamstate

TIBER-Teamstate is a deterministic TypeScript backend/library scaffold for modeling **team-level NFL environments**. It is designed to answer:

1. Who are the best teams in the NFL and why?
2. Which team environments breed the most fantasy production?
3. Which defenses create favorable or hostile matchup environments by position?

This project intentionally keeps scoring separated across multiple dimensions (no single blended score), so downstream systems can reason about team quality, fantasy ecosystem quality, matchup dynamics, and consistency independently.

## Score Model (Separate Scores)

Every `TeamWeekState` emits 0–100 bounded scores:

- **Team Power Score**: Real-life football strength.
  - Built from EPA/play, success rate, points per drive, explosive rate, red-zone conversion, turnover discipline, and pressure/sack prevention.
- **Fantasy Environment Score**: How strong a team’s own offense is as a fantasy ecosystem.
  - Built from play volume, pace, neutral pass behavior, red-zone opportunity/conversion, explosive rate, and positional fantasy points generated.
- **Matchup Environment Score**: How favorable the defense is for opponents by fantasy position.
  - Built from QB/RB/WR/TE fantasy points allowed plus optional split allowances (slot/wide, inline/split, etc.).
- **Stability Score**: Repeatability and process quality.
  - Favors sustainable indicators and penalizes fragile touchdown dependence.
- **Volatility Score**: Weekly chaos/spike-week dependence.
  - Higher values indicate unstable outcomes and game-script sensitivity.

## Why Team Power vs Fantasy Environment Are Different

- **Team Power** answers “How good is this team at real football outcomes?”
- **Fantasy Environment** answers “How usable is this offense for fantasy production?”

A team can be powerful but slow/low-volume (good Team Power, weaker Fantasy Environment), or mediocre in real-life efficiency but fast/high-volume and fantasy-friendly.

## Matchup Environment Meaning

**Matchup Environment Score** measures defensive friendliness to opposing fantasy positions. A high score means opponents generally find easier QB/RB/WR/TE production conditions. This is intentionally separate from offensive environment and team quality.

## Stability vs Volatility

- **Stability** = repeatable, process-driven outcomes.
- **Volatility** = high-variance outcomes driven by fragile levers (splash plays, TD swings, script shocks).

Both are useful together: a high-upside offense can also be risky week to week.

## Role in TIBER Architecture

This repo is intended to feed future TIBER player-level systems by producing stable, explainable team context inputs (team quality, fantasy ecosystem quality, matchup conditions, risk profile, and environment tags). PR2 can wire real team-week pipelines into this scaffold without refactoring core score logic.

## Project Structure

- `src/types/teamstate.ts` – canonical row and output model types.
- `src/config/weights.ts` – explicit normalization bounds and score weights.
- `src/ingest/loadTeamWeekInputs.ts` – JSON loader + shape validation.
- `src/score/*.ts` – isolated deterministic score functions.
- `src/tags/deriveTeamTags.ts` – threshold-based environment tags.
- `src/explain/buildTeamExplanation.ts` – human-readable rationale.
- `src/transform/buildTeamWeekState.ts` – orchestration pipeline.
- `data/sample/team_week_input.sample.json` – mocked sample team-week rows.
- `tests/teamstate.spec.ts` – deterministic and safety tests.

## Usage

### Install

```bash
npm install
```

### Run tests

```bash
npm test
```

### Type-check / build

```bash
npm run check
npm run build
```

### Run sample transform (Node REPL example)

```ts
import path from 'node:path';
import { loadTeamWeekInputs, buildTeamWeekStates } from 'tiber-teamstate';

const samplePath = path.resolve('data/sample/team_week_input.sample.json');
const rows = loadTeamWeekInputs(samplePath);
const states = buildTeamWeekStates(rows);
console.log(states[0]);
```

## Notes

- No frontend is included.
- No protected or scraped data source dependencies are required.
- Scoring is deterministic TypeScript logic (no ML).
