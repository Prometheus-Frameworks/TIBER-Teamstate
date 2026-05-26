# Team Environment Profile V0 Provenance & Coverage Audit (2026-05-26)

## Scope

This is a provenance/coverage verification for `output/team_environment_profiles_v0.json` only. No scoring logic or pipeline logic was changed.

## 1) Artifact coverage: `output/team_environment_profiles_v0.json`

- **artifact**: `team_environment_profiles_v0`
- **generatedAt**: `2026-05-25T16:51:57.542Z`
- **sourceArtifacts**:
  - `season_to_date.fantasy_environment.json`
  - `season_to_date.team_power.json`
  - `teamstate_weekly.json`
- **profile count**: `4`
- **team list**: `DET`, `MIA`, `PIT`, `TEN`
- **seasons represented**: `2025`
- **all 32 NFL teams present?** `No`
- **missing NFL teams (28)**:
  - `ARI`, `ATL`, `BAL`, `BUF`, `CAR`, `CHI`, `CIN`, `CLE`, `DAL`, `DEN`, `GB`, `HOU`, `IND`, `JAX`, `KC`, `LV`, `LAC`, `LAR`, `MIN`, `NE`, `NO`, `NYG`, `NYJ`, `PHI`, `SEA`, `SF`, `TB`, `WAS`

## 2) Source artifact coverage

### `output/season_to_date.fantasy_environment.json`

- row count: `4`
- team count: `4` (`DET`, `MIA`, `PIT`, `TEN`)
- seasons represented: `2025`
- latestWeek values represented: `8` (row-level `latestWeek`)
- games per team: all listed teams show `games: 1`
- classification: **partial** (not full league)

### `output/season_to_date.team_power.json`

- row count: `4`
- team count: `4` (`DET`, `MIA`, `PIT`, `TEN`)
- seasons represented: `2025`
- latestWeek values represented: `8` (row-level `latestWeek`)
- games per team: all listed teams show `games: 1`
- classification: **partial** (not full league)

### `output/teamstate_weekly.json`

- row count: `4`
- team count: `4` (`DET`, `MIA`, `PIT`, `TEN`)
- seasons represented: `2025`
- weeks represented: `8`
- latestWeek (derived from rows): `8`
- games per team: effectively one weekly row per listed team in this artifact slice
- classification: **partial** (not full league)

## 3) Real-data status (provenance determination)

### What the repo proves

- The default pipeline input path is `data/sample/team_week_raw.sample.json`.
- The current outputs are fully consistent with a tiny sample run (4 teams, one week, one game each).
- Repo docs repeatedly position Teamstate as an interpretation layer that should consume governed upstream data, and explicitly discuss seed/scaffold context in related artifacts.

### What the repo does **not** prove

- There is no embedded provenance evidence in these three source artifacts that proves they were generated from full real 2025 league inputs.
- There is no all-32-team coverage in the outputs.
- There is no separate raw-input provenance bundle in `output/` tying this run to a governed, league-complete 2025 dataset.

### Determination

Current values should be treated as **fixture/sample or scaffold-level output** for contract validation, **not proven real full-league 2025 truth**.

## 4) Conservative safety label

**Assigned label: `fixture_scaffold`**

Rationale:

- 4/32 team coverage.
- Single observed week (`8`) and one game per represented team.
- Provenance does not establish league-complete, governed real-data sourcing for this artifact snapshot.

## 5) Recommendation (lowest-risk next step)

1. **Keep as scaffold only** for downstream inspection/contract wiring right now.
2. **Add source metadata** to this artifact (or adjacent artifact) that records:
   - exact input path(s)
   - row counts before/after filtering
   - team-count and season/week coverage summary
   - explicit provenance status (`sample`, `fixture`, `governed_real_data`, etc.)
3. **Expand to all 32 teams** only after governed raw team inputs are available.
4. **Add TIBER-Data-owned raw team inputs** as the source-of-truth lane before calling it production truth.
5. **Add standalone UI inspection** only after coverage/provenance are clear to avoid false confidence.

## Downstream use guidance right now

Safe today:

- Contract-shape integration tests.
- Read-only inspection in TIBER-Fantasy with visible “scaffold/partial” labeling.

Not safe today:

- Treating this artifact as production league truth for roster or decision automation.

## Validation note

Docs-only change. No runtime behavior or scoring behavior changed.
