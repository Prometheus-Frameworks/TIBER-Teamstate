# TIBER-Teamstate

TIBER-Teamstate is a deterministic TypeScript backend/library for modeling **team-level NFL environments** from team-week source data.

PR2 moves the repo from mock-only transforms to a **real-data adapter + pipeline workflow**:

- ingest raw source rows (`snake_case` vendor-style inputs)
- map into canonical `TeamWeekInputRow`
- validate rows deterministically
- build `TeamWeekState[]`
- rank teams across core score dimensions and positional matchup environments
- export machine-friendly JSON artifacts

## Score Model (Separate Scores)

Every `TeamWeekState` emits 0–100 bounded scores:

- **Team Power Score**: Real-life football strength.
- **Fantasy Environment Score**: Strength of a team's own fantasy ecosystem.
- **Matchup Environment Score**: Defensive friendliness for opponent fantasy positions.
- **Stability Score**: Repeatability/process quality.
- **Volatility Score**: Weekly variance/spike dependence.

The architecture intentionally keeps these scores separate (no blended single score).

## Project Structure

- `src/types/teamstate.ts` – canonical row/output types.
- `src/adapters/mapRawTeamWeekToTeamStateInput.ts` – raw source to canonical mapping adapter.
- `src/ingest/loadTeamWeekInputs.ts` – canonical row validation.
- `src/transform/buildTeamWeekState.ts` – state generation.
- `src/pipeline/rankings.ts` – ranking helpers for score and positional matchup outputs.
- `src/pipeline/runTeamStatePipeline.ts` – end-to-end pipeline runner + artifact writer.
- `src/utils/writeJsonFile.ts` – stable JSON output utility.
- `data/sample/team_week_raw.sample.json` – raw sample source input for the pipeline.
- `output/*.json` – generated pipeline artifacts.

## Raw Input Format

The PR2 pipeline expects an array of raw source rows with explicit source field names (example keys):

- Identity/context: `season`, `week`, `team_code`, `opponent_code`
- Team production: `points_for`, `offensive_plays`, `neutral_plays`, `seconds_per_play`
- Efficiency/profile: `epa_per_play`, `pass_epa_per_play`, `success_rate`, `explosive_play_rate`
- Drive/red-zone/pressure: `points_per_drive`, `red_zone_trips`, `red_zone_td_rate`, `pressure_rate_allowed`
- Fantasy for/allowed: `fantasy_points_for_qb` ... `fantasy_points_allowed_te`
- Optional split fields: `qb_pass_allowed`, `wr_slot_allowed`, `te_inline_allowed`, etc.

Adapter assumptions:

- required core fields are mapped directly and must be present
- optional split fields are safely omitted when missing or non-numeric
- vendor-specific naming is isolated to adapter code, not scoring logic

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

### Run PR2 pipeline

```bash
npm run pipeline
```

Optional direct invocation with paths:

```bash
node dist/src/pipeline/runTeamStatePipeline.js <raw-input-path> <output-dir>
```

Defaults:

- raw input: `data/sample/team_week_raw.sample.json`
- output directory: `output/`

## Output Artifacts

Pipeline output files:

- `output/teamstate_weekly.json`
- `output/rankings.team_power.json`
- `output/rankings.fantasy_environment.json`
- `output/rankings.matchup_environment.json`
- `output/rankings.qb_matchups.json`
- `output/rankings.rb_matchups.json`
- `output/rankings.wr_matchups.json`
- `output/rankings.te_matchups.json`

Each ranking row includes:

- `team`
- `season`
- `week`
- `score`
- `rank`
- `tags`
- `summary`

## Notes

- No frontend/UI work is included.
- No ML models are used.
- No scraping dependencies on protected third-party sites are introduced.
- Pipeline behavior is deterministic for fixed input rows.
