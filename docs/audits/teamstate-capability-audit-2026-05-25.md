# TIBER-Teamstate Capability Audit (2026-05-25)

## Scope and framing

This is an **audit-only** document for TIBER-Teamstate issue #12, aligned to the Monday, May 25, 2026 planning task from TIBER-Fantasy issue #149.

Hard constraints respected:

- no new model built
- no architecture rewrite
- no invented team environment data
- no TIBER-Data or TIBER-Fantasy code changes

Primary target question:

> Can TIBER determine whether a fantasy roster is attached to good NFL environments, bad NFL environments, or meta-aligned offenses?

Current answer (from this repo audit): **partially**. Teamstate can produce deterministic team-level scores and tags from provided inputs, and includes seed context artifacts, but does not yet expose a dedicated, canonical `TeamEnvironmentProfile` contract for direct roster-environment classification.

---

## 1) Current repo shape

### Language/runtime/tooling

- Runtime/language: **TypeScript on Node.js** (`"type": "module"`).
- Build: TypeScript compiler (`tsc`).
- Unit tests (TS): Vitest.
- Additional validators/tests: Python scripts + Python unittest modules.

### Scripts and commands that currently exist

From `package.json`:

- `npm run build` → `tsc -p tsconfig.json`
- `npm test` → `vitest run`
- `npm run check` → `tsc -p tsconfig.json --noEmit`
- `npm run pipeline` → build then run `dist/src/pipeline/runTeamStatePipeline.js`

Python validation/testing entry points also exist via repo scripts/tests:

- `python scripts/validate_team_offensive_environment.py`
- `python scripts/validate_team_landing_context_tags.py`
- `python scripts/validate_2026_teamstate_context.py`
- `python -m unittest tests/test_team_offensive_environment.py`
- `python -m unittest tests/test_team_landing_context_tags.py`
- `python -m unittest tests/test_2026_teamstate_context.py`

### APIs/routes

- No HTTP server or route layer found.
- Public API is a **library export surface** from `src/index.ts` plus generated JSON artifacts from pipeline execution.

### Artifacts currently produced

Pipeline and processed artifacts currently present:

- Detailed state/ranking/report artifacts in `output/` (weekly, latest-week, season-to-date, rankings).
- Compact current-snapshot contracts:
  - `output/current_snapshot.json`
  - `output/current_offense_environments.json`
  - `output/current_matchup_environments.json`
- Pipeline provenance artifact:
  - `output/pipeline_metadata.json`
- Seed/team-context processed artifacts in `data/processed/`:
  - `2026_team_offensive_environment_v0.json`
  - `2026_team_landing_context_tags.json`
  - `2026_teamstate_context_v0.json`

### Contract shape documentation

Documented/typed contracts exist for:

- team-week input and scores (`src/types/teamstate.ts`)
- current snapshot artifacts (`src/contracts/currentSnapshot.ts`)
- docs for 2026 team context and offensive-environment seed

No dedicated `TeamEnvironmentProfileV0` interface exists yet in code.

---

## 2) Current capabilities (exists / partial / missing)

| Capability lane | Status | What exists now | Gaps/notes |
| --- | --- | --- | --- |
| Team quality | **Exists** | `teamPowerScore` and ranking artifacts from deterministic pipeline. | Inputs are only as strong as upstream rows provided. |
| Offensive quality | **Exists (partial)** | `fantasyEnvironmentScore`, offense environment rows by position. | Not yet a single canonical offense tier contract per team/season. |
| Defensive quality (for opponent fantasy context) | **Exists (partial)** | `matchupEnvironmentScore` and position matchup artifacts. | Defensive signal is represented via fantasy matchup framing, not a full defensive profile contract. |
| Pace | **Exists (partial)** | Input schema supports `secondsPerPlay`, `offensivePlays`, `neutralPlays`; tags/scores can reflect environment. | No explicit standardized `paceTier` contract in exported current snapshot. |
| Pass/run tendency | **Exists (partial)** | Input schema includes `passRate`, `neutralPassRate`, `rushRate`; scoring/tagging pipeline can ingest it. | No explicit published tier enum per team in a stable external contract. |
| Explosiveness | **Exists (partial)** | Input schema includes `explosivePlayRate`, `epaPerPlay`; tags include volatility/explosive flavor. | No dedicated explosiveness contract field in current snapshot artifacts. |
| Stability/volatility | **Exists** | Separate `stabilityScore` / `volatilityScore` are generated and ranked. | Lacks single cross-repo v0 contract for direct consumption. |
| Play-caller tendencies | **Partial (seed docs/data)** | 2026 context/offensive seed artifacts include `play_caller`/`offensive_playcaller` fields and tags. | Mostly operator-seeded, many unknowns; not source-backed canonical tendency feed. |
| Vegas/market priors | **Missing** | No live market ingestion in code. | Should be added only via source-safe TIBER-Data lane. |
| Projected wins/scoring environment | **Partial** | Seed labels include `scoring_environment_label` in 2026 offense artifact. | Not sourced from governed market/projection pipeline yet. |
| Rookie landing context | **Exists (seed)** | `2026_team_landing_context_tags.json` and `2026_teamstate_context_v0.json`. | Explicitly seed/inspect-oriented; not final governed truth. |

**Bottom line:** Teamstate can already compute deterministic team environment views from structured weekly inputs and can emit inspectable seed context artifacts. It cannot yet, by itself, provide a fully governed, production `TeamEnvironmentProfile` contract that cleanly answers roster-level “good/bad/meta-aligned” with upstream source-backed guarantees.

---

## 3) Artifacts and current consumability by TIBER-Fantasy

| Artifact | Produced today | Consumable now by TIBER-Fantasy? | Notes |
| --- | --- | --- | --- |
| `output/current_snapshot.json` | Yes | **Yes (partial)** | Good quick summary for top teams and stability/volatility slices. |
| `output/current_offense_environments.json` | Yes | **Yes (partial)** | Position-scoped offense environment rows; useful for role overlays. |
| `output/current_matchup_environments.json` | Yes | **Yes (partial)** | Useful for opponent matchup context, less for intrinsic team quality. |
| `output/pipeline_metadata.json` | Yes | **Yes (supporting)** | Provenance/slice metadata for auditability. |
| `output/season_to_date.*.json` | Yes | **Yes (diagnostic)** | Rich but less compact for direct app consumption. |
| `data/processed/2026_team_offensive_environment_v0.json` | Yes | **Yes (seed/experimental)** | Labeled as seed with explicit source status. |
| `data/processed/2026_team_landing_context_tags.json` | Yes | **Yes (seed/experimental)** | Context modifiers for rookie landing interpretation. |
| `data/processed/2026_teamstate_context_v0.json` | Yes | **Yes (seed/experimental)** | Many unknown placeholders; inspect-only posture. |

---

## 4) What Teamstate can currently represent

Today, Teamstate can represent:

- deterministic week/team scoring components and final scores
- team/fantasy/matchup/stability/volatility rankings
- latest-week and season-to-date aggregates
- compact “current snapshot” top slices
- seed team context tags and offensive environment labels for 2026

Today, Teamstate does **not** yet represent (as a clean, governed product contract):

- canonical market-prior-informed team strength tiers
- canonical per-team pass/run/pace/volatility tier contract with stable enums for all downstream repos
- governed provenance links to upstream canonical source snapshots per derived value
- a direct roster-level summary endpoint/artifact (e.g., “your roster has X players tied to strong offenses”).

---

## 5) Ownership boundary: TIBER-Data vs TIBER-Teamstate

### Recommended split

| Layer | Owns | Does not own |
| --- | --- | --- |
| **TIBER-Data** | Raw/canonical inputs, source metadata/provenance/timestamps, team identity mapping, legally/source-safe market snapshots, play-level/derived base stats from governed pipelines. | Team-environment interpretation language and derived environment grades. |
| **TIBER-Teamstate** | Deterministic derived team-environment intelligence (tiers/tags/summaries), environment scoring, explainable context outputs for downstream use. | Raw evidence truth system, proprietary/paid data scraping, manual truth overrides that bypass TIBER-Data provenance. |

This matches existing Teamstate boundary docs and should remain strict.

---

## 6) Market priors / Vegas odds lane assessment

Should Teamstate eventually consume market priors? **Yes, via TIBER-Data only.**

Safe lane:

1. TIBER-Data ingests legally permitted market/projection snapshots (with source + timestamp).
2. TIBER-Data publishes governed artifacts.
3. Teamstate consumes those artifacts as read-only inputs to derive market tiers.

Out of scope / disallowed here:

- scraping paid/proprietary odds feeds
- embedding unlicensed market data directly in Teamstate

---

## 7) Internal football signal lane assessment

Signals Teamstate should consume (from TIBER-Data governed inputs) for future contract hardening:

- neutral pass rate / PROE
- early-down pass rate
- play-action rate
- pace / seconds per play
- plays per game / neutral volume
- explosive play rate
- yards per play
- EPA/play or success rate
- red-zone pass/run tendency
- OL proxy measures (if governed/available)
- QB stability/continuity
- coordinator/play-caller continuity

Repo reality today:

- several of these already exist in the TypeScript input schema (`passRate`, `neutralPassRate`, `secondsPerPlay`, `epaPerPlay`, `explosivePlayRate`, `successRate`, `redZoneTdRate`, etc.).
- governance/provenance for those fields is not fully codified in a dedicated TeamEnvironmentProfile contract yet.

---

## 8) Proposed v0 TeamEnvironmentProfile contract (for Teamstate)

This is the recommended first canonical downstream contract (derived-only, auditable, no model claims):

```ts
interface TeamEnvironmentProfileV0 {
  teamId: string;
  teamAbbr: string;
  season: number;
  generatedAt: string;
  sourceSnapshotAt: string | null;

  marketTier: "elite" | "strong" | "average" | "weak" | "unknown";
  offenseTier: "elite" | "strong" | "average" | "weak" | "unknown";
  passEnvironmentTier: "pass_heavy" | "balanced" | "run_heavy" | "unknown";
  paceTier: "fast" | "neutral" | "slow" | "unknown";
  volatilityTier: "stable" | "volatile" | "unknown";

  signals: Array<{
    name: string;
    value: number | string | null;
    source: string;
    notes?: string;
  }>;

  warnings: string[];
}
```

Implementation note: this should initially be derived from existing Teamstate outputs + metadata and should preserve upstream provenance references without inventing values.

---

## 9) Roster-state downstream use case (first target)

First downstream use case for TIBER-Fantasy:

Given a roster already mapped to NFL teams, return:

- count of players tied to **strong** team environments
- count tied to **weak** team environments
- count tied to **uncertain/provisional** environments
- concentration signal for **meta-aligned** offenses

This output should **inform** roster-state classification (contender/rebuilder/productive struggle/etc.), not replace TIBER-Fantasy’s own classification logic.

---

## 10) First three follow-up issues (ordered: lowest risk / highest usefulness)

1. **Define and emit `TeamEnvironmentProfileV0` artifact from existing outputs**
   - Docs + TypeScript contract + deterministic builder.
   - Map from current season-to-date/current snapshot artifacts.
   - Include provenance fields and `unknown` handling.

2. **Add “roster attachment summary” helper artifact (no new model)**
   - Input: roster→team mapping from TIBER-Data-owned truth.
   - Output: counts/percentages by environment tiers + concentration tags.
   - Keep logic transparent and rule-based.

3. **Integrate governed market-prior input lane via TIBER-Data artifact contract**
   - Define Teamstate ingestion contract for legal/source-safe market snapshots.
   - Add optional market-tier derivation path with explicit source timestamps.
   - No paid/proprietary scraping; no implicit data injection.

---

## 11) Validation executed for this audit

The following repo checks were run during this audit:

- `npm test` → pass
- `npm run check` → pass
- `npm run build` → pass
- `python -m unittest tests/test_team_offensive_environment.py tests/test_team_landing_context_tags.py tests/test_2026_teamstate_context.py` → pass

No additional build system beyond these commands was required to produce this document.
