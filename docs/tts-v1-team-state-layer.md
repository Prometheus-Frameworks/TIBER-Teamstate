# TIBER-Teamstate (TTS) v1 — Observed NFL Team-State Layer

> Status: **decision / boundary doc** for issue #29. Documentation-only — no scoring,
> wiring, ML, or artifact behavior changes are made by this document. It defines the v1
> identity, artifact families, score/confidence semantics, the Phase 4 consumption
> boundary, and the artifact-hygiene decisions that precede deeper Management integration.

## Purpose

TIBER-Teamstate (TTS) is the **observed NFL team-state layer**. It describes the football
reality of a team from results and the environment around the players on that team. It does
not make player decisions and does not produce fantasy outputs.

This builds on prior boundary work:

- `docs/teamstate-boundary-may-tiber-data.md` — TTS is the interpretation layer, not source
  truth (TIBER-Data owns governed source/provenance truth).
- `docs/contracts/team-environment-profile-v0.md` — the v0 profile contract.
- `docs/audits/teamstate-downstream-consumer-status-2026-06-15.md` — confirmed TIBER-Fantasy
  is the only downstream consumer today, and flagged the artifact-hygiene items resolved below.

---

## 1. What TTS owns

TTS owns the **observed** state of NFL teams, derived from results and governed upstream inputs:

- **Observed NFL team reality from results** — what actually happened on the field.
- **Team-level environment context** — the conditions around players on a team.
- **Offensive environment** — how friendly an offense is as an observed environment.
- **Whole team state** — the broader observed state of the football team (offense + defense +
  game-control + volatility).
- **Environment movement over time** — directional change across observed windows.
- **Source / provenance / confidence semantics** — how trustworthy each observation is, and
  where it came from.

## 2. What TTS does **not** own

TTS is explicitly **not**:

- a **fantasy points** model;
- a **dynasty rankings** layer;
- a **player rankings** layer;
- a **trade / start-sit / advice** system;
- a **FORGE Alpha** input by default;
- **PPM (Point-prediction-model) projection math**;
- a **machine-learning experiment** — no ML in v1 unless separately governed later.

TTS describes the **team environment around players**; it does not rank players or make player
decisions.

---

## 3. Proposed v1 artifact families

**Decision (issue #29, required decision 1): emit three separate artifact families, not one
combined artifact.** Separate artifacts keep each observation's provenance, coverage, and
confidence independently auditable and let consumers read only what they need (Fantasy already
reads movement independently).

### `team_offensive_environment_v1`
Purpose: describe how friendly an NFL offense is as an observed environment. Team-level only —
no player ranking, no fantasy projection. Possible observed drivers: plays per game, pass rate,
neutral-script pass tendency, pace, red-zone trips, scoring-drive rate, yards per drive,
offensive TD rate, sacks/turnover drag, usage-environment stability.

### `team_state_profile_v1`
Purpose: describe the broader observed state of an NFL team — answering "what is the current
observed state of this football team?" Possible observed drivers: offensive environment,
defensive/DST strength, point differential, opponent-adjusted performance, turnover margin,
explosive plays created/allowed, game-control profile, volatility, stability vs
collapse/improvement indicators.

### `team_environment_movement_v1`
Purpose: describe directional change over time. Likely the most important near-term artifact
because Fantasy already has a read-only movement surface. Movement labels: `improving`,
`declining`, `stable`, `volatile_noisy`, `insufficient_evidence`. Possible deltas: pace,
pass-rate, scoring-environment, defensive-strength, volatility, team-efficiency.

> v0 → v1 note: the existing v0 artifacts (`team_environment_profiles_v0`,
> `team_environment_movement_v0`) remain the current shipped surface. The v1 families are the
> forward target; this doc does not migrate or rename v0 artifacts.

---

## 4. Score vs. confidence semantics

If TTS emits scores, **value and confidence are separate axes**:

- **`score` = the observed team-state value.** What the team's observed reality is.
- **`confidence` = how trustworthy that observation is** — its completeness, recency, and
  provenance.

Confidence accounts for: source provenance, sample size, recency, full-league coverage,
fixture-scaffold vs governed source, missing-artifact state, and stability of the observed
signal.

**The two axes are independent:**

- A **good** team score can have **low** confidence (e.g., strong but on a thin/early or
  fixture-scaffold sample).
- A **bad** team score can have **high** confidence (e.g., clearly weak across a full-league,
  governed, recent sample).

Consumers must never collapse `score` and `confidence` into a single number, and must surface
low confidence rather than hide it.

---

## 5. Phase 4 consumption boundary

**Decision (issue #29, required decision 5):**

Fantasy **may** consume Teamstate in Phase 4 as:

- **read-only diagnostic display**;
- a **Management evidence panel**;
- **Team Direction context** (shown as evidence, not weighted).

Fantasy **may not**, in Phase 4:

- feed Teamstate into **scoring, rankings, projections, or advice**;
- apply Teamstate as a **Team Direction weighting / scoring input**;
- treat fixture-scaffold provenance as governed truth.

Any move from read-only context to scoring/advice/weighting requires a **later explicit gate**
(a separate, governed decision) — it is out of scope for issue #29 and Phase 4 as defined here.

This preserves the current observed state: per the consumer audit, Fantasy's movement
consumption is already diagnostic-only and is explicitly not wired into FORGE scoring,
rankings, projections, or advice.

---

## 6. Provenance states (v1)

**Decision (issue #29, required decision 4): allowed v1 provenance states are**

| State | Meaning |
| --- | --- |
| `fixture_scaffold` | Demo / fixture data; never governed production truth. |
| `source_backed` | Derived from real source-backed inputs, not yet fully governed. |
| `governed` | Governed production truth (full-league, governed upstream provenance). |
| `stale` | Previously valid observation now past its recency window. |
| `unavailable` | Artifact missing / not produced; must be surfaced as missing, not faked. |

> Relationship to current v0 code (no change made here): the v0 `TeamstateProvenanceStatus`
> enum is `fixture_scaffold | sample | partial_real_data | governed_real_data |
> unknown_provenance`. The v1 vocabulary above is the forward target; reconciling the v0 enum
> to v1 is a follow-up implementation decision, not part of this docs-only PR.

Guardrail: **never relabel `fixture_scaffold` as governed**, and **never present an
`unavailable` artifact as available**.

---

## 7. Artifact-hygiene decisions

These are recorded as **decisions/recommendations**. Per the docs-only scope, this PR does not
commit or delete any artifact; the actual file changes are tracked as small follow-up hygiene
tasks.

### 7.1 `team_environment_profiles_v0` is fixture-scaffold / demo-only
The committed `output/team_environment_profiles_v0.json` is `provenanceStatus:
fixture_scaffold`, 4 teams (DET/MIA/PIT/TEN), `isFullLeague: false`, generated from a sample
fixture. **Decision: it remains explicitly demo-only and must not be treated as governed
truth** by any consumer. It is retained as a labeled representative sample, not promoted.

### 7.2 Movement default path points to a non-committed artifact
`output/team_environment_movement_v0.json` is **not committed**, yet Fantasy's default consumer
path (`TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_PATH`) defaults to
`../TIBER-Teamstate/output/team_environment_movement_v0.json`. Today this resolves to a
graceful fail-closed "not found".

**Decision (issue #29, required decision 2): commit a single representative
`fixture_scaffold` movement artifact** at the documented default path so the path resolves with
clearly-labeled demo provenance, instead of an absent file. Rationale: Fantasy already defaults
to this path; a labeled fixture-scaffold artifact is more legible than an unexplained miss and
does not "make a missing artifact look governed" because its provenance stays `fixture_scaffold`.

- Alternative considered: document the path as strictly operator-supplied and leave it absent.
  Rejected as the default because it leaves the shipped default path broken-by-design.

**Status: done (issue #31).** `output/team_environment_movement_v0.json` is now committed as a
representative `fixture_scaffold` artifact. It carries the `team_environment_movement_v0` literal,
`metadata.provenanceStatus: fixture_scaffold`, and `coverage.isFullLeague: false` (2 teams,
DET/PIT, weeks 1–6) so it cannot be confused with governed or full-league truth. It is generated
deterministically from the committed source fixture
`data/fixtures/team_week_raw/team_week_raw_v0.movement_demo.sample.json`. To regenerate **only**
this artifact without rewriting the rest of `output/`, run the pipeline into a scratch directory
and copy the single file back:

```bash
npm run build
node dist/src/pipeline/runTeamStatePipeline.js \
  data/fixtures/team_week_raw/team_week_raw_v0.movement_demo.sample.json /tmp/tts-movement
cp /tmp/tts-movement/team_environment_movement_v0.json output/team_environment_movement_v0.json
```

(The fixture is multi-week so the demo shows real directional movement — DET improving, PIT
declining with worsening pressure — rather than `insufficient_data`. Only `generatedAt` changes
between runs.)

**Known v0 boundary debt — legacy fantasy-point fields.** The committed v0 artifact still exposes
fantasy-point fields (`fantasyPointsForQB/RB/WR/TE`) inside `earlyWindow.averages`,
`lateWindow.averages`, and `deltas`. These are **required, non-optional fields of the current
`team_environment_movement_v0` contract** (`TeamEnvironmentMovementWindowAveragesV0`, with deltas
derived via `Omit<…, 'volatilityScore'>`), they are always emitted by the movement builder
(`MOVEMENT_METRICS`), and the upstream input adapter lists them in `REQUIRED_NUMERIC_FIELDS`. They
are also part of the shape the live TIBER-Fantasy consumer validates. Per the TTS v1 boundary
(Teamstate does not own fantasy outputs), these fields should not exist on a team-state movement
artifact. They are **not silently removed here** because that would be a contract/adapter/builder
change with a live downstream consumer — out of scope for this fixture-only PR. Removal is tracked
as a v0 → v1 boundary-cleanup follow-up (issue #34).

### 7.3 Committed `output/` tree policy
The entire `output/` tree is currently checked-in generated, fixture-scaffold data (`.gitignore`
does not exclude `output/`). **Decision (issue #29, required decision 3): move toward a policy
where only a small set of clearly-labeled representative `fixture_scaffold` artifacts is
committed, and full generated output is regenerated on demand / git-ignored.** This reduces the
risk of demo data being mistaken for governed truth.

- This is a **follow-up hygiene task** (separate PR); it changes repo artifact policy and is out
  of scope for this docs-only decision PR.

---

## Decision summary

| Required decision | Resolution |
| --- | --- |
| 1. Combined vs separate v1 artifacts | **Separate** — `team_offensive_environment_v1`, `team_state_profile_v1`, `team_environment_movement_v1`. |
| 2. Movement v0 committed fixture vs operator-supplied | **Done** — committed a labeled `fixture_scaffold` movement artifact at the default path in #31 / #33. |
| 3. Committed `output/` tree policy | **Commit only labeled representative fixtures; regenerate/ignore full output** (follow-up hygiene task). |
| 4. Allowed provenance states | `fixture_scaffold`, `source_backed`, `governed`, `stale`, `unavailable`. |
| 5. Phase 4 Fantasy consumption | **Read-only diagnostic / evidence / Team Direction context only**; no scoring/advice/weighting without a later explicit gate. |

## Guardrails honored

- No Fantasy wiring, no scoring-logic changes, no ML, no player ranking/advice language.
- Fixture/demo provenance is stated, never hidden; missing artifacts are not presented as
  available.
- Documentation-only, small and reviewable; no code behavior changes.
