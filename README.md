# TIBER-Teamstate

TIBER-Teamstate is a deterministic TypeScript backend/library for modeling **team-level NFL environments** from team-week source data.

PR3 extends the PR2 ingest/adapter pipeline into a richer reporting layer that is directly useful for downstream TIBER engines:

- latest-week rankings ("what looks best right now?")
- season-to-date aggregated rankings ("what has held up across the season?")
- offense environment rankings by position (QB/RB/WR/TE)
- defense matchup rankings by position (kept separate from offense environment)

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
- `src/transform/buildTeamWeekState.ts` – weekly state generation.
- `src/pipeline/rankings.ts` – base weekly ranking helpers.
- `src/reports/types.ts` – report row and aggregate types.
- `src/reports/buildLatestWeekReports.ts` – latest-week report builders.
- `src/reports/buildSeasonToDateReports.ts` – season aggregate + ranking builders.
- `src/reports/positionalEnvironment.ts` – offense/defense positional ranking builders.
- `src/pipeline/runTeamStatePipeline.ts` – end-to-end pipeline runner + artifact writer.
- `src/utils/writeJsonFile.ts` – stable JSON output utility.

## Raw Input Format

The pipeline expects an array of raw source rows with explicit source field names (example keys):

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

### Run pipeline

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

## Aggregation Logic (PR3)

Season-to-date aggregation is deterministic and grouped by `team + season`.

For each team-season bucket:

- `latestWeek` = max week observed for that team-season
- `games` = number of rows observed
- score averages:
  - average Team Power Score
  - average Fantasy Environment Score
  - average Matchup Environment Score
  - average Stability Score
  - average Volatility Score
- input summary averages:
  - offensive plays
  - neutral pass rate
  - red-zone trips
  - red-zone TD rate
  - fantasy points for QB/RB/WR/TE
  - fantasy points allowed to QB/RB/WR/TE

All ranking sorts use explicit deterministic tie-breaking (`score`, then `season`, `latestWeek/week`, then `team`).

## Offense vs Defense Positional Reports

PR3 intentionally keeps two distinct positional report families:

### Offensive position environment (team's own ecosystem)

- `*_offense_environment` outputs answer: "which offenses are best for this position?"
- built from transparent weighted combinations of existing offensive inputs
- examples:
  - QB offense: fantasy points for QB + pass environment + pace + overall team quality
  - RB offense: fantasy points for RB + red-zone volume/efficiency + fantasy ecosystem quality
  - WR offense: fantasy points for WR + pass environment + pace + explosiveness/team quality
  - TE offense: fantasy points for TE + red-zone efficiency + pass environment + stability

### Defensive positional matchups (opponent environment)

- `*_matchups` outputs answer: "which defenses are best/worst matchups for this position?"
- built from fantasy points allowed by position
- kept separate from offense environment outputs to avoid blending concepts

## Output Artifacts

Weekly state output:

- `output/teamstate_weekly.json`

PR2 weekly ranking outputs:

- `output/rankings.team_power.json`
- `output/rankings.fantasy_environment.json`
- `output/rankings.matchup_environment.json`
- `output/rankings.qb_matchups.json`
- `output/rankings.rb_matchups.json`
- `output/rankings.wr_matchups.json`
- `output/rankings.te_matchups.json`

PR3 latest-week outputs:

- `output/latest_week.team_power.json`
- `output/latest_week.fantasy_environment.json`
- `output/latest_week.matchup_environment.json`
- `output/latest_week.qb_matchups.json`
- `output/latest_week.rb_matchups.json`
- `output/latest_week.wr_matchups.json`
- `output/latest_week.te_matchups.json`

PR3 season-to-date outputs:

- `output/season_to_date.team_power.json`
- `output/season_to_date.fantasy_environment.json`
- `output/season_to_date.matchup_environment.json`
- `output/season_to_date.qb_offense_environment.json`
- `output/season_to_date.rb_offense_environment.json`
- `output/season_to_date.wr_offense_environment.json`
- `output/season_to_date.te_offense_environment.json`
- `output/season_to_date.qb_matchups.json`
- `output/season_to_date.rb_matchups.json`
- `output/season_to_date.wr_matchups.json`
- `output/season_to_date.te_matchups.json`

Each ranking row is machine-friendly and includes:

- `team`
- `season`
- `week` or `latestWeek` (depending on report)
- `score`
- `rank`
- `tags`
- `summary`

## Downstream Consumption Notes

Downstream TIBER repos can treat Teamstate as a deterministic report producer:

1. Run pipeline to produce fresh artifacts from your adapter input.
2. Use `latest_week.*` for current-week recommendations.
3. Use `season_to_date.*` for regime-level priors and baseline confidence.
4. Combine offense environment files with matchup files in downstream logic only when needed (Teamstate keeps them separate by design).

## Notes

- No frontend/UI work is included.
- No ML models are used.
- No scraping dependencies on protected third-party sites are introduced.
- Pipeline behavior is deterministic for fixed input rows.
