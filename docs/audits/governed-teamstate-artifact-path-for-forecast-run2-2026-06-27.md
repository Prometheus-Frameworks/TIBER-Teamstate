# Audit & Spec: governed Teamstate artifact path for TIBER-Forecast Run 2

> Status: **audit/spec — documentation only.** Resolves TIBER-Teamstate issue
> [#62](https://github.com/Prometheus-Frameworks/TIBER-Teamstate/issues/62). This document
> ingests no data; adds or changes no adapter/builder/pipeline/contract/fixture; generates,
> promotes, or commits no artifact; wires no Forecast/PPM consumer; trains and evaluates no model.
> It maps the TIBER-Forecast Run 2 TTS feature request to Teamstate-owned outputs, classifies what
> Teamstate can legitimately supply today, and defines the governance, temporal-cutoff, and
> artifact-shape gates that must hold **before** any governed Teamstate artifact may be emitted for
> Forecast ingestion.

## Starting stance

Forecast is **ready to ask** for TTS. Teamstate is **not yet allowed to hand it governed truth.**

TIBER-Forecast (issue #62 / PR #63) established the Forecast lane, the Run 2 TTS feature contract
([`docs/run2-tts-feature-contract.md`](https://github.com/Prometheus-Frameworks/TIBER-Forecast/blob/main/docs/run2-tts-feature-contract.md)),
run manifests, and run-to-run visibility, and asked one documented question:

> Does adding governed, cutoff-valid Teamstate/TTS features improve the seasonal Fantasy Point
> Forecast versus Run 1?

Teamstate has built the **safe candidate-inspection ladder** for the real 2024 `team_week_raw_v0`
source: bye-aware coverage validation (#56/#57), a dry-run candidate coverage lane (#58), and a
null-aware candidate-only rehearsal/readiness report (#60). That proves Teamstate can **inspect**
candidate shape and readiness honestly. It does **not** prove a governed Teamstate artifact exists,
and it does **not** authorize Forecast ingestion. The current candidate/rehearsal path is
`partial_real_data` / `ungoverned` / rehearsal-only and stays that way.

This audit is the bridge: it defines what legitimate governed Teamstate output would require,
without pretending the current candidate/rehearsal artifact already qualifies.

---

## 0. The five distinct objects — do not conflate them

The single most important output of this spec is that these five things are **not interchangeable**.
A reader (human or downstream pipeline) must never be able to confuse one for another. They form a
strict ladder; each rung is a real artifact in this repo today **except** the last two, which do not
exist yet.

| # | Object | Exists today? | What it proves | What it does NOT authorize |
| --- | --- | --- | --- | --- |
| 1 | **Candidate inspection** — read-only intake (`adaptTeamWeekRawV0Candidate`, `loadTeamWeekRawV0Candidate`) | Yes (#53) | A real `partial_real_data` / `ungoverned` source candidate can be read and its declared metadata preserved (governance read **only** from the artifact's own `metadata`, never from path/name). | Nothing derived; no coverage claim; no governance; no consumer. |
| 2 | **Dry-run coverage** — `dryRunTeamWeekRawV0CandidateCoverage` | Yes (#58) | The candidate's `(team_code, week, season)` grid passes **bye-aware** coverage (32 teams, Weeks 1–18, 17 game rows/team, 544 rows, byes explicit-by-absence). Pins `promoted: false` / `governed: false`; pressure held `insufficient_data`. | Coverage success is **not** governance. Still `ungoverned`. |
| 3 | **Rehearsal readiness report** — `rehearseTeamWeekRawV0Candidate` (`kind: 'team_week_raw_v0_candidate_rehearsal'`, `rehearsalOnly: true`, `productionReady: false`) | Yes (#60) | Per-field readiness: `available` / `partial_nulls` / `deferred_insufficient_data`, counting **finite values only** (no null→zero). Fails closed (`withheld_invalid_coverage`) on bad coverage. | A **readiness signal only.** Not a feature source of truth; never trained on; never governed. |
| 4 | **Governed Teamstate artifact** — a `governed_real_data` / `governed`, cutoff-valid, feature-tiered, full-league artifact | **No — does not exist** | (Would prove) a deterministic, source-ref'd, validated, explicitly-marked artifact suitable for production Forecast input. | — (its definition is §2–§4 of this doc). |
| 5 | **Forecast model input** — TTS columns actually joined to players inside a Forecast run | **No — out of this repo** | (Would be) Forecast's own ingestion of object #4 at a cutoff, governed by **Forecast's** run-manifest + feature-manifest rules. | Owned by TIBER-Forecast, never by Teamstate. Teamstate offers; Forecast decides. |

**Rule:** objects 1–3 are inspection/rehearsal grade and are barred from production Forecast
metrics. Only object #4 — which does not exist yet — can ever feed object #5, and only once §2's
governance gate is fully satisfied. This document specifies #4; it does not create it.

---

## 1. Forecast contract → Teamstate-owned output mapping

The Forecast Run 2 contract requests **team-environment** feature groups. Each maps to a field (or a
window-aggregate of a field) on the TIBER-Data `team_week_raw_v0` source candidate, which Teamstate
consumes read-only and reshapes into its owned outputs (`team_environment_movement_v1` window
averages + movement directions, `team_environment_profiles_v0` tiers, and the model-legible
`team_environment_forecast_features_v1` envelope).

Two distinct axes must be read **together** for every group; collapsing them is the failure mode this
audit exists to prevent:

- **Signal readiness** — is the underlying value present and finite on the real 2024 candidate rows
  (verified in [`reviews/team-week-raw-v0-candidate-transform-feasibility.md`](../reviews/team-week-raw-v0-candidate-transform-feasibility.md)
  and the #53 fixture)?
- **Governed-emission status** — may Teamstate emit it in a *governed, Forecast-consumable* artifact
  **today**? For **every** group this is currently **blocked pending governance** (§2): no governed
  artifact exists, so even a fully-finite signal cannot be handed over as governed truth.

> A group being "available" on axis 1 never upgrades axis 2. A finite, fully-covered pace column is
> still ungoverned until the §2 gate is satisfied. This is the whole point of the candidate/rehearsal
> vs. governed boundary.

| Forecast group | Teamstate-owned mapping | Signal readiness (real 2024 candidate) | Governed-emission status |
| --- | --- | --- | --- |
| **Pace / plays / volume** (`offensivePlays`, `neutralPlays`, `secondsPerPlay`, `drives`) | window averages → `seconds_per_play`; pace movement → `pace_direction`; `pace_tier` (profiles) | **available** — finite on all candidate rows | **blocked pending governance** |
| **Pass rate / neutral pass rate** (`passRate`, `neutralPassRate`, `rushRate`) | `neutral_pass_rate`; `pass_environment_direction`; `pass_environment_tier` | **available** — finite on all candidate rows | **blocked pending governance** |
| **Rush/pass environment** (script + `passEpaPerPlay`, `rushEpaPerPlay`) | direction labels from script/efficiency split | **available** — script finite; `passEpaPerPlay`/`rushEpaPerPlay` finite on candidate rows | **blocked pending governance** |
| **Offensive efficiency** (`epaPerPlay`, `successRate`, `explosivePlayRate`) | `epa_per_play`, `success_rate`, `explosive_play_rate`; `offense_direction`; `offense_tier` | **available** — finite on all candidate rows | **blocked pending governance** |
| **Points per drive / scoring environment** (`pointsFor`, `pointsPerDrive`, `pointsAgainst`) | `points_per_drive`; feeds `volatility_score` stability | **available** — finite on all candidate rows | **blocked pending governance** |
| **Red-zone opportunity context** (`redZoneTrips`, `redZoneTdRate`) | red-zone context fields (no governed RZ feature emitted yet) | **partial / null-limited** — `redZoneTrips` finite; `redZoneTdRate` is `null` on the 11 zero-red-zone-trip rows (a true "no trips," **never** zero-fill) | **blocked pending governance**; emit only as `partial_nulls`, never imputed |
| **Sack environment** (`sacksAllowed`) | sack context (no governed feature emitted yet) | **partial / needs source verification** — `sacksAllowed` is present on the candidate row schema but its per-row nullability is **not** verified in the existing feasibility check; must be re-verified against the source before any "available" claim | **blocked pending TIBER-Data source verification + governance** |
| **Pressure environment** (`pressureRateAllowed`) | `pressure_rate_allowed`, `pressure_direction` | **deferred — insufficient data** — `null` on **every** candidate row (#55 posture) | **blocked pending TIBER-Data source/governance**; held `insufficient_data`; **never** computed, backfilled, or zero-filled |
| **Stability / confidence / coverage metadata** | `volatility_score` / `volatility_direction` / `volatility_tier`; per-row `confidence`; bye-aware coverage report; `featureCoverageStatus` | **mixed** — bye-aware **coverage metadata is available**; per-row `confidence` is Teamstate-derived; **`volatility_score` is currently contaminated** because `scoreStability` mixes laundered-zero pressure/`redZoneTdRate` (feasibility Q3/L4–L5), so any governed stability metric must first exclude pressure/RZ from the candidate stability computation | **blocked pending governance**; coverage metadata is safe to emit; `volatility_*` is **deferred** until decontaminated |

### Notes that bind the table

- **Nothing here is "not Teamstate-owned"** among the requested groups: every group is a
  team-environment interpretation, which is squarely Teamstate's lane. The fields Forecast must
  **not** pull from Teamstate are the eight `fantasyPointsFor*` / `fantasyPointsAllowed*` splits —
  those are deferred-null upstream, are not team-state truth, and the
  `team_environment_forecast_features_v1` validator fails closed on any fantasy-point key. They are
  explicitly out of scope as Forecast inputs (no fantasy-source pollution).
- **"available" = signal present at candidate/rehearsal grade**, equivalent to the rehearsal report's
  `available` class. It is **not** a statement that a governed artifact exists. Read it strictly with
  the governed-emission column.
- **Pressure stays deferred by construction.** Per the #54 feasibility decision (Outcome 2) and the
  #55 posture, pressure-derived output is blocked at `insufficient_data` / `null` until
  `pressureRateAllowed` is sourced upstream — it must **never** be computed from the candidate. The
  feasibility review enumerates eight latent null→zero laundering sites (L1–L8) that would activate
  the instant a candidate `null` is coerced into the scoring path; a governed artifact must route
  pressure/fantasy/`redZoneTdRate` nulls **around** `src/score/` entirely.

---

## 2. Governance path — what must be true before a governed artifact exists

A Teamstate artifact may carry `provenanceStatus: governed_real_data` / `governanceStatus: governed`
**only** when every item below holds. This restates and consolidates the §5 checklist of
[`real-2024-teamstate-source-path-2026-06-25.md`](real-2024-teamstate-source-path-2026-06-25.md) and
the metadata-propagation rules of the #54 feasibility review, scoped to Forecast Run 2.

### 2.1 Required upstream source artifact(s)

- A **TIBER-Data-owned** governed 2024 all-32 team-week source artifact (tracked by
  `Prometheus-Frameworks/TIBER-Data#162` / the `team_week_raw_v0` source lane). Teamstate must
  **not** scrape or acquire raw data directly — that bypasses the documented TIBER-Data provenance
  lane and is outside the Teamstate boundary.
- The current real source candidate (`team_week_raw_v0_2024_real_source_candidate.json`) is
  `partial_real_data` / `ungoverned`; TIBER-Data PR D (#170) decided **do not promote**. Until
  TIBER-Data promotes a governed source, **no governed Teamstate artifact can derive from it.** A
  Teamstate-side `partial_real_data` adapter run is a validation stopgap only and must never be
  marked governed.

### 2.2 Required source refs / versions / manifests

- Explicit **source dataset refs** (name + URL/identifier) at the artifact level **and per row**
  (`sourceDatasetRefs[]`), carried from the upstream artifact — never inferred from path or filename.
- **Source version or retrieval date**, and the upstream **validation report** / **lineage manifest**
  paths, propagated verbatim (`validationReportPath`, `lineageManifestPath` already flow through #53
  intake).

### 2.3 Explicit governance marker requirement

- An **explicit producer-set marker** — `{ governanceStatus: 'governed', governanceSource:
  'explicit_marker' }` — the same rule the existing movement-v1 and candidate adapters enforce.
- **No governance inference of any kind.** A `/promoted/` or `governed_real_data` substring in a path
  or filename is at most a weak hint and never proof; coverage success is a validation result, not a
  governance signal; "Forecast needs it" is never a governance signal. Governance is read **only**
  from the artifact's own `metadata`. The #53 adapter already proves both directions of this (accepts
  an `ungoverned` artifact passed a `governed_real_data` path; rejects a `governed`-claiming artifact
  passed a `candidate` path).

### 2.4 Validation requirements

- **Deterministic transform** — the artifact is reproducible from the governed input (test-enforced,
  as the scaffold chain already is).
- **All 32 teams present**; a subset can **never** be `governed` or `isFullLeague: true` (the
  forecast-features validator fails closed when `teamCount`/`isFullLeague` disagree with the actual
  rows).
- **Bye-aware coverage** valid for the chosen input-season window (each team carries its
  schedule-correct game count — 17 for the full 2024 regular season — byes explicit-by-absence, **no
  fabricated bye rows**). The dense-grid validator is bye-blind and false-fails here; the bye-aware
  validator (#56/#57) is the correct gate.
- **Explicit missing-field policy** — fail-closed or documented null, **never** silent fabrication;
  no null→zero laundering; pressure/fantasy/`redZoneTdRate` nulls never traverse `src/score/`.

### 2.5 Row / coverage expectations

- 32 teams; the input-season window (2024) with its per-team expected game count; `coverage` derived
  from **actual rows**, never self-asserted.
- Per-field readiness recorded (`available` / `partial_nulls` / `deferred_insufficient_data`),
  aligned with the rehearsal report classes so Forecast reads readiness directly rather than
  re-deriving it.

### 2.6 Handling of `partial_real_data` / `ungoverned` / rehearsal-only artifacts

- They are **never** silently upgraded. A valid 544-row dry-run is still `ungoverned`.
- They may be used for **harness/readiness validation only**, labeled non-production, and are barred
  from any governed metrics comparison.
- The honest status ladder is fixed:

  | Stage | `provenanceStatus` | `governanceStatus` |
  | --- | --- | --- |
  | Scaffold (fixtures today) | `fixture_scaffold` | `fixture` |
  | Real but incomplete / not promoted (current candidate) | `partial_real_data` | `ungoverned` |
  | Real, fully validated, explicitly promoted (does not exist yet) | `governed_real_data` | `governed` |

Until **every** item in §2 holds and governance is explicitly granted upstream, the artifact stays
`partial_real_data` / `ungoverned` and is **never promoted** to `output/`.

---

## 3. Temporal cutoff / no-leakage path

A governed Teamstate artifact must **prove** it is valid as of the Forecast cutoff. A `generatedAt`
timestamp alone is insufficient: the **source season/week** and the **as-of validity** must be
explicit and machine-checkable.

- **Input-season-only rule.** A run targeting season **Y** may use only TTS information observed
  **before the season-Y forecast cutoff.** For the Run 1/Run 2 shape (forecast **2025** from
  **2024**), every feature value must derive from the **2024** input season, which precedes the 2025
  cutoff. A team's 2025 in-season data must never enter a 2025-target artifact.
- **Explicit cutoff markers.** The artifact carries `featureSeason` (the season the observed features
  describe — never the target), `targetSeason` (carried for join/audit only; no target-season fact
  may inform any feature), and a hard `cutoffAt`. **No fact at or after `cutoffAt` may inform any
  feature value.** The cutoff is repeated on every team row so a single extracted row stays
  self-describing. Any field whose validity date is at or after the cutoff is rejected for that run.
- **Coverage validated as of the cutoff.** Bye-aware coverage over the input-season weeks must hold,
  so a partially-complete in-season pull cannot masquerade as a full-season context.
- **Leakage-class separation (from the #44 boundary).** 2024 (pre-cutoff) context → feature for a
  **2025** target is **predictive-input-eligible**. 2024 full-season context used to explain **2024**
  outcomes after the fact is **explanation/eval only** and is leakage if used as a within-season
  predictive feature. The per-feature `allowedInModel` / `allowedInPosthocExplanation` flags keep
  these uses distinct.
- **Weekly forecasts (if ever added).** A weekly target may use only data available **before the
  target week**; the same season/week + as-of validity proof applies at week granularity. Out of
  scope to build here; noted so the cutoff contract generalizes.

---

## 4. Smallest safe artifact shape Forecast could consume later

This is a **proposed shape only** — no such artifact is generated, committed, or promoted by this PR.
It deliberately reuses the existing `team_environment_forecast_features_v1` envelope (which already
carries governance/provenance/cutoff/coverage/feature-definition/per-row machinery and a fail-closed
validator) and adds only the **minimum** Forecast-Run-2-specific markers. For a **seasonal** 2025
forecast the rows are **team-season** (one row per team for `featureSeason: 2024`); a future weekly
variant would use team-week rows under the same envelope.

> **Validator alignment.** The base envelope below carries the **exact** fields the existing
> `validateTeamEnvironmentForecastFeaturesV1` already requires
> (`src/contracts/teamEnvironmentForecastFeaturesV1.ts`): the `artifact`/`contractVersion` literals,
> `generatedAt`, `cutoffAt`, numeric `featureSeason`/`targetSeason`, `owningRepo: "TIBER-Teamstate"`,
> `intendedConsumer: "Point-prediction-model"`, `outputKind: "model-legible-team-context"`, the
> `governance` block (`governanceStatus` ∈ `governed|fixture|ungoverned|unknown`, `governanceSource` ∈
> `explicit_marker|path_inference|unknown`, `generatedAt`), and the row-derived `coverage`
> (`teamCount`, `expectedTeamCount`, `isFullLeague`, `seasons[]`, `weeks[]`). The Run-2-specific keys
> (`asOf`, `sourceArtifactRefs`, `pressurePosture`, `fieldReadiness`, `deferredFields`, and the
> additive `coverage`/`governance` sub-keys) are **additive extensions** the current validator ignores
> but a future v1.1 / Run-2 validator would enforce — so an artifact following this shape passes
> today's v1 validation rather than failing it. The upstream candidate's `governanceSource: not_set`
> maps to the v1 enum value `unknown` (no explicit marker), never to `explicit_marker`.

```jsonc
{
  "artifact": "team_environment_forecast_features_v1",
  "contractVersion": "team_environment_forecast_features_v1",
  "generatedAt": "<ISO timestamp>",

  // ---- required v1 envelope literals (validator fails closed if absent/wrong) ----
  "owningRepo": "TIBER-Teamstate",
  "intendedConsumer": "Point-prediction-model",
  "outputKind": "model-legible-team-context",

  // ---- temporal cutoff / no-leakage (§3) ----
  "featureSeason": 2024,            // season the observed features describe (never the target)
  "targetSeason": 2025,            // forecast target; join/audit only, never informs a feature
  "cutoffAt": "2025-09-01T00:00:00.000Z",   // hard boundary; no fact at/after may inform a feature
  "asOf": { "sourceSeason": 2024, "sourceWeeks": [1, "…", 18], "validAsOf": "<ISO before cutoffAt>" },  // additive Run-2 marker

  // ---- governance / provenance (§2) ----
  "governance": {
    "governanceStatus": "ungoverned | governed",                   // v1 enum: governed|fixture|ungoverned|unknown
    "governanceSource": "unknown | explicit_marker",               // v1 enum; 'governed' REQUIRES explicit_marker (upstream not_set -> unknown)
    "generatedAt": "<ISO timestamp>",
    "provenanceStatus": "partial_real_data | governed_real_data",  // additive; honest, never upgraded by path
    "promoted": false,                                             // additive; pinned until real promotion
    "governed": false                                              // additive; pinned until real promotion
  },
  "sourceArtifactRefs": {                                          // additive Run-2 marker
    "sourceArtifactPath": "<TIBER-Data source artifact>",
    "sourceDatasetRefs": ["<dataset name + url/id>"],
    "sourceVersionOrRetrievedAt": "<version | retrieval date>",
    "validationReportPath": "<path | null>",
    "lineageManifestPath": "<path | null>"
  },

  // ---- coverage (§2.5), row-derived, never self-asserted ----
  "coverage": {
    "teamCount": 32, "expectedTeamCount": 32, "isFullLeague": true,
    "seasons": [2024], "weeks": [1, "…", 18],                      // seasons[]/weeks[] required by v1
    "byeAware": true, "expectedGamesPerTeam": 17,                  // additive Run-2 markers
    "coverageStatus": "valid | withheld_invalid_coverage"          // additive
  },

  // ---- explicit pressure posture (§1) ----
  "pressurePosture": "insufficient_data",   // fixed until pressure is sourced upstream; never computed

  // ---- per-field readiness / feature tiers (aligned with rehearsal classes) ----
  "fieldReadiness": [
    { "field": "neutral_pass_rate", "tier": "required", "status": "available" },
    { "field": "red_zone_td_rate",  "tier": "optional", "status": "partial_nulls" },
    { "field": "pressure_rate_allowed", "tier": "deferred", "status": "deferred_insufficient_data" }
    // … one entry per feature key
  ],
  "deferredFields": ["pressureRateAllowed", "fantasyPointsForQB", "…"],  // upstream-declared, verbatim

  // ---- self-describing feature manifest + team rows (existing v1 machinery) ----
  "featureDefinitions": [ { "name": "neutral_pass_rate", "type": "number", "allowedInModel": true, "allowedInPosthocExplanation": true } ],
  "teams": [
    {
      "teamId": "NYG", "teamAbbr": "NYG", "season": 2024,
      "cutoffAt": "2025-09-01T00:00:00.000Z",          // repeated per row; row stays self-describing
      "features": { "neutral_pass_rate": 0.0, "pressure_rate_allowed": null, "offense_tier": "…" },
      "featureCoverageStatus": "complete | partial | unavailable",
      "confidence": 0.0,                                // [0,1]; not a forecast; placeholders are 0
      "warnings": [],
      "sourceDatasetRefs": []
    }
  ]
}
```

### Minimal fields Forecast actually needs to gate on

1. **kind/version** — `artifact` / `contractVersion` / `outputKind` literals plus `owningRepo` /
   `intendedConsumer` (fail closed on mismatch — these are the existing v1 validator's required
   literals).
2. **Temporal validity** — `featureSeason`, `targetSeason`, `cutoffAt`, `asOf` (§3).
3. **Governance** — `governance.{provenanceStatus, governanceStatus, governanceSource, promoted,
   governed}`; production use requires `governed_real_data` + `explicit_marker`.
4. **Source refs** — `sourceArtifactRefs.*` for lineage/audit.
5. **Coverage** — full-league, bye-aware, row-derived, with a `withheld_invalid_coverage` failure
   state.
6. **Pressure posture** — explicit `insufficient_data` so a `null` is never misread as a missing
   computation vs. a deferred input.
7. **Readiness tiers** — `fieldReadiness` (required/optional/deferred × available/partial_nulls/
   deferred_insufficient_data) and `deferredFields`, so Forecast reads readiness directly.
8. **Rows + per-row confidence/coverage** with `cutoffAt` repeated for self-description.

Everything beyond this is optional. The shape adds **no** ranking, advice, decision, or fantasy-point
field, and **no** player-specific output — those remain forbidden by the existing validator.

---

## 5. Rehearsal vs governed boundary (restated as an acceptance rule)

Mapping the §0 ladder to the Forecast contract's status table makes the boundary enforceable:

| Object | Production training/eval? | Rehearsal-only experiment? |
| --- | --- | --- |
| Candidate inspection (#53) | No | As intake only |
| Dry-run coverage (#58) | No | As coverage check only |
| Rehearsal readiness report (#60, `rehearsalOnly: true`) | **No** | Yes — as a **readiness signal**, never a feature source of truth |
| `partial_real_data` / `ungoverned` derived artifact | **No** | Yes — clearly labeled non-production |
| Governed Teamstate artifact (`governed_real_data` + `explicit_marker`, full §2) | **Yes**, once verified | Yes |
| Invalid / `withheld_invalid_coverage` | **No** | **No** — refused; run records the refusal reason |

The spec makes it impossible to confuse these because each object carries pinned, non-inferable
markers (`rehearsalOnly`, `productionReady: false`, `promoted: false`, `governed: false`,
`governanceSource`) that a governance promotion can only change through an explicit upstream marker —
never through path, coverage success, or downstream need.

---

## 6. Blockers summary (what stands between today and a governed artifact)

1. **No governed TIBER-Data 2024 source** — the source candidate is `partial_real_data` /
   `ungoverned`; TIBER-Data #170 said do not promote. (Upstream-owned; `TIBER-Data#162`.)
2. **No governed Teamstate derived artifact** — none carries `governed_real_data` / `governed`.
3. **Pressure deferred** — `pressureRateAllowed` null on every row; blocked until sourced; never
   computed.
4. **Stability contamination** — `volatility_score` mixes laundered-zero pressure/RZ via
   `scoreStability`; must be decontaminated before a governed stability feature is emitted.
5. **Sacks unverified** — `sacksAllowed` present on the schema but its real-source nullability is not
   yet verified; re-verify before any "available" claim.
6. **Null-aware derivation not built** — the #54 Outcome-2 candidate-only, null-aware,
   movement-layer-stop derivation is design-only; a governed builder must route pressure/fantasy/RZ
   nulls around `src/score/`.

Until 1–6 are resolved, Forecast Run 2 stays in the **No** column for production: all TTS consumption
is rehearsal-only and labeled non-production.

---

## Guardrails honored by this document

- Docs/spec only; **no** code, adapter, builder, pipeline, contract, fixture, or generated-artifact
  changes.
- **No** Forecast/TIBER-Forecast code changes; **no** Forecast ingestion; **no** model training or
  evaluation; **no** artifact promotion.
- **No** `governed_real_data` claim — none is asserted; the path to one is specified, not taken.
- **No** pressure backfill or zero-fill; **no** null-to-zero laundering — the laundering sites are
  named and the governed path is required to bypass them.
- **No** fantasy advice/product/ranking/decision output; **no** player-specific output.
- **No** TIBER-Data mutation from this repo; **no** direct raw-data acquisition by Teamstate.
- **No** path/name/downstream-use governance inference — governance is read only from explicit
  upstream markers.

## Verification

Run the normal Teamstate checks (documentation-only PR; included for completeness):

```bash
npm run check   # tsc --noEmit
npm test        # vitest run
```

Results are reported in the PR description.

## Future work (out of scope here)

- TIBER-Data governed 2024 source promotion (`TIBER-Data#162`, blocks everything downstream).
- The #54 Outcome-2 null-aware candidate-only derivation builder (movement-layer-stop, pressure
  bypasses `src/score/`).
- Stability decontamination (remove pressure/RZ from candidate `scoreStability`).
- Sack-field source verification.
- A separately authorized Teamstate governed-artifact emission PR, gated on §2.
- Forecast-side ingestion/run (TIBER-Forecast-owned), gated on a governed Teamstate artifact.
