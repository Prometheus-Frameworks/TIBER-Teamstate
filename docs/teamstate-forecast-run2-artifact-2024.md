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
| Safe for 2024-input → 2025-target Run 2 | `forecastCutoff.targetSeason: 2025`, `forecastCutoff.targetSeasonStart`, `forecastCutoff.cutoffBeforeTargetSeason` (computed), `forecastCutoff.safeFor` |
| Team-week grain + player-season join posture | `rowGrain: "team_week"`, `downstreamBinding` (`teamWeekGrainKeys`, `joinKeysRequired`, `fieldMapping`) |
| Row / team / week coverage | `rowCount`, `teamCount`, `weekCoverage` |
| Field readiness preserved | `availableFields`, `partialNullFields`, `deferredInsufficientFields`, `fieldReadiness`, `forecastInputColumns` |
| Pressure unavailable/deferred/excluded | `pressurePosture`, `pressureForecastPosture`, `pressureRateAllowed` deferred-null (no numeric pressure feature) |
| Fantasy split absent/excluded | `fantasySplitPosture` |
| Partial-null honesty | `partialNullFields` carried null-aware (never zero-filled) |
| No target/future/leakage inputs | `targetLeakageStatus` |

Governance is **never** inferred from file path, file name, validation success, build success, or
downstream demand — explicit upstream markers only. A non-2024 governed source fails closed (no
artifact emitted).

## Forecast cutoff as-of vs. source generated time

The artifact records two distinct timestamps, and they must not be conflated:

- **`forecastCutoff.asOf`** — the *forecast cutoff* the artifact claims: the pre-target-season time
  boundary beyond which no information may inform the 2024-input → 2025-target Run 2 setup. It is
  validated to be a parseable, **timezone-explicit** timestamp **strictly before
  `forecastCutoff.targetSeasonStart`** (`FORECAST_RUN2_TARGET_SEASON_START` = `2025-09-01T00:00:00.000Z`,
  the start of the 2025 target season). `forecastCutoff.cutoffBeforeTargetSeason` is **computed from
  this validation**, never hardcoded.
- **`forecastCutoff.sourceGeneratedAt`** — the source/export *build* timestamp (the governed source's
  `generatedAt`), recorded for provenance only. It is **never** used as the semantic cutoff. The
  committed sample illustrates the distinction: its `sourceGeneratedAt` is `2026-06-25` (a post-target
  build time) while its `asOf` is a real pre-target cutoff.

The cutoff as-of must be supplied explicitly by the caller (`options.asOf`); the builder never defaults
it to the source's build time. Callers may pass the canonical `FORECAST_RUN2_DEFAULT_CUTOFF_AS_OF`
(`2025-03-01T00:00:00.000Z`, after the 2024 season concludes and before the 2025 target season). A
**missing, empty, malformed, timezone-ambiguous, target-season, or future-looking** as-of **fails
closed** (no artifact emitted), as does a non-2024 governed source.

### The cutoff as-of must be timezone-explicit

Because the as-of is a leakage boundary, it must denote a deterministic instant rather than depend on
the process-local timezone. The emitter parses it through `parseTimezoneExplicitAsOf(...)`, which
**rejects offset-less strings** (an offset-less value like `2025-09-01T00:00:00` would otherwise be
read in local time and could slip a target-boundary string past the pre-target guard in a
positive-offset environment).

- **Valid (timezone-explicit):** `2025-03-01T00:00:00.000Z`, `2025-03-01T00:00:00+00:00`,
  `2025-03-01T00:00:00-05:00`.
- **Invalid (timezone-ambiguous, fails closed):** `2025-03-01T00:00:00`, `2025-09-01T00:00:00`,
  `2025-03-01` (date-only).

Comparison against the target-season boundary is therefore deterministic and identical regardless of
the host timezone.

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
# real 2024 544-row coverage expectation (as-of defaults to FORECAST_RUN2_DEFAULT_CUTOFF_AS_OF)
npm run artifact:forecast-run2 -- <path-to-governed-team_week_raw_v0.json>

# excerpt-scale committed sample
npm run artifact:forecast-run2 -- data/fixtures/team_week_raw_governed/team_week_raw_v0_2024_governed.sample.json --excerpt

# supply an explicit pre-target cutoff as-of
npm run artifact:forecast-run2 -- <path-to-governed-team_week_raw_v0.json> --as-of 2025-01-15T00:00:00.000Z
```

The `--as-of` flag sets `forecastCutoff.asOf`; it defaults to the canonical
`FORECAST_RUN2_DEFAULT_CUTOFF_AS_OF` and is never derived from the source's build/generated time. A
missing/malformed/non-pre-target as-of fails closed. The CLI prints the artifact as JSON and exits
non-zero unless `readinessStatus` is `ready_minimal_boundary`.
