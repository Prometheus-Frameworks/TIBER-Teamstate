# Teamstate Governed Forecast Run 2 Artifact (2024 cutoff)

This is the upstream **evidence packet** that TIBER-Forecast's value-binding readiness gate
(Forecast #81) waits for before it is allowed to bind real Teamstate values into the Run 2 candidate
matrix. It is emitted by `buildTeamWeekRawV0ForecastRun2Artifact` /
`buildTeamWeekRawV0ForecastRun2ArtifactFile` (`src/governed/teamWeekRawV0ForecastRun2Artifact.ts`).

It is **Teamstate-owned and Forecast-consumable**, read-only, and report-oriented. It does **not**
train, evaluate, score, predict, rank, run Forecast Run 2, bind values into Forecast rows, construct
or impute pressure, or emit any fantasy product. It is a superset of the governed readiness boundary
(`team_week_raw_v0_governed_readiness`, see
[`teamstate-governed-consumption-team-week-raw-v0-2024.md`](./teamstate-governed-consumption-team-week-raw-v0-2024.md)):
the readiness fields are kept byte-identical so Forecast's existing input boundary keeps accepting the
artifact, while a recorded `forecastCutoff` and explicit join posture are added on top.

## What the artifact proves (machine-readable)

| Requirement | Field(s) |
| --- | --- |
| Governed by explicit marker | `governance.governanceStatus: "governed"`, `governance.governanceSource: "explicit_marker"`, `teamstateGovernedArtifact: true`, `forecastRun2Artifact: true` |
| Sourced from governed upstream data | `provenanceStatus: "governed_real_data"` |
| Source / validation / lineage refs | `sourceArtifacts`, `validationReportPath`, `lineageManifestPath` |
| Recorded forecast cutoff = 2024 input season | `forecastCutoff.inputSeason: 2024`, `forecastCutoff.asOf` |
| Safe for 2024-input → 2025-target Run 2 | `forecastCutoff.targetSeason: 2025`, `forecastCutoff.cutoffBeforeTargetSeason: true`, `forecastCutoff.safeFor` |
| Team-week grain + player-season join posture | `rowGrain: "team_week"`, `downstreamBinding` (`teamWeekGrainKeys`, `joinKeysRequired`, `fieldMapping`) |
| Row / team / week coverage | `rowCount`, `teamCount`, `weekCoverage` |
| Field readiness preserved | `availableFields`, `partialNullFields`, `deferredInsufficientFields`, `fieldReadiness`, `forecastInputColumns` |
| Pressure unavailable/deferred/excluded | `pressurePosture`, `pressureForecastPosture`, `pressureRateAllowed` deferred-null (no numeric pressure feature) |
| Fantasy split absent/excluded | `fantasySplitPosture` |
| Partial-null honesty | `partialNullFields` carried null-aware (never zero-filled) |
| No target/future/leakage inputs | `targetLeakageStatus` |

Governance is **never** inferred from file path, file name, validation success, build success, or
downstream demand — explicit upstream markers only. A non-2024 governed source or a missing recorded
as-of fails closed (no artifact emitted).

## Teamstate ↔ Forecast field-name mapping

Teamstate's team-week grain keys are documented under their Forecast-side names so neither repo has to
rename anything. The mapping is also machine-readable in `downstreamBinding.fieldMapping`.

| Teamstate field | Forecast field | Note |
| --- | --- | --- |
| `season` | `input_season` | Teamstate input season → Forecast input season. |
| `teamCode` | `player_input_season_team (team_2024)` | Teamstate team code → the player's input-season team. |
| `week` | _(aggregated away)_ | Team-week rows aggregate to team-season before player-season binding; week is not a Forecast join key. |

Forecast's value-binding readiness gate reads the recorded cutoff from `forecastCutoff.inputSeason` /
`forecastCutoff.asOf` and the governance/readiness fields from the shared readiness shape. With this
artifact all twelve of its gates are satisfied (`ready_for_value_binding`).

## Sample export

A committed sample emitted from the small governed excerpt fixture lives at
`data/fixtures/team_week_raw_forecast_run2/team_week_raw_v0_2024_forecast_run2.sample.json`. It is an
**excerpt-scale demonstration** (4 governed rows) generated with
`EXCERPT_GOVERNED_COVERAGE_EXPECTATION`; production emission over the real 544-row governed source uses
`REAL_2024_CANDIDATE_COVERAGE_EXPECTATION`.

## CLI

After building:

```bash
# real 2024 544-row coverage expectation
npm run artifact:forecast-run2 -- <path-to-governed-team_week_raw_v0.json>

# excerpt-scale committed sample
npm run artifact:forecast-run2 -- data/fixtures/team_week_raw_governed/team_week_raw_v0_2024_governed.sample.json --excerpt
```

The CLI prints the artifact as JSON and exits non-zero unless `readinessStatus` is
`ready_minimal_boundary`.
