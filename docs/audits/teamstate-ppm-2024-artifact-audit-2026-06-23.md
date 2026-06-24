# Audit & Spec: 2024 full-league Teamstate artifacts for PPM consumption

> Status: **audit/spec — documentation only.** Resolves issue #44. This document does **not**
> generate data, change builders/pipelines, change contracts/schemas, alter committed artifacts or
> fixtures, wire PPM, or open a model run. It inventories what Teamstate emits today and specs the
> 2024 full-league artifact surface that the Point-prediction-model (PPM) lane will eventually need.
>
> This is the **first ML-lane Teamstate artifact-production step**. The active TIBER lane has moved
> from Product (#264, closed) to ML/modeling, anchored by **Point-prediction-model #60**. The intent
> is to make the Teamstate → PPM boundary legible **before** any new PPM model-run work. Model-run
> work follows after this contract is understood; it is not part of this slice.

## Relationship to other issues

- **#44** (this doc): upstream audit/spec of the current artifact surface and the 2024 full-league
  target, plus the smallest PR sequence and the PPM handoff boundary.
- **#42**: contract-shape-first issue for a PPM-facing feature artifact
  (`team_environment_forecast_features_v1`). This audit **feeds** #42; it deliberately does **not**
  finalize that schema. Schema decisions stay in #42.
- **#34** (open): deprecate/remove fantasy-point fields — already resolved in `v1` (movement v1
  carries no fantasy-point fields).
- **#27** (open): confirm downstream consumers for Teamstate environment artifacts.

---

## 1. Inventory of current Teamstate movement / team-environment outputs

| Artifact / source | Contract / type | Builder / origin | Committed location | What it is |
| --- | --- | --- | --- | --- |
| `team_environment_movement_v1` | `src/contracts/teamEnvironmentMovementV1.ts`; doc `docs/contracts/team-environment-movement-v1.md` | `src/pipeline/teamEnvironmentMovementV1.ts` (`buildTeamEnvironmentMovementV1`) | `output/team_environment_movement_v1.json` | Team-state-only directional movement over early/late windows. **Representative `fixture_scaffold` fixture**, not production truth. Backs the live TIBER-Fantasy read-only consumer. |
| `team_environment_movement_v0` | `src/contracts/teamEnvironmentMovement.ts` | `src/pipeline/teamEnvironmentMovement.ts` | *(no longer tracked under `output/`)* | Legacy predecessor; carried four inert fantasy-point fields. Superseded by v1 (#34). |
| `team_environment_profiles_v0` | `src/contracts/teamEnvironmentProfile.ts`; doc `docs/contracts/team-environment-profile-v0.md` | `src/pipeline/teamEnvironmentProfiles.ts` | `output/team_environment_profiles_v0.json` | Per-team qualitative environment tiers (offense/pass/pace/volatility). Representative fixture (4 teams). Consumed by a TIBER-Fantasy offline report script. Not shaped for PPM feature ingestion. |
| `data/processed/2026_team_offensive_environment_v0.json` | Lightweight seed (no formal contract type) | Hand/seed-authored under `data/processed/` | tracked under `data/processed/` | All 32 teams **but season 2026**, qualitative labels only, every field `unknown`/placeholder, `source_status: public_data_pending`. **Not** a governed, numeric, 2024 PPM source. |
| Generated `output/` clutter (~30 files) | various | pipeline | mostly tracked today | Current snapshots, latest-week reports, rankings, season-to-date reports, pipeline metadata. Per `docs/output-artifact-policy.md` these have **no** downstream consumer and are not PPM-relevant. |

The movement artifact (`v1`) is the cleanest current boundary for PPM because it is team-state-only
(no fantasy-point fields) and already carries explicit provenance + governance metadata.

---

## 2. Confirmed current coverage (movement v1 fixture)

Read directly from `output/team_environment_movement_v1.json` (no inference):

| Fact | Value in committed fixture |
| --- | --- |
| Teams covered | **`DET`, `PIT` only** (2 of 32) |
| Weeks covered | **1–6** (`metadata.coverage.latestWeek: 6`) |
| Season | **2025** — a fixture/demo season, **not 2024** |
| `metadata.coverage.isFullLeague` | **`false`** |
| `metadata.provenanceStatus` | **`fixture_scaffold`** |
| `governance.governanceStatus` | **`fixture`** |
| `governance.governanceSource` | **`explicit_marker`** |
| `governance.contractVersion` | `team_environment_movement_v1` |
| Input source | `data/fixtures/team_week_raw/team_week_raw_v0.movement_demo.sample.json` (type `fixture`) |

### Is PIT/DET weeks 1–6 fixture scaffold or real observed data?

**Fixture scaffold.** The file declares `provenanceStatus: fixture_scaffold`, its sole input is a
demo sample fixture, and `isFullLeague: false`. It is demo/scaffold data — **not** real observed NFL
data — and must remain labeled that way everywhere it is referenced.

### ⚠️ Season discrepancy to carry forward

The committed representative fixture is **season 2025**, while the PPM target below is **2024**.
There is **no 2024 movement artifact committed today**, governed or fixture. Any statement that
Teamstate has 2024 team-environment coverage today would be false. The 2024 surface must be produced;
it does not exist yet.

### Provenance / governance enums (for reference)

- `provenanceStatus`: `fixture_scaffold | sample | partial_real_data | governed_real_data | unknown_provenance`
- `governanceStatus`: `governed | fixture | ungoverned | unknown`
- `governanceSource`: `explicit_marker | path_inference | unknown`

Governance is **explicit-marker-driven**: a path location (e.g. `/promoted/`) is at most a weak hint
and can never, on its own, make an artifact `governed`. This property must be preserved by the 2024
target (see §3 and §7).

---

## 3. Target 2024 full-league artifact shape for PPM

Per-row, a PPM-consumable 2024 Teamstate artifact should expose **at minimum**:

| Field | Purpose |
| --- | --- |
| `season` | Always `2024` for this surface. |
| `team` (`teamId` + `teamAbbr`) | Join key; see §7. |
| `weekRange` / aggregation window | Which weeks the row aggregates (and how — e.g. full regular season, or early/late windows). |
| `sourceRefs` | Dataset/input references the row was derived from (lineage, auditable). |
| `generatedAt` | ISO timestamp. |
| `provenanceStatus` | One of the enum above; honest. |
| `governanceStatus` + `governanceSource` | Explicit-marker governance (never path inference). |
| `confidence` | Per-row confidence / completeness signal. |
| Feature fields | Team-state fields only (see §4 split). **No fantasy-point fields.** |

This is a **shape sketch, not a finalized schema** — the concrete contract (likely
`team_environment_forecast_features_v1`) is owned by #42. This doc only constrains what that contract
must preserve: season/team/window/source-refs/generatedAt/provenance/governance/confidence and a
team-state-only feature set, one row per team.

---

## 4. Predictive-input-eligible vs. explanation-only fields (leakage boundary)

The eligibility of a field depends entirely on **window alignment relative to the prediction
target**, not on the field itself.

**Core rule:**

- **Valid predictive input:** predicting **2025 PPR** using **2024 player PPR + 2024 Teamstate
  context** (all pre-cutoff relative to the 2025 target).
- **Explanation-only (leakage if used as a within-season predictive feature):** **2024 full-season
  Teamstate used to explain 2024 PPR after the fact.** This is evaluation/explanation context, not a
  clean predictive feature for a 2024 target.

| Use of the 2024 artifact | Classification | Allowed as PPM model input? |
| --- | --- | --- |
| 2024 full-season Teamstate → feature for **2025** PPR target | Predictive-input-eligible | Yes (pre-cutoff w.r.t. 2025) |
| 2024 Teamstate (through a cutoff) → feature for **2024** PPR target | Predictive-input-eligible only if window ends **before** the predicted 2024 week | Conditional |
| 2024 full-season Teamstate → explain **2024** PPR after the fact | Explanation-only | No (post-hoc / leakage) |

Candidate team-state feature fields (already produced by the movement contract; all
**fantasy-point-free**): `pointsPerDrive`, `epaPerPlay`, `successRate`, `explosivePlayRate`,
`pressureRateAllowed`, `secondsPerPlay`, `neutralPassRate`, `volatilityScore`, plus directional
labels (`offenseDirection`, `passEnvironmentDirection`, `paceDirection`, `pressureDirection`,
`volatilityDirection`).

The artifact should make this explicit per field (e.g. an `allowedInModel` /
`allowedInPosthocExplanation` pair, as sketched in #42), and should carry an explicit cutoff so PPM
can verify window alignment programmatically rather than trusting a label.

**No fantasy-point fields** belong in this surface. v1 already drops them; keep them out.

---

## 5. Available vs. missing data sources

### Available today

- `data/fixtures/team_week_raw/team_week_raw_v0.movement_demo.sample.json` — the **demo** input
  behind the DET/PIT weeks 1–6 **2025** fixture. Useful for proving artifact shape only.
- `data/processed/2026_team_offensive_environment_v0.json` — all 32 teams, but **season 2026**,
  qualitative labels, every field `unknown`/placeholder, `source_status: public_data_pending`. Not a
  numeric 2024 feature source.
- Movement v1 builder + contract + governance metadata — the production-shape machinery exists; only
  the real 2024 input is missing.

### Missing for a real 2024 full-league artifact

- A **2024**, all-32-team, real (observed NFL) team-week input at the granularity the movement
  builder consumes (the `TeamWeekRaw`-style rows behind `pointsPerDrive`, `epaPerPlay`, etc.).
- A **governed** provenance marker for that input (so `governanceStatus: governed` via
  `explicit_marker`, not path inference).
- Confirmed Week-18 handling decision from PPM (fantasy-aligned window or full 18-week regular
  season).

**No data is invented here.** Where a real 2024 source does not exist, this doc names the required
upstream input shape as future work rather than fabricating values.

---

## 6. Smallest PR sequence: fixture scaffold → governed 2024 full-league artifact

Each step is independently reviewable; fixture/scaffold provenance stays honestly labeled until a
real governed input actually exists.

1. **PR 1 — this doc (#44).** Docs-only audit/spec. Establishes current coverage facts, the 2024
   target shape, the leakage split, data-source gaps, this sequence, and the PPM handoff boundary.
   *(No code/data.)*
2. **PR 2 — contract doc (feeds #42).** Document the PPM-facing 2024 feature contract
   (`team_environment_forecast_features_v1`): fields, cutoff semantics, governance semantics, per-field
   model-eligibility, coverage requirements, join keys. Docs-first; optional TS type stub if it stays
   bounded. *(No data generation.)*
3. **PR 3 — all-32 weeks 1–6 *fixture* artifact.** Generate the artifact for all 32 teams over
   weeks 1–6 from a fixture/scaffold input, explicitly labeled `fixture_scaffold` /
   `governanceStatus: fixture`. Proves full-league shape + coverage validation **without** claiming
   production truth. Only proceed if a source-backed or fixture input exists; **do not hand-fill 32
   teams.**
4. **PR 4 — coverage validation.** Add fail-closed validation: missing teams/weeks, deterministic
   ordering, `isFullLeague` honesty, governance/cutoff presence. Artifact stays fixture-labeled.
5. **PR 5 — real 2024 full-season input ingestion.** When a real 2024 all-32 team-week source is
   available (likely TIBER-Data-backed), ingest it through an adapter. Provenance becomes
   `partial_real_data` → `governanceStatus: ungoverned` until governance is granted.
6. **PR 6 — governance promotion.** With an explicit governance marker on the real 2024 input, the
   artifact resolves to `governanceStatus: governed` via `explicit_marker`. This is the first artifact
   PPM may treat as training/evaluation-eligible (subject to PPM's feature-manifest gate).

PRs 1–2 are docs-only. PRs 3–6 require code/data and are explicitly **out of scope** for this slice;
they are listed only as the roadmap.

---

## 7. Future PPM handoff boundary

| Aspect | Definition |
| --- | --- |
| Artifact path | `output/team_environment_forecast_features_v1.json` (proposed; final name owned by #42). PPM reads from a stable, documented path. |
| Contract name / version | `team_environment_forecast_features_v1` (proposed). Carries `contractVersion` literal; PPM fails closed on unrecognized literals. |
| Join keys | `season` + `team` (`teamId`/`teamAbbr`), reconciled against TIBER-Data identity/roster truth when PPM joins players to teams. One row per team per season window. |
| Cutoff | Explicit `cutoffAt` so PPM can verify the leakage boundary (§4) programmatically. |
| Governance gate | PPM treats the artifact as training/evaluation-eligible only when `governanceStatus: governed` via `explicit_marker` **and** coverage is genuinely full-league. Fixture/ungoverned artifacts are for harness validation only. |
| Consumers | **PPM only at this stage.** No direct Product/Management consumption of this surface yet. |

---

## Guardrails honored by this document

Docs-only; no code, generated-artifact, fixture, or real-data changes; no builder/pipeline or
contract/schema changes (existing contracts are only *described*); no PPM model changes; no PPM run;
no Product/Management UI; no fantasy advice; no rankings; no #259/#265/#277 implementation; freshness
enforcement mentioned only as possible future work (not enforced here); no invented data;
fixture/scaffold kept honestly labeled; governed status requires explicit-marker governance, never
path inference.

## Future work (not in scope here)

- Freshness/staleness enforcement on the 2024 artifact (mentioned only; not designed or enforced).
- Finalizing the `team_environment_forecast_features_v1` schema (#42).
- Real 2024 full-league data sourcing and governance promotion (PRs 5–6 above).
