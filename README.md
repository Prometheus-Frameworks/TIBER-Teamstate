# TIBER-Teamstate

TIBER-Teamstate is a deterministic TypeScript backend/library for modeling **team-level NFL environments** from governed inputs. It is an interpretation layer, not the owner of raw source truth.

PR4 extends the PR3 reporting layer with downstream-ready ingestion and contract artifacts:

- flexible raw input loading (`file` or `directory` of `.json` files)
- optional season/week filtering during pipeline runs
- explicit pipeline metadata artifact (`pipeline_metadata.json`)
- compact current-state contract artifacts (`current_*.json`) for downstream repos

## May TIBER-Data Alignment: Team-Environment Interpretation Layer

After the May TIBER-Data milestone, Teamstate is the **team-environment interpretation layer** in the TIBER ecosystem. Teamstate should consume governed, source-backed TIBER-Data artifacts and translate them into auditable team context. It should not own raw source truth, copy evidence values by hand, or fabricate derived football context when upstream provenance is not present.

System boundary:

- **TIBER-Data proves what happened**: governed source/provenance truth for source-backed GOBLIN evidence, GOBLIN research candidates, play-caller PROE scaffolds/input validation, and Receiving Role Integrity / route participation proxy scaffolds.
- **Teamstate explains team environment**: pace, pass tendency, play-calling environment, red-zone tendency, stability, volatility, and other team-level context once those inputs are governed upstream.
- **Role-and-opportunity explains player role**: player-level usage, role, and opportunity context.
- **GOBLIN finds ugly-output legitimate-signal candidates**: candidate discovery and evidence spine, not default Teamstate scoring.
- **FORGE grades fantasy signal**: fantasy-specific signal grading.
- **TIBER-Fantasy becomes the cockpit**: the operating surface that can assemble governed signals from the ecosystem.

Future Teamstate inputs from TIBER-Data should include:

- play-caller PROE, once source-backed
- team pass tendency
- pass-play environment
- red-zone tendencies
- Receiving Role Integrity proxy aggregates, once source-backed
- GOBLIN candidate context as read-only signal, not a scoring input by default

Guardrails for this repository:

- do not fabricate team tendencies
- do not copy values out of screenshots
- do not make proprietary route claims
- do not mutate TIBER-Data artifacts
- do not change scoring or ranking behavior as part of this docs-only alignment

See `docs/teamstate-boundary-may-tiber-data.md` for the detailed boundary note.

## Teamstate Offensive Environment v0 (2026)

This repository now includes a lightweight Teamstate offensive environment seed artifact for post-draft rookie landing-spot translation.

- Artifact: `data/processed/2026_team_offensive_environment_v0.json`
- Documentation: `docs/teamstate-offensive-environment-v0.md`
- Validator: `scripts/validate_team_offensive_environment.py`
- Test: `tests/test_team_offensive_environment.py`

Design doctrine for v0:

- Teamstate does not grade the rookie.
- Teamstate grades the offensive environment the rookie joined.
- Labels are intentionally conservative while public-source validation is pending.
- `source_status` distinguishes `operator_seeded` versus validated public-data rows.

Initial seed priority includes New Orleans (`NO`) with an operator-seeded `offensive_playcaller` value of `Kellen Moore` and context tags supporting Jordyn Tyson translation experiments.

Run validator:

```bash
python scripts/validate_team_offensive_environment.py
```

Run Python tests:

```bash
python -m unittest tests/test_team_offensive_environment.py
```

## Score Model (Separate Scores)

Every `TeamWeekState` emits 0–100 bounded scores:

- **Team Power Score**: Real-life football strength.
- **Fantasy Environment Score**: Strength of a team's own fantasy ecosystem.
- **Matchup Environment Score**: Defensive friendliness for opponent fantasy positions.
- **Stability Score**: Repeatability/process quality.
- **Volatility Score**: Weekly variance/spike dependence.

The architecture intentionally keeps these scores separate (no blended single score).

## Project Structure

- `src/ingest/loadRawTeamWeekRows.ts` – flexible raw file/directory loader + deterministic merge order.
- `src/adapters/mapRawTeamWeekToTeamStateInput.ts` – raw source to canonical mapping adapter.
- `src/ingest/loadTeamWeekInputs.ts` – canonical row validation.
- `src/transform/buildTeamWeekState.ts` – weekly state generation.
- `src/reports/buildLatestWeekReports.ts` – latest-week report builders.
- `src/reports/buildSeasonToDateReports.ts` – season aggregate + ranking builders.
- `src/pipeline/runTeamStatePipeline.ts` – end-to-end orchestration + artifact writing.
- `src/contracts/currentSnapshot.ts` – explicit row contracts for downstream snapshot artifacts.

## Raw Input Ingestion (PR4)

The pipeline accepts:

1. a **single raw json file** containing an array of raw rows
2. a **directory of raw json files** (`*.json` only, merged in stable sorted filename order)

Behavior:

- directory ingestion reads files with deterministic `localeCompare` sort
- all rows are merged into one array before mapping/validation
- invalid JSON or invalid top-level shape fails with a clear file-specific error

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

### Run pipeline (defaults)

```bash
npm run pipeline
```

Defaults:

- input: `data/sample/team_week_raw.sample.json`
- output: `output/`

### Run pipeline with flags

```bash
npm run pipeline -- --input data/sample/team_week_raw.sample.json --output output
npm run pipeline -- --input data/raw --season 2025 --week 8
```

### Positional invocation still works

```bash
node dist/src/pipeline/runTeamStatePipeline.js <raw-input-path> <output-dir>
```

## Filtering (PR4)

Optional filters:

- `--season 2025` → include only rows for season `2025`
- `--week 8` → include only rows with `week <= 8` within the selected data
- `--season 2025 --week 8` → season-specific cutoff

Filtering is applied **before** state build and report generation.

## Output Artifacts

### Existing detailed artifacts

- `teamstate_weekly.json`
- `rankings.*.json`
- `latest_week.*.json`
- `season_to_date.*.json`

### New metadata artifact (PR4)

`output/pipeline_metadata.json` includes:

- `generatedAt`
- `sourceInputPath`
- `sourceFileCount`
- `sourceRowCount`
- `mappedRowCount`
- `filteredRowCount`
- `seasonsIncluded`
- `latestWeekBySeason`
- `selectedSeason` (nullable)
- `selectedWeek` (nullable)

### New current snapshot contract artifacts (PR4)

- `output/current_snapshot.json`
  - top team power/fantasy/matchup slices
  - volatility + stability summaries
  - explicit scope block (`selectedSeason`, `selectedWeek`, `seasonsIncluded`, `latestWeekBySeason`)
- `output/current_offense_environments.json`
  - compact QB/RB/WR/TE current offense environment rows
- `output/current_matchup_environments.json`
  - compact QB/RB/WR/TE current matchup environment rows

All snapshot artifacts use concise row shapes:

- `team`
- `season`
- `latestWeek`
- `score`
- `rank`
- `tags`
- `summary`

## Recommended downstream consumption pattern

1. run Teamstate with your chosen ingest input and optional filters
2. consume `pipeline_metadata.json` first to understand slice + provenance
3. consume `current_snapshot.json` for quick global context
4. consume positional current artifacts for role-specific downstream logic
5. optionally fall back to detailed `latest_week.*` / `season_to_date.*` for deeper diagnostics

## Notes

- No frontend/UI work is included.
- No ML models are used.
- No scraping dependencies on protected third-party sites are introduced.
- Pipeline behavior is deterministic for fixed input rows.
