# Forecast Run 2 — full governed source emission & handoff (Teamstate #72)

**Issue:** TIBER-Teamstate #72 — *re-emit the Forecast Run 2 artifact from the full governed TIBER-Data source.*
**Verdict:** Teamstate now emits the Forecast Run 2 evidence packet from the **full governed TIBER-Data 2024 `team_week_raw_v0` source** (32 teams / 544 played team-game rows), not an excerpt/scaffold. The emitted artifact shows **32/32-team coverage**, preserves governance, played-game grain, bye-week absence, and the upstream null semantics. This closes the downstream source-selection gap that produced the earlier 3-team (BAL/CIN/PHI) Forecast failure.

This is Teamstate-side coverage evidence only. It does **not** run Forecast, evaluate Forecast's gate, change Forecast's gate, modify TIBER-Data, train, score, predict, rank, or emit any fantasy product. The next step is a **Forecast-side gate-evaluation** issue, not a model comparison.

Builds on the existing emitter and its envelope contract: [`teamstate-forecast-run2-artifact-2024.md`](./teamstate-forecast-run2-artifact-2024.md).

## 1. Source-selection proof

The emission consumes the vendored governed mirror of the TIBER-Data governed source:

| Property | Value |
| --- | --- |
| Consumed path (this repo) | `data/governed/team_week_raw_v0_2024_real_source_candidate.json` |
| Mirror manifest | `data/governed/team_week_raw_v0_2024_real_source_candidate.mirror.json` |
| Upstream source (TIBER-Data) | `exports/candidates/team_week_raw/team_week_raw_v0_2024_real_source_candidate.json` |
| Source artifact id | `team_week_raw_v0`, season 2024 |
| Source sha256 (byte-identical mirror) | `2aed00e68c1620af10d2ea4350104f7e183ff6ee050f5d385a503ef027281de9` |
| Source row count / team count | 544 / 32 |
| Governance marker | `governanceStatus: governed`, `governanceSource: explicit_marker`, `provenanceStatus: governed_real_data` |
| Source validation report (upstream) | `exports/candidates/team_week_raw/team_week_raw_v0_2024_real_source_candidate.validation.json` |
| Source lineage manifest (upstream) | `data/manifests/team_week_raw_v0_2024_real_source_candidate.manifest.json` |
| Upstream coverage audit | `exports/candidates/team_week_raw/team_week_raw_v0_2024_teamstate_coverage_audit.json` (TIBER-Data #181 / PR #182) |

The mirror is a **byte-identical, read-only copy**; Teamstate does not re-govern, mutate, or re-derive it. The `export:forecast-run2-full` script and the test suite both recompute the sha256 and assert it equals the value above, so a drifted copy fails closed.

## 2. Full-mode emission

`npm run export:forecast-run2-full` builds three committed artifacts from the governed mirror (full mode — **no** `--excerpt`, no sample fixture):

| Output | Path |
| --- | --- |
| Emitted Forecast Run 2 artifact (golden) | `data/fixtures/team_week_raw_forecast_run2/team_week_raw_v0_2024_forecast_run2.full.json` |
| Teamstate-side coverage evidence | `data/fixtures/team_week_raw_forecast_run2/team_week_raw_v0_2024_forecast_run2.coverage_evidence.json` |
| Mirror provenance manifest | `data/governed/team_week_raw_v0_2024_real_source_candidate.mirror.json` |

The emitted artifact preserves: **32/32 teams**, 2024 input season, **team-week (played-game) grain** before any aggregation, **bye-week absence as expected** (`weeks 1–18`, 17 played games per team, no synthetic bye rows), the Forecast Run 2 cutoff semantics (`forecastCutoff.cutoffBeforeTargetSeason: true`, strictly before 2025-09-01), governance/source/validation/lineage refs, no target-season leakage, and no fantasy-result leakage. `readinessStatus: ready_minimal_boundary`, `teamCount: 32`, `rowCount: 544`.

The emitted artifact is at **team-week grain** (no team-season aggregation is performed here). Input coverage and emitted coverage are therefore the same grain: **544 team-game rows / 32 teams in, 32-team coverage out.** Any later aggregation to team-season features is downstream of this evidence.

## 3. Null-semantics preservation

The upstream null policy is carried through verbatim — no silent zero-fill:

- `pressureRateAllowed`: **deferred / unavailable** — null on all 544 rows, `status: deferred_insufficient_data`, excluded from `forecastInputColumns`. Never invented, imputed, or zero-filled.
- Fantasy split fields (8): **absent / excluded** from Forecast input use (`fantasySplitPosture.status: absent_excluded_from_forecast_use`); not zero-filled.
- `redZoneTdRate`: **partial nulls** — 11 legitimate zero-red-zone-trip rows stay null-aware (533 non-null / 11 null), never converted to 0. Still eligible as a Forecast input column.
- All other 18 offensive-environment columns: **available**, fully non-null across all 544 rows.

**Fields excluded from the Forecast-facing input column set:** `pressureRateAllowed` (deferred) and the 8 fantasy split fields (absent). Forecast must scope its non-null-cell gate to the emitted `forecastInputColumns` and must not require those excluded fields.

## 4. Coverage evidence for the Forecast gate

`…forecast_run2.coverage_evidence.json` (durable, Teamstate-side; Forecast may mirror it against its gate — it does **not** evaluate the gate here):

| Evidence | Value |
| --- | --- |
| input source team count / row count | 32 / 544 |
| present teams / missing teams | all 32 NFL codes / none (`missingTeams: []`) |
| emitted Forecast-facing team count | 32 (team-week grain, 544 pre-aggregation rows) |
| Forecast input columns | 19 (18 fully non-null offensive columns + `redZoneTdRate` null-aware) |
| per-column non-null/null counts | recorded in `nullSemantics.perColumn` (e.g. `epaPerPlay` 544/0; `redZoneTdRate` 533/11; `pressureRateAllowed` 0/544) |
| pressure disposition | `unavailable_insufficient_data_deferred_excluded` |
| fantasy split disposition | `absent_excluded_from_forecast_use` |
| expected team coverage vs. previous failure | `32/32` now vs. `3/32 (BAL, CIN, PHI)` before |
| known blockers | none (`forecastGateProjection.knownBlockers: []`) |

## 5. Regression against the previous failure

`tests/teamWeekRawV0ForecastRun2FullSource.spec.ts` fails if Teamstate regresses to the old shape. It asserts the emitted full-mode artifact:

- has **32 teams** (not 3), present teams equal the full NFL-32 set (not `['BAL','CIN','PHI']`);
- has a `sourceArtifactPath` pointing at the governed mirror, never a path containing `sample`/`excerpt`/`scaffold`;
- has **non-null-dominated** offensive-environment columns (no absent-team null flood);
- preserves deferred pressure, excluded fantasy splits, and the pre-2025 cutoff.

It also proves the **old 3-team shape cannot pass as full-mode output**: filtered to BAL/CIN/PHI under the real 32-team expectation, coverage is invalid and `readinessStatus` is `withheld_invalid_coverage`.

## 6. Handoff back to Forecast

| Handoff element | Value |
| --- | --- |
| Forecast Run 2 artifact (consume this) | `data/fixtures/team_week_raw_forecast_run2/team_week_raw_v0_2024_forecast_run2.full.json` |
| Coverage evidence | `data/fixtures/team_week_raw_forecast_run2/team_week_raw_v0_2024_forecast_run2.coverage_evidence.json` |
| Source governed artifact (mirror) | `data/governed/team_week_raw_v0_2024_real_source_candidate.json` (+ `.mirror.json`) |
| Governance / cutoff refs | `governance` (explicit_marker), `forecastCutoff` (2024 input → 2025 target, `cutoffBeforeTargetSeason: true`) |
| Columns to include in non-null-cell coverage | the emitted `forecastInputColumns` (18 offensive columns + `redZoneTdRate`) |
| Columns to exclude | `pressureRateAllowed` (deferred) and the 8 fantasy split fields (absent) |
| Validation command | `npm test` (see below) |

**Forecast must not rerun Run 2 yet.** The next Forecast-side step is a **gate-evaluation issue only** — mirror this coverage evidence against the Teamstate coverage gate — not a model comparison or Run 2 rerun.

## Verification

```bash
npm run check                  # typecheck
npm run export:forecast-run2-full   # regenerate the golden artifact, evidence, and mirror manifest (deterministic)
npm test                       # full suite incl. tests/teamWeekRawV0ForecastRun2FullSource.spec.ts
```

`export:forecast-run2-full` is byte-stable: re-running it reproduces the committed artifacts identically, and the test suite asserts the committed golden artifact and evidence match a fresh emit and that the mirror sha256 is byte-identical to the vendored source.
