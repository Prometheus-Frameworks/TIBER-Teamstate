# Review: candidate `team_week_raw_v0` → derived Teamstate artifact transform feasibility

> Status: **review / design only — no transform implemented.** This document adds no adapter,
> mapper, builder, pipeline, or contract change; it generates and promotes nothing; it does not
> touch PPM, Product, ranking, or fantasy-advice code. It is the design deliverable for issue
> [#54](https://github.com/Prometheus-Frameworks/TIBER-Teamstate/issues/54).

Issue: TIBER-Teamstate **#54** — *Review: candidate `team_week_raw_v0` → derived Teamstate artifact
transform feasibility.*
Parent tracker: TIBER-Teamstate **#50** — *Spec: real 2024 all-32 Teamstate source path for PPM.*

## Central question

Can Teamstate transform the real 2024 `team_week_raw_v0` candidate input into a **derived Teamstate
candidate artifact** without: promoting the source; hiding/relabeling `partial_real_data` /
`ungoverned`; treating `pressureRateAllowed: null` as zero; backfilling/estimating pressure;
weakening TIBER-Data #166/#167/#170; touching PPM; or touching Product/Management/ranking/advice
outputs?

## Decision (one outcome)

**Outcome 2 — Candidate transform plan (bounded, null-aware, candidate-only, non-production).**
A safe derived candidate artifact is *possible in principle*, but **not** as a minimal reuse of an
existing pattern (Outcome 3 is rejected) and **not** as a flat block (Outcome 1 is rejected only for
the non-pressure signals). The pressure dimension specifically remains in an Outcome-1 posture:
**pressure-derived output is blocked at `insufficient_data` / `null` until `pressureRateAllowed` is
sourced upstream** — it must never be computed.

This PR ships the plan as documentation only. Implementation is deferred to a separately authorized
follow-up because the safe path requires **net-new null-aware code** (a null-preserving mapper plus a
scoring path that does not launder `null`→`0`), not the reuse of an already-isolated candidate-output
pattern.

Why Outcome 3 is rejected:

- Representing a candidate row's `null` pressure/fantasy/`redZoneTdRate` requires **widening
  `TeamWeekInputRow`** (today every metric is a non-null `number`, `src/types/teamstate.ts:7-43`),
  which ripples null-awareness through the entire scoring path.
- The **only** existing route from a team-week row to a movement/forecast artifact runs through that
  scoring path (`mapRawTeamWeekToTeamStateInput` → `buildTeamWeekStates` → movement → forecast), and
  that path **launders `null`→`0`** at multiple sites (see Q2).
- There is **no existing isolated candidate-*output* pattern**. The #53 candidate adapter performs
  *intake only* (`src/adapters/teamWeekRawV0CandidateAdapter.ts` produces a
  `TeamWeekRawCandidateConsumption`, not a derived artifact). Producing a derived artifact is new
  surface, so "minimal implementation against an existing safe pattern" does not apply.

## Current lane state

TIBER-Data source-artifact ladder (complete):

| Issue | Stage |
| --- | --- |
| TIBER-Data #163 | PR A — source-artifact spec |
| TIBER-Data #165 | PR B — dry-run source/schema probe |
| TIBER-Data #166 | PR C — preflight: 2024 window + derivation rules |
| TIBER-Data #167 | PR C — derivation-gate resolution |
| TIBER-Data #168 | real 2024 `team_week_raw_v0` source candidate emitted |
| TIBER-Data #170 | PR D — promotion review merged: **do not promote** |

Teamstate candidate-consumption lane (complete):

| Issue | Stage |
| --- | --- |
| TIBER-Teamstate #52 | PR E — candidate-consumption issue |
| TIBER-Teamstate #53 | read-only candidate adapter/loader merged |

Known candidate state (verified against the real artifact and the #53 fixture):

- 544 team-week rows; 32 teams; 2024 regular season Weeks 1–18.
- `pressureRateAllowed` is `null` / deferred on **every** row.
- the eight fantasy-points fields are `null` on **every** row.
- `redZoneTdRate` is `null` on zero-red-zone-trip rows.
- artifact remains `partial_real_data` / `ungoverned`; no `governed_real_data` claim.

## Files reviewed

Adapter / ingest boundary (intake — "the safe end"):

- `src/adapters/teamWeekRawV0CandidateAdapter.ts`
- `src/ingest/loadTeamWeekRawV0Candidate.ts`
- `docs/teamstate-candidate-consumption-team-week-raw-v0-2024.md`

Transform / scoring path (the impedance — "where null becomes zero"):

- `src/types/teamstate.ts`
- `src/adapters/mapRawTeamWeekToTeamStateInput.ts`
- `src/transform/buildTeamWeekState.ts`
- `src/score/utils.ts`
- `src/score/scoreStability.ts`
- `src/score/scoreTeamPower.ts`
- `src/score/scoreFantasyEnvironment.ts`

Movement / forecast features (the output surface):

- `src/pipeline/teamEnvironmentMovement.ts`
- `src/pipeline/teamEnvironmentMovementV1.ts`
- `src/pipeline/teamEnvironmentForecastFeaturesV1.ts`
- `src/contracts/teamEnvironmentMovement.ts`
- `src/contracts/teamEnvironmentForecastFeaturesV1.ts`
- `src/validation/teamWeekRawV0Coverage.ts`

Production entrypoint / isolation check:

- `src/pipeline/runTeamStatePipeline.ts`
- `src/fixtures/teamEnvironmentForecastFeaturesV1Scaffold.ts`

## Review questions — answers with evidence

### Q1. Can a candidate row with `null` pressure / fantasy / `redZoneTdRate` be represented in the current transform path without widening `TeamWeekInputRow`?

**No.** `TeamWeekInputRow` types every metric as a non-null `number`:
`pressureRateAllowed: number` (`src/types/teamstate.ts:32`), `redZoneTdRate: number`
(`src/types/teamstate.ts:29`), the eight fantasy fields `number`
(`src/types/teamstate.ts:35-43`). The only mapper into that type,
`mapRawTeamWeekToTeamStateInput`, also types its source as non-null `number`
(`src/adapters/mapRawTeamWeekToTeamStateInput.ts:26,24,28-35`) and copies values straight through
(`...mapRawTeamWeekToTeamStateInput.ts:75,77,79-86`) with no null branch. Feeding `null` would be a
type lie that resolves, at runtime, into the laundering sites in Q2. **Honest representation requires
widening the input type** (or a parallel null-aware type), which then *forces* null-aware handling
across the whole scoring path.

### Q2. Does any candidate-reachable path silently convert `null` pressure/fantasy into a zero-equivalent through `normalize()`, `safeNumber()`, averaging, defaulting, or fallback?

**Today: no candidate-reachable path exists** (see Q8 — nothing wires the candidate into the scoring
pipeline). **But every laundering site below would activate the moment a candidate row is coerced
into `TeamWeekInputRow`.** Enumerated null→zero sites:

| # | Site | Mechanism |
| --- | --- | --- |
| L1 | `src/score/utils.ts:15` — `normalize()` | `if (!Number.isFinite(value) ...) return 0;` → `null`/`NaN` pressure, fantasy, or `redZoneTdRate` becomes a `0` normalized component. |
| L2 | `src/score/utils.ts:6-7` — `safeNumber()` | non-finite → `fallback` (default `0`); used inside `weightedAverage` (`utils.ts:26`). |
| L3 | `src/score/utils.ts:1-3` — `clamp()` | non-finite → `min` (default `0`). |
| L4 | `src/score/scoreStability.ts:6` — `redZoneSustainabilityRaw` | `null redZoneTdRate` → `null - 0.62` = `NaN` → `clamp(NaN,…)` → `0`. |
| L5 | `src/score/scoreStability.ts:14-19, 27` | `pressureRateAllowed` and `redZoneTdRate` flow through `normalize()` (L1). |
| L6 | `src/score/scoreTeamPower.ts:11, 13-18` | `redZoneTdRate` and `pressureRateAllowed` flow through `normalize()` (L1). |
| L7 | `src/score/scoreFantasyEnvironment.ts:15, 17-36` | `redZoneTdRate` + four `fantasyPointsFor*` fields flow through `normalize()` (L1). |

Net effect if wired naïvely: a `null` pressure becomes `pressureAvoidance: 0` (the *worst possible*
pressure score), a fabricated football claim. This is the core hazard the plan must design around by
**never routing pressure/fantasy/`redZoneTdRate` nulls through this scoring path**.

### Q3. How does the movement window-averaging path behave on arrays of nulls?

**The averaging itself is null-safe (honest exclusion), but a contamination channel exists via
`volatilityScore`.** `average()` filters non-finite values and returns `null` for an all-empty set
(`src/pipeline/teamEnvironmentMovement.ts:31-35`); `round()` preserves `null`
(`teamEnvironmentMovement.ts:26-29`); `buildDeltas()` yields `null` when either window average is
`null` (`teamEnvironmentMovement.ts:141`); and `buildPressureDirection(null)` →
`insufficient_data` (`teamEnvironmentMovement.ts:183-188`). So an all-`null` pressure column
produces `pressureRateAllowed: null` and `pressureDirection: insufficient_data` honestly.

Two caveats:
- **Contamination:** `buildWindowAverages` averages `state.scores.volatilityScore`
  (`teamEnvironmentMovement.ts:113`), and `volatilityScore` is computed by `scoreStability` from the
  **laundered-zero** pressure/redZone components (L4/L5). So even with honest pressure averaging, the
  movement `volatility_score` / `volatilityDirection` would be **silently contaminated** upstream
  unless pressure and `redZoneTdRate` are removed from the stability computation for candidate rows.
- **Partial windows:** `average()` averages only the present values, so a window mixing real and
  `null` pressure weeks would silently report the mean of the present subset. For *this* candidate
  pressure is null on every row, so the result is uniformly `null` — but the plan must forbid
  relying on partial-window pressure means as if they were full-window truth.

### Q4. Can the movement / forecast output contracts honestly express `pressure_rate_allowed: null` and `pressure_direction: insufficient_data` end-to-end without synthesizing a non-null upstream value?

**Yes — the contracts already support it.** Movement: `pressureRateAllowed: number | null`
(`src/contracts/teamEnvironmentMovement.ts:29`) and `PressureMovementDirection` includes
`insufficient_data` (`teamEnvironmentMovement.ts:6`). Forecast: `pressure_rate_allowed: number | null`
(`src/contracts/teamEnvironmentForecastFeaturesV1.ts:59`), `pressure_direction` admits
`insufficient_data` and `unknown` (`teamEnvironmentForecastFeaturesV1.ts:43, 201`), and the
fail-closed validator accepts `null` for numeric features (`teamEnvironmentForecastFeaturesV1.ts:467-472`).
The bridge passes the averages straight through (`teamEnvironmentForecastFeaturesV1.ts:94-116`). So
end-to-end `null` / `insufficient_data` is **contractually expressible without fabricating a value**
— *provided* the scoring laundering of Q2 is bypassed so a `0` is never introduced before the
average.

### Q5. Does producing a candidate `forecast_features_v1` artifact risk exposing fabricated/zeroed pressure to model-allowed fields?

**Yes — this is the highest-stakes risk.** `pressure_rate_allowed` is declared
`allowedInModel: true` (`src/pipeline/teamEnvironmentForecastFeaturesV1.ts:45`;
contract intent `src/contracts/teamEnvironmentForecastFeaturesV1.ts:59`). The bridge copies
`lateWindow.averages.pressureRateAllowed` verbatim (`teamEnvironmentForecastFeaturesV1.ts:101`). If a
naïve mapper laundered `null`→`0` (Q2) *before* averaging, that `0.0` would average to a real `0.0`
and be published into a **model-eligible** field — i.e., a fabricated pressure value reaching PPM's
feature surface. Honest path (`null` preserved → averaged to `null`) keeps the field a truthful "no
signal." The plan therefore must **stop short of emitting a candidate `forecast_features_v1` with any
non-null pressure**, and should keep candidate output at the movement layer (or a clearly
candidate-namespaced features artifact whose pressure column is provably `null`), never on the
governed PPM-facing path.

### Q6. What metadata must a derived Teamstate candidate artifact carry to preserve upstream status?

The #53 intake already surfaces the needed fields on its `upstream` block
(`provenanceStatus`, `governanceStatus`, `governanceSource`, `deferredFields`, `sourceArtifactPath`,
`validationReportPath`, `lineageManifestPath` — see
`docs/teamstate-candidate-consumption-team-week-raw-v0-2024.md` "Output shape"). A derived candidate
artifact must **propagate all of them** plus a pressure/deferred-status marker. Required envelope:

- `provenanceStatus: partial_real_data` — never upgraded. (Movement maps this to governance
  `ungoverned`, `src/pipeline/teamEnvironmentMovementV1.ts:55-68.`)
- `governanceStatus: ungoverned`, `governanceSource: not_set` (carried from upstream; movement v1
  requires an `explicit_marker` and must be fed the upstream marker explicitly, not inferred —
  `teamEnvironmentMovementV1.ts:77-97`).
- `deferredFields` — must list `pressureRateAllowed` and the eight fantasy fields, propagated
  verbatim from upstream.
- `sourceArtifactPath`, `validationReportPath`, `lineageManifestPath` — carried for lineage.
- an explicit **pressure status** / null-semantics field stating pressure is deferred-null upstream
  and intentionally not derived (so a downstream reader can never mistake a `null` for a missing
  computation vs. a deferred input).
- coverage metadata derived from actual rows, never self-asserted
  (`src/contracts/teamEnvironmentForecastFeaturesV1.ts:333-347`).

Critically, governance/provenance must be sourced **only** from the artifact's own metadata, never
from path/name/validation-success/downstream-need (the #53 adapter already enforces this; the derived
builder must do the same — `teamEnvironmentMovementV1.ts:86-97` documents that a path is a weak hint,
never proof).

### Q7. Does coverage validation need bye-aware handling before it can be trusted for real 2024 Weeks 1–18?

**Yes.** `validateTeamWeekFullLeagueCoverage` requires **every** expected team to carry **every**
expected week, with no extras (`src/validation/teamWeekRawV0Coverage.ts:60-72, 84-90`). Real 2024
teams each have a bye, so against `expectedWeeks = [1..18]` every team is "missing" its bye week and
the validator **fails closed with false `missing week` errors** (`teamWeekRawV0Coverage.ts:67-71`).
It was written for the all-32 Weeks 1–6 *fixture-scaffold* (no byes, per its own header
`teamWeekRawV0Coverage.ts:1-9`). A **bye-aware mode** (expected games-per-team, or a bye schedule)
is required before this validator can gate the real 2024 1–18 candidate. This is a prerequisite for
any full-league candidate coverage claim, but is **out of scope for this review** and belongs in the
follow-up.

### Q8. Is there an existing isolated candidate-output namespace/pattern usable without touching production pipeline entrypoints or ranking/report paths?

**No isolated candidate-*output* pattern exists yet; isolation of the *intake* is, however, clean and
real.** A repo-wide search shows `TeamWeekRawCandidate*` / `loadTeamWeekRawV0Candidate` /
`adaptTeamWeekRawV0Candidate` are referenced **only** by the adapter, its loader, its test, and its
doc — and never by `mapRawTeamWeekToTeamStateInput`, `buildTeamWeekStates`, the movement/forecast
builders, or `runTeamStatePipeline.ts`. The production entrypoint
`src/pipeline/runTeamStatePipeline.ts:88-98` consumes only `RawTeamWeekRow`s via
`mapRawTeamWeekToTeamStateInput` + `buildTeamWeekStates`; the scaffold builder
`src/fixtures/teamEnvironmentForecastFeaturesV1Scaffold.ts:52-53` does the same. So the candidate
path is currently a dead-ended, side-effect-free intake — **good**: a derived candidate artifact can
be built in a *new, candidate-only* module/namespace without touching those entrypoints. But that
module does not exist today and must be created; it is not a "reuse the existing safe output pattern"
situation.

## Null→zero laundering analysis (summary)

- **No null→zero laundering is reachable today** — the candidate path does not connect to the scoring
  pipeline (Q8).
- **Seven latent laundering sites (L1–L7, Q2)** would activate the instant a candidate `null` is
  coerced into `TeamWeekInputRow`. They are all in `src/score/` and all stem from the scoring path's
  design choice to **fail open to zero** for non-finite inputs.
- **One contamination channel (Q3):** `volatilityScore` carries laundered pressure/redZone zeros into
  the otherwise-null-safe movement averages.
- **One exposure channel (Q5):** a laundered `0` pressure could reach the **model-allowed**
  `pressure_rate_allowed` forecast field.

The plan's load-bearing rule: **candidate rows must never traverse `src/score/` for
pressure/fantasy/`redZoneTdRate`.** Those signals stay `null` / `insufficient_data` by construction.

## Output-contract analysis (summary)

The movement and forecast contracts are already null-honest (`number | null`, `insufficient_data`,
`unknown`) and the forecast validator fails closed on fabricated shapes (Q4). The contracts are
**not** the blocker; the **upstream scoring laundering** is. A candidate transform that bypasses the
scoring path for the null fields can satisfy these contracts honestly.

## Status / metadata propagation requirements (summary)

A derived candidate artifact must carry, unmodified from upstream: `provenanceStatus:
partial_real_data`, `governanceStatus: ungoverned`, `governanceSource: not_set`, the full
`deferredFields` list, `sourceArtifactPath`, `validationReportPath`, `lineageManifestPath`, plus an
explicit pressure-deferred status, and row-derived (never self-asserted) coverage. No field may be
upgraded; governance may be read only from artifact metadata, never inferred (Q6).

## Coverage-validation note

`validateTeamWeekFullLeagueCoverage` is bye-blind and will false-fail on real 2024 Weeks 1–18; a
bye-aware mode is a prerequisite for any full-league candidate coverage claim and is tracked as
follow-up work, **not** done here (Q7).

## PPM / Product / ranking / advice boundary

This review **does not** touch and **does not** propose touching any PPM ingestion/run/code, nor any
Product/Management, ranking, or fantasy-advice output. It confirms the existing forecast contract is
PPM-*facing* but PPM-*authoritative-elsewhere* (`teamEnvironmentForecastFeaturesV1.ts:99-104`
explicitly defers to PPM #59's manifest rules), and it explicitly recommends candidate output stop
**before** the governed PPM-facing forecast surface for any pressure value. No ranking/report/advice
file is read, modified, or implicated.

## Bounded scope statement for the follow-up PR (Outcome 2)

A separately authorized follow-up may implement a candidate-only, non-production derived artifact
**iff** it satisfies every guardrail below. Bounded scope:

1. **New candidate-only module/namespace** (e.g. `src/candidate/…`), wired into **no** existing
   entrypoint (`runTeamStatePipeline.ts`, scaffold builders, ranking/report paths untouched).
2. **Null-preserving mapping** from `TeamWeekRawCandidateRow` to a candidate-local state type — either
   a new `number | null` type or an explicit branch — that **never** routes pressure, the eight
   fantasy fields, or `null` `redZoneTdRate` through `src/score/` (`normalize`/`safeNumber`/`clamp`)
   or through `scoreStability`'s `redZoneSustainability`.
3. **Honestly derivable signals** (present on every candidate row): offense direction from
   `pointsPerDrive`, `epaPerPlay`, `successRate`, `explosivePlayRate`; pace from `secondsPerPlay`;
   pass-environment from `neutralPassRate`. These map cleanly to the movement direction vocabularies.
4. **Must stay `null` / `insufficient_data`:** `pressure_rate_allowed` + `pressure_direction` (null on
   every row — Outcome-1 posture, blocked until sourced); all fantasy fields; `redZoneTdRate`-derived
   signals on zero-trip rows; and `volatility_score` / `volatility_direction` **unless** pressure and
   `redZoneTdRate` are first removed from the stability computation for candidate rows (otherwise
   contaminated per Q3).
5. **Artifact stops at the movement layer** (or a clearly candidate-namespaced features artifact whose
   pressure column is provably `null`). **No** governed `forecast_features_v1` emission with any
   non-null pressure; **no** PPM wiring.
6. **Full upstream metadata propagation** per Q6; provenance/governance read only from artifact
   metadata; `partial_real_data` / `ungoverned` / `not_set` preserved.
7. **Coverage** either bye-aware (new mode, Q7) or explicitly scoped to a bye-free week subset; never a
   false full-league claim.
8. Output remains review/candidate-grade; promotion remains an explicit human review (TIBER-Data #170
   "do not promote" stands).

## Guardrails honored by this PR

- No PPM ingestion / run / code change.
- No Product / Management / ranking / fantasy-advice output.
- No governance promotion; no path/name/validation/downstream-need governance inference.
- `pressureRateAllowed: null` is **not** treated as zero — the laundering sites are enumerated and the
  plan forbids traversing them.
- No backfill / estimation / invention of pressure.
- No TIBER-Data artifact mutated; no TIBER-Data contract changed from this repo.
- TIBER-Data #166 / #167 derivation rules and #170 "do not promote" decision left intact.
- Output is **review / design only**; no transform implemented.

## Follow-up recommendation

Open a bounded implementation issue for the Outcome-2 plan above (candidate-only, null-aware,
movement-layer-stop, no PPM), and a separate small issue for the **bye-aware coverage mode** (Q7) as
its prerequisite. Neither should proceed past review without an explicit go-ahead, and neither may
weaken the guardrails in this document.
