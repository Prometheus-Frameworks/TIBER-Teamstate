# Team Environment Forecast Features V1

> Status: **contract-first slice** for issue #42. This defines a PPM-facing artifact shape, a
> TypeScript type + fail-closed validator, and one shape-only representative fixture. It does **not**
> wire PPM ingestion, generate full data, change model behavior, or make TTS a fantasy-point
> forecasting layer.

## Purpose

`team_environment_forecast_features_v1` is the first Teamstate-owned, **model-legible** team
environment feature artifact intended for the Point-prediction-model (PPM). It exposes **pre-cutoff,
team-state-only** environment context so PPM can later decide — after it joins players to teams via
TIBER-Data identity/roster truth — whether those features improve its fantasy-point forecasts.

It bridges Teamstate's existing team-environment outputs (`team_environment_movement_v1`,
`team_environment_profiles_v0`) toward PPM issue #59's feature-manifest boundary, **without**
turning TTS into a fantasy-point model or a source-of-truth repo.

## Ownership boundary (the one rule that matters)

TTS describes **team environment context only**. It never describes player outcomes.

- TTS **may** say: "NYG had this observed team offensive/pass/pace/pressure environment before the
  forecast cutoff."
- TTS **must not** say: "Malik Nabers will score more points."

PPM — not TTS — decides whether the team-context features improve forecast accuracy. This artifact
is an input offer, not a prediction.

## Artifact

- Contract module: `src/contracts/teamEnvironmentForecastFeaturesV1.ts`
  (types + `validateTeamEnvironmentForecastFeaturesV1`, a deterministic fail-closed validator).
- Representative fixture:
  `data/fixtures/team_environment_forecast_features/team_environment_forecast_features_v1.sample.json`.
- **Output kind:** `model-legible-team-context`.
- **Owning repo:** `TIBER-Teamstate`.
- **Intended consumer:** `Point-prediction-model` (PPM).

There is intentionally **no committed `output/` artifact yet**: PPM ingestion is not wired and no
live consumer reads it, so committing one would violate `docs/output-artifact-policy.md` (a
committed `output/` artifact must back a real or documented downstream consumer). The fixture lives
under `data/fixtures/` precisely so it cannot be mistaken for a promoted output.

## Shape

```json
{
  "artifact": "team_environment_forecast_features_v1",
  "contractVersion": "team_environment_forecast_features_v1",
  "generatedAt": "2026-06-22T00:00:00.000Z",
  "cutoffAt": "2025-09-01T00:00:00.000Z",
  "featureSeason": 2024,
  "targetSeason": 2025,
  "owningRepo": "TIBER-Teamstate",
  "intendedConsumer": "Point-prediction-model",
  "outputKind": "model-legible-team-context",
  "governance": {
    "governanceStatus": "fixture",
    "governanceSource": "explicit_marker",
    "generatedAt": "2026-06-22T00:00:00.000Z"
  },
  "coverage": {
    "teamCount": 2,
    "expectedTeamCount": 32,
    "isFullLeague": false,
    "seasons": [2024],
    "weeks": [1, 2, 3, 4, 5, 6]
  },
  "featureDefinitions": [ { "name": "neutral_pass_rate", "type": "number", "description": "…", "allowedInModel": true, "allowedInPosthocExplanation": true } ],
  "teams": [
    {
      "teamId": "NYG",
      "teamAbbr": "NYG",
      "season": 2024,
      "cutoffAt": "2025-09-01T00:00:00.000Z",
      "features": { "neutral_pass_rate": null, "offense_direction": "unknown", "offense_tier": "unknown" },
      "featureCoverageStatus": "unavailable",
      "confidence": 0.0,
      "warnings": [],
      "sourceDatasetRefs": []
    }
  ]
}
```

### Top-level fields

| Field | Meaning |
| --- | --- |
| `artifact` / `contractVersion` | Both exactly `team_environment_forecast_features_v1`. |
| `generatedAt` | ISO timestamp the artifact was produced. |
| `cutoffAt` | Forecast cutoff (see **Cutoff semantics**). |
| `featureSeason` | The season the **observed** features describe. Never the target season. |
| `targetSeason` | The season PPM is forecasting into. Carried for join/audit only; no target-season fact may inform features. |
| `owningRepo` | Always `TIBER-Teamstate`. |
| `intendedConsumer` | Always `Point-prediction-model`. |
| `outputKind` | Always `model-legible-team-context`. |
| `governance` | Declared provenance/governance (see **Governance semantics**). |
| `coverage` | League/season/week coverage (see **Source / coverage requirements**). |
| `featureDefinitions` | Self-describing manifest of every feature key (see **Feature definitions**). |
| `teams` | One row per team (see **Per-team rows**). |

### Per-team rows

Each `teams[]` row carries `teamId`, `teamAbbr`, `season`, a row-level `cutoffAt`, a `features`
object, `featureCoverageStatus` (`complete | partial | unavailable`), a `confidence` in `[0, 1]`,
`warnings[]`, and `sourceDatasetRefs[]` for auditable provenance.

Each `features` object must contain **exactly** the keys declared in `featureDefinitions[].name` —
no missing keys, no undeclared extras. The validator enforces this alignment, and additionally
fails closed when each feature value violates its canonical type: a numeric feature must be a finite
`number` or `null` (never a string, `NaN`, or `Infinity`), and a direction/tier feature must be a
string drawn from that feature's closed vocabulary (see the type unions in
`src/contracts/teamEnvironmentForecastFeaturesV1.ts`).

## Cutoff semantics

`cutoffAt` is a hard temporal boundary. **No fact at or after `cutoffAt` may inform any feature
value.** Features describe the team environment as observed strictly **before** the cutoff;
`targetSeason` is the future window PPM forecasts into. This prevents leakage of post-cutoff or
target-season information into a pre-cutoff model input. The cutoff is repeated on every team row so
a single row remains self-describing if extracted.

## Governance semantics

Mirrors `team_environment_movement_v1` (issue #40): governance is **declared explicitly** and is
**never inferred from a path alone**.

- `governanceStatus`: `governed | fixture | ungoverned | unknown`.
- `governanceSource`: `explicit_marker | path_inference | unknown`.
- `generatedAt`: mirrors the artifact's top-level `generatedAt`.
- `promotionNotes` (optional): non-advisory provenance notes (e.g. flagging a path-only inference or
  recording that a fixture is shape-only).

A non-full-league artifact can **never** be `governed`. A `/promoted/` path is at most a weak hint
and never, on its own, proof of governance.

## Feature definitions

`featureDefinitions` is a self-describing manifest. For v1 it must declare **exactly** the canonical
feature set (`TEAM_ENVIRONMENT_FORECAST_FEATURE_NAMES_V1`) — no missing canonical features, no
unknown extras, no duplicates, and each declared with its canonical `type` — or the validator fails
closed. Each entry has `name`, `type` (`number | direction | tier`), `description`, and two
PPM-facing usage gates:

- `allowedInModel` — may PPM use this feature as a model input?
- `allowedInPosthocExplanation` — may PPM surface it as a post-hoc explanation field?

These flags are advisory contract metadata. **PPM #59's feature-manifest rules remain
authoritative** for actual eligibility.

### Candidate feature families (team-state only)

Numeric (`type: number`), reused from `team_environment_movement_v1` window averages:

- `points_per_drive`, `epa_per_play`, `success_rate`, `explosive_play_rate`,
  `pressure_rate_allowed`, `seconds_per_play`, `neutral_pass_rate`, `volatility_score`
  (a Teamstate stability metric, not a fantasy output).

Directional (`type: direction`), reused from `team_environment_movement_v1` movement labels, widened
with an explicit `unknown`:

- `offense_direction`, `pass_environment_direction`, `pace_direction`, `pressure_direction`,
  `volatility_direction`.

Tier (`type: tier`), candidate features carried from `team_environment_profiles_v0`:

- `offense_tier`, `pass_environment_tier`, `pace_tier`, `volatility_tier`.

These are **candidates**, not a guarantee that every value is populated in the first fixture.
`null` (numeric) and `unknown` (direction/tier) are explicit "no signal" — never a fabricated
default.

### Excluded by contract (team-state-only boundary)

The artifact is team-state-only. The following are **forbidden** and the validator fails closed if
any appears:

- `fantasyPointsForQB` / `fantasyPointsForRB` / `fantasyPointsForWR` / `fantasyPointsForTE`, or any
  fantasy-point field;
- any direct fantasy-point forecast;
- any player-specific output;
- any start/sit/trade/drop/waiver/roster-advice language.

## Source / coverage requirements

`coverage` carries `teamCount`, `expectedTeamCount` (32), `isFullLeague`, `seasons[]`, `weeks[]`.

- `isFullLeague` is `true` only when all 32 teams are present. Coverage metadata is **not**
  self-asserted: the validator fails closed when `teamCount` disagrees with the actual number of
  team rows, or when `isFullLeague` disagrees with `teamCount === expectedTeamCount`. A subset of
  teams cannot claim full-league coverage.
- An artifact that is not full-league must not be promoted to `governed`.
- Source provenance for any populated row is recorded per-row in `sourceDatasetRefs[]` and at the
  governance level — never inferred from path alone.

## Warnings / confidence

- `warnings[]` (per team) records lane-level caveats, e.g. shape-only placeholders, withheld lanes,
  or partial coverage.
- `confidence` (per team, `[0, 1]`) is the producer's confidence in that row's features. Fixture /
  placeholder rows are `0`. Confidence is **not** a forecast and carries no fantasy semantics.

## Current coverage limitation

The current committed movement fixture (`output/team_environment_movement_v1.json`) is useful for
proving shape but is **not** PPM-ready training/evaluation data:

- it covers only **2 teams** (`DET`, `PIT`);
- **weeks 1–6** only;
- `fixture_scaffold` provenance.

It must not be treated as production truth or full PPM training input. Likewise, the representative
fixture shipped with this contract
(`data/fixtures/team_environment_forecast_features/team_environment_forecast_features_v1.sample.json`)
is **shape-only**: it covers 2 teams with all feature values as `null`/`unknown`, confidence `0`,
and `featureCoverageStatus: unavailable`. It exists to prove the v1 envelope, not to carry data. No
values were hand-fabricated.

## Staged coverage path

### 1. Current state

`team_environment_movement_v1` is a representative fixture only (2 teams, weeks 1–6,
`fixture_scaffold`). It cannot be treated as production truth or PPM-ready full training input. The
forecast-features fixture in this PR is shape-only and likewise carries no source-backed values.

### 2. All-32 teams, weeks 1–6 (fixture/scaffold target)

No source-backed or fixture-generated all-32 weeks 1–6 input exists in this repo today
(`output/team_environment_movement_v1.json` is 2 teams; `data/processed/2026_team_offensive_environment_v0.json`
is a 32-team **seed** with mostly `unknown` / public-data-pending fields, not governed model input).

**Required upstream input shape:** an all-32, weeks 1–6 team-week source equivalent to the
`team_environment_movement_v1` inputs (per team-season window averages + movement labels). When such
a source-backed or fixture-generated input exists, the artifact is generated by mapping, per team:

- numeric features ← the pre-cutoff window's team-state averages
  (`pointsPerDrive → points_per_drive`, `epaPerPlay → epa_per_play`, … `volatilityScore →
  volatility_score`);
- directional features ← `team_environment_movement_v1` movement labels;
- tier features ← `team_environment_profiles_v0` tiers.

Until that input exists, the all-32 weeks 1–6 artifact is a **future data-completion step**. **Do
not fabricate all-32 values by hand** to fill the artifact.

### 3. Full-season bridge

Future target: all 32 teams across the full regular-season window. Prefer source-backed TIBER-Data
input. If a fixture/scaffold is used, label it explicitly (`governanceStatus: fixture`) and keep
governance non-production.

### 4. PPM eligibility gate

PPM may treat this artifact as **training/evaluation eligible only** when coverage and governance
satisfy PPM #59's feature-manifest rules — at minimum: full-league coverage
(`coverage.isFullLeague: true`), an explicit non-fixture `governanceStatus`, a sound `cutoffAt`
(no post-cutoff/target-season leakage), and per-feature `allowedInModel` gating.

Fixture or incomplete artifacts (like everything shipped in this PR) may be used for **harness
validation only** — never predictive authority.

## Guardrails (enforced + documented)

- No PPM code changes, no TIBER-Fantasy integration, no ML, no model training.
- No new scoring model beyond the deterministic validator / feature-shaping here.
- No fantasy-point fields, no player-specific outputs, no roster/start/sit/trade/drop/waiver
  language (validator fails closed on fantasy-point keys).
- No post-cutoff or target-season facts as pre-cutoff model input.
- No governance inferred from path alone.
- No hand-fabricated all-32 team values.
- No mutation of TIBER-Data artifacts.
