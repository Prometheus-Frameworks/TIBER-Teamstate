# Audit & Spec: real 2024 all-32 Teamstate source path for PPM

> Status: **audit/spec — documentation only.** Resolves the PR-A deliverable of issue #50. This
> document does **not** ingest data, add or change any adapter/builder/pipeline/contract, generate or
> promote any artifact, wire PPM, or run a model. It locks the ownership split and the Teamstate
> consumption contract for a real, source-backed 2024 all-32 team-week input **before** any ingestion
> or adapter work begins.

This continues the #44 audit ladder at **PRs 5–6** (real ingestion → governance promotion). Lineage
to date (all fixture/scaffold): #44 (audit/spec) → #43 (`team_environment_forecast_features_v1`
contract + fail-closed validator) → #47 (all-32 `team_week_raw_v0` scaffold input) → #49 (all-32
`team_environment_forecast_features_v1` scaffold). The chain
`team_week_raw_v0 scaffold → movement_v1 → forecast_features_v1 scaffold` proves **shape, coverage,
typing, and determinism** — **not football truth**.

---

## 1. Ownership split — TIBER-Data first, Teamstate consumes

The repo's stated architecture is unambiguous and is preserved here:

- `docs/tts-v1-team-state-layer.md`: "TIBER-Data owns governed source/provenance truth."
- `docs/README.md`: TIBER-Teamstate "consumes … truth from TIBER-Data and produces deterministic
  team-environment interpretation."
- `docs/audits/teamstate-capability-audit-2026-05-25.md` §5 (Ownership boundary): **TIBER-Data** owns
  raw/canonical inputs, source metadata/provenance/timestamps, identity mapping, and base stats from
  governed pipelines; **TIBER-Teamstate** owns deterministic derived team-environment intelligence.
  Explicitly **not** Teamstate's job: "proprietary/paid data scraping, manual truth overrides that
  bypass TIBER-Data provenance."
- `docs/audits/team-environment-profile-provenance-audit-2026-05-26.md`: "Add **TIBER-Data-owned**
  raw team inputs as the source-of-truth lane before calling it production truth."

| Concern | Owner |
| --- | --- |
| Raw 2024 NFL team-week **acquisition** | **TIBER-Data** |
| **Normalization** to a stable schema | **TIBER-Data** |
| **Provenance / source refs / retrieval date / source-governance marker** | **TIBER-Data** |
| Deterministic **team-environment transformation** from that source artifact into `team_week_raw_v0` → `team_environment_movement_v1` → `team_environment_forecast_features_v1` | **TIBER-Teamstate** |
| Read-only **adapter** consuming the TIBER-Data source artifact | **TIBER-Teamstate** |

**Rule:** Teamstate must **not** scrape or acquire raw 2024 data directly. Doing so bypasses the
documented TIBER-Data provenance lane and is out of the Teamstate boundary. A change to this
architecture would require its own explicit issue; it is **not** in scope here.

**Companion issue required:** the TIBER-Data acquisition/normalization lane needs a separate issue in
the **TIBER-Data** repo (see §7 PR C and the recommendation at the end). This spec defines only the
**consumption contract** Teamstate expects from that lane.

> Interim fallback (honest, non-governed): if TIBER-Data cannot yet provide the source artifact, a
> Teamstate-owned narrow adapter may consume a clearly-labeled `partial_real_data` / `ungoverned`
> input **without promotion**. This is a stopgap for validation only and must never be marked
> governed (see §5).

---

## 2. Current gap

- **No real 2024 all-32 `team_week_raw_v0` input exists today.** The only weeks-1–6 input is the
  2-team DET/PIT **2025** demo; `data/processed/2026_*` are season-2026 qualitative seeds.
- The current full-league path is **scaffold only**:
  - all-32 weeks 1–6 `team_week_raw_v0` scaffold (#47) — identical neutral placeholders;
  - all-32 weeks 1–6 `team_environment_movement_v1` / `team_environment_forecast_features_v1` scaffold
    (#49) — `confidence: 0`, derived movement ~0, directions `stable`.
- **No governed 2024 Teamstate artifact exists** (nothing carries `provenanceStatus:
  governed_real_data` / `governanceStatus: governed`).
- **No PPM ingestion is wired**, by design.

The scaffold chain proves the envelope/coverage/typing are ready to receive real data; it asserts
**nothing** about real football values.

---

## 3. Minimum required real fields

To populate the existing `team_week_raw_v0` envelope (`src/adapters/teamWeekRawV0Adapter.ts`), the
real source artifact must supply, per team-week row:

### Required

| Group | Fields |
| --- | --- |
| Identity / window | `season`, `week`, `teamCode`, `opponentCode` |
| Volume / pace | `offensivePlays`, `neutralPlays`, `secondsPerPlay` |
| Script | `passRate`, `neutralPassRate`, `rushRate` |
| Efficiency | `epaPerPlay`, `passEpaPerPlay`, `rushEpaPerPlay`, `successRate`, `explosivePlayRate` |
| Scoring | `drives`, `pointsPerDrive`, `pointsFor`, `pointsAgainst` |
| Pressure / discipline | `pressureRateAllowed`, `turnovers`, `sacksAllowed` |
| Red zone | `redZoneTrips`, `redZoneTdRate` |

These map directly to the team-state fields consumed by the movement → forecast-features surface
(window averages: `pointsPerDrive`, `epaPerPlay`, `successRate`, `explosivePlayRate`,
`pressureRateAllowed`, `secondsPerPlay`, `neutralPassRate`; plus `pointsFor`/`pointsAgainst` feeding
stability/`volatility_score`).

### Optional / deferred

- Fantasy-point splits: `fantasyPointsForQB`, `fantasyPointsForRB`, `fantasyPointsForWR`,
  `fantasyPointsForTE`, `fantasyPointsAllowedQB`, `fantasyPointsAllowedRB`, `fantasyPointsAllowedWR`,
  `fantasyPointsAllowedTE`. **These are not team-state truth and not needed for the PPM-facing
  surface** (see §4).
- Positional split allowances (`qbPassAllowed`, `qbRushAllowed`, `rbRushAllowed`, `rbRecAllowed`,
  `wrSlotAllowed`, `wrWideAllowed`, `teInlineAllowed`, `teSplitAllowed`) — already optional in the
  adapter.

---

## 4. Adapter impedance mismatch (blocker for PR B — documented only)

A concrete blocker exists between the real-source field set (§3) and the current adapter:

- The current adapter (`src/adapters/teamWeekRawV0Adapter.ts`, `REQUIRED_NUMERIC_FIELDS`)
  **requires the eight fantasy-point fields as finite numbers** on every row.
- `team_environment_movement_v1` **drops** fantasy-point fields (#34).
- `team_environment_forecast_features_v1` **forbids** fantasy-point fields (the #43 validator fails
  closed on any fantasy-point key).
- A real **team-state** source (the TIBER-Data lane) will most likely **not** carry fantasy-point
  splits.

**Therefore the eight fantasy-point fields must become optional for the real-source lane.** This is
**not implemented in PR A.** It is recorded here as the decision and acceptance criteria for **PR B**:

> **PR B acceptance criteria (adapter relaxation):**
> - Make the eight fantasy-point fields **optional** in the `team_week_raw_v0` adapter (accept missing
>   or `null`/`undefined`), so a team-state-only real source validates.
> - **Preserve backward compatibility:** existing fixtures that *do* carry fantasy-point fields
>   (e.g. the #47 scaffold, the movement demo sample) must continue to validate and adapt exactly as
>   today; no change to their adapted output.
> - When fantasy-point fields are absent, they must **not** be fabricated and must **not** propagate
>   into any movement/forecast-features output (they are already dropped downstream).
> - Keep the adapter **fail-closed** on the genuinely-required team-state numeric fields (§3).
> - Tests cover: real-shape row without fantasy-point fields → adapts cleanly; existing
>   fantasy-bearing fixture → unchanged.
> - Add a **bye-aware coverage check** (or bye-aware mode of `validateTeamWeekFullLeagueCoverage`)
>   for the real lane: validate per-team game count over the chosen window instead of a dense
>   team × week grid (see §6). The dense-grid validator remains correct for the scaffold lane.

---

## 5. Governance checklist (before any artifact may be `governed`)

An artifact may be marked `governanceStatus: governed` / `provenanceStatus: governed_real_data`
**only** when all of the following hold:

- [ ] explicit **source refs** (dataset name + URL/identifier) on the artifact and per row
      (`sourceDatasetRefs`);
- [ ] **source version or retrieval date**;
- [ ] **deterministic transform** (artifact reproducible from the governed input — enforced by test,
      as the scaffold chain already is);
- [ ] a **validation report**;
- [ ] **all 32 teams present**;
- [ ] **bye-aware coverage** — each team has its schedule-correct **game count** (17 for the full
      2024 regular season), with byes explicit-by-absence and **not** fabricated as rows (per §6);
- [ ] explicit **missing-field policy** applied (fail-closed or documented null — never silent
      fabrication);
- [ ] an **explicit governance marker** set by the producer (`governanceSource: explicit_marker`);
- [ ] **no path-inference governance** (a `/promoted/` path is at most a weak hint, never proof).

Provenance status must be set **honestly** at each stage:

| Stage | `provenanceStatus` | `governanceStatus` |
| --- | --- | --- |
| Scaffold (today) | `fixture_scaffold` | `fixture` |
| Real but incomplete / not promoted | `partial_real_data` | `ungoverned` (or `unknown`) |
| Real, fully validated, explicitly promoted | `governed_real_data` | `governed` |

Until every checklist item is satisfied **and** governance is explicitly granted, the artifact stays
`partial_real_data` / `ungoverned` and is **never promoted** to `output/`.

---

## 6. Week / window decision (must be made before generating the real 2024 artifact)

The 2024 aggregation window is **unresolved** and must be decided and documented, not chosen silently:

- **Option A — full 18-week regular season** (weeks 1–18).
- **Option B — fantasy-aligned window** (e.g. weeks 1–17), if PPM's fantasy target excludes Week 18.

Constraints regardless of choice:

- The chosen window and its Week-18 handling must be recorded on the artifact (coverage `weeks`,
  aggregation window) and in the contract doc.
- `cutoffAt` must remain **strictly before the 2025 target window**.
- Preserve the **#44 leakage boundary** (§4 of the #44 audit):
  - **Predictive-input-eligible:** 2024 full-season team context → feature for a **2025** PPR target
    (pre-cutoff w.r.t. 2025).
  - **Explanation / eval only (leakage if used as a within-season predictive feature):** 2024
    full-season context used to explain/predict **2024** PPR after the fact.

### Bye weeks & expected game count (coverage-model change required for the real lane)

The scaffold lane (#47/#49) uses a **dense team × week grid** — all 32 teams appear in every week
1–6 — and `validateTeamWeekFullLeagueCoverage` (#47) accordingly checks "each expected team for each
expected week." **A real 2024 game-row source is not dense:** the 2024 regular season runs weeks
1–18, every team has **exactly one bye**, so each team has **17 game rows**, not 18. A team is simply
**absent** in its bye week — there is no game, no `opponentCode`, and no game stats.

This breaks the dense-grid assumption, so the policy must be fixed **before PR C/D generation**:

- **No fabricated bye rows.** A bye must **not** be represented as a zero-filled or placeholder game
  row — that is invented data and would distort window aggregates. A bye is an absent row.
- **Coverage is validated by expected *game count per team*, not team × week presence.** For the
  full 18-week regular season, the expected count is **17 games per team** (each within weeks 1–18);
  for a fantasy-aligned weeks 1–17 window, the per-team expected count is **16 or 17** depending on
  whether that team's bye falls in week 18 — this must be derived from the real schedule, not
  assumed uniform.
- **`validateTeamWeekFullLeagueCoverage` must gain a bye-aware mode** (or a sibling validator) for
  the real lane: assert all 32 teams present, each with its schedule-correct game count and no
  duplicate (team, week), and every game week within the chosen window — **without** requiring a row
  for every team in every week. The current dense-grid validator stays correct for the scaffold lane;
  the real lane needs the bye-aware check. This is a **PR B / PR D acceptance item**, not a PR A code
  change.
- The artifact should record, per team, the **played weeks** and **expected game count**, so coverage
  is auditable and byes are explicit-by-absence rather than inferred.

This decision (window + bye handling + per-team expected game count) is an input to PR C/PR D and
should be confirmed with PPM before the real artifact is generated.

---

## 7. Proposed PR sequence

| PR | Repo | What | Status boundary |
| --- | --- | --- | --- |
| **PR A** | TIBER-Teamstate | **This docs-only source-path audit/spec.** | No code/data. |
| **PR B** | TIBER-Teamstate | Adapter relaxation (fantasy-point fields optional, §4) + **dry-run read-only consumer** for a future TIBER-Data artifact. **No ingestion.** | No real artifact committed. |
| **PR C** | **TIBER-Data** | Source **acquisition/normalization**: produce the real 2024 all-32 team-week source artifact with source refs + retrieval date. | Governed source owned by TIBER-Data. |
| **PR D** | TIBER-Teamstate | Consume the real source → `partial_real_data` / `ungoverned` real 2024 artifact **with validation report**. | Honest non-governed status; no promotion. |
| **PR E** | TIBER-Teamstate | **Promote to `governed`** only after explicit-marker governance + full §5 checklist. | First PPM-eligible artifact. |
| **PR F** | (rehearsal) | **PPM ingestion rehearsal only**, after a governed (or explicitly allowed) source status exists. | No production PPM run. |

PRs A–B are bounded Teamstate work. PR C is **TIBER-Data-owned** and blocks PR D. PRs D–F are gated
on real, validated, governed data and are explicitly **out of scope** until that exists.

---

## Guardrails honored by this document

Docs-only; no code, adapter, builder, pipeline, contract, fixture, or generated-artifact changes; no
real-data ingestion; no `governed_real_data` claim; no `output/` promotion; no PPM ingestion / model
change / run; no Product/Management UI; no rankings; no fantasy advice; no invented data; no
path-inference governance; no #259/#265/#277 implementation; freshness only mentioned as future work
(not designed or enforced here).

## Future work (not in scope here)

- The TIBER-Data acquisition/normalization issue (PR C) — **must be opened in the TIBER-Data repo**.
- Adapter relaxation + dry-run consumer (PR B).
- Real ingestion, validation report, and governance promotion (PRs D–E).
- Freshness/staleness enforcement on the real 2024 artifact (mentioned only; not designed here).
