# Spec: Formation Lens v0 — shotgun vs. under-center tendencies

> Status: **spec — documentation only.** Resolves TIBER-Teamstate issue
> [#75](https://github.com/Prometheus-Frameworks/TIBER-Teamstate/issues/75). This document does
> not ingest play-by-play, create a production pipeline, promote an artifact, wire Fantasy or
> Forecast, create rankings, or produce fantasy advice. It defines the Teamstate interpretation
> boundary for a future human-readable formation lens while preserving TIBER-Data as the source and
> provenance owner.

## 1. Purpose

`formation_lens_v0` is a future Teamstate-facing explanation surface for observed NFL offensive
formation tendencies. The first slice is intentionally narrow: explain shotgun vs. under-center
usage in language that a football-interested human can understand.

The lens should answer questions such as:

- How often does a team operate from shotgun vs. under center?
- Does the team's run/pass split change by alignment?
- Is the team efficient from one alignment but predictable or inefficient from another?
- Is an apparent tendency strong enough to describe, or too sample-size constrained?
- What context must be preserved before interpreting the split?

This is a **teaching and interpretation surface**, not a prediction surface. It explains observed
team behavior without pretending Teamstate knows more than the source data proves.

## 2. Ownership boundary

| Layer | Owns | Does not own |
| --- | --- | --- |
| **TIBER-Data** | Raw play-by-play acquisition, source snapshots, normalization rules, play inclusion/exclusion rules, validation, source refs, provenance status, and governed promotion decisions. | Human-readable Teamstate interpretation copy or downstream product display. |
| **TIBER-Teamstate** | Deterministic team-level explanation text and tags derived from a Data-owned or explicitly fixture-scaffolded formation summary artifact. | Raw play-by-play truth, formation derivation rules, governed source claims, rankings, advice, or Forecast-ready features. |
| **TIBER-Fantasy** | Possible future display of Teamstate explanations after an approved contract exists. | Source-of-truth formation derivation or provenance. |
| **TIBER-Forecast** | Possible future model consumption only after a separate governed feature contract exists. | Consumption authorization from this spec. |

Teamstate must not become a shadow play-by-play database. If a claim depends on formation truth,
TIBER-Data must prove and publish that truth first; Teamstate may then translate it into readable
team-environment language while preserving upstream refs and provenance status.

## 3. First-slice recommendation

The first Teamstate slice should be **documentation-only and blocked from real-data interpretation
pending a TIBER-Data source/spec issue**.

A later Teamstate fixture-scaffold can be useful, but only after the upstream Data contract is
specified well enough to make the fixture's artificial status unmistakable. Until then, the safest
next action is a TIBER-Data issue that audits formation derivation from play-by-play and proposes a
source-backed summary artifact.

| Option | Recommendation | Reason |
| --- | --- | --- |
| Documentation-only Teamstate spec | **Yes, now.** | Establishes the explanation boundary and reader-facing shape without laundering unsourced data. |
| Fixture-scaffolded Teamstate artifact | **Later.** | Useful for renderer/copy tests after Data has specified the contract; must be labeled `fixture_scaffold`, not real data. |
| Real-data Teamstate interpretation | **Blocked.** | Requires Data-owned source snapshot, inclusion/exclusion rules, validation, source refs, and provenance status. |

## 4. Expected upstream Data artifact contract

A future TIBER-Data artifact should expose formation summaries at either team-season or team-week
grain. Teamstate can support both, but the artifact must declare its grain explicitly.

Minimum high-level fields:

| Field | Required? | Notes |
| --- | --- | --- |
| `artifactName` | Yes | Suggested value: `formation_summary_v0` or equivalent Data-owned name. |
| `artifactVersion` | Yes | Versioned by TIBER-Data. |
| `season` | Yes | NFL season. |
| `week` | Optional | Required only for team-week grain. Omitted or `null` for team-season grain. |
| `team` | Yes | Canonical team code as normalized by TIBER-Data. |
| `grain` | Yes | `team_season` or `team_week`. |
| `offensive_plays` | Yes | Denominator after Data-owned inclusion/exclusion rules. |
| `shotgun_plays` | Yes | Count of included offensive run/pass plays classified as shotgun. |
| `under_center_plays` | Yes | Count of included offensive run/pass plays classified as under center. |
| `shotgun_rate` | Yes | `shotgun_plays / offensive_plays`, subject to Data validation. |
| `under_center_rate` | Yes | `under_center_plays / offensive_plays`, subject to Data validation. |
| `shotgun_pass_rate` | Yes | Pass rate within shotgun plays. |
| `shotgun_run_rate` | Yes | Run rate within shotgun plays. |
| `under_center_pass_rate` | Yes | Pass rate within under-center plays. |
| `under_center_run_rate` | Yes | Run rate within under-center plays. |
| `shotgun_epa_per_play` | Optional but preferred | Efficiency from shotgun, if EPA is source-backed for the included play set. |
| `under_center_epa_per_play` | Optional but preferred | Efficiency from under center, if EPA is source-backed for the included play set. |
| `shotgun_success_rate` | Optional but preferred | Success-rate definition must be declared upstream. |
| `under_center_success_rate` | Optional but preferred | Success-rate definition must be declared upstream. |
| `sample_notes` | Yes | Data-authored sample warnings or exclusion notes. |
| `sourceRefs` | Yes | Source snapshot/version references owned by Data. |
| `provenanceStatus` | Yes | Examples: `fixture_scaffold`, `partial_real_data`, `governed_real_data`; promotion owned by Data. |
| `generatedAt` | Yes | Data artifact timestamp. |

Teamstate should preserve provenance and source refs in any emitted explanation object. It should not
infer governance from file path, file name, or downstream desire.

## 5. Reader-facing Teamstate explanation format

A future Teamstate output should separate numeric facts, confidence/sample warnings, and prose. A
suggested shape:

```json
{
  "kind": "formation_lens_v0",
  "season": 2025,
  "week": null,
  "team": "LAR",
  "grain": "team_season",
  "provenanceStatus": "fixture_scaffold",
  "sourceArtifact": "TIBER-Data formation_summary_v0 artifact ref",
  "formationSummary": {
    "shotgunRate": 0.72,
    "underCenterRate": 0.28,
    "shotgunPassRate": 0.66,
    "shotgunRunRate": 0.34,
    "underCenterPassRate": 0.31,
    "underCenterRunRate": 0.69,
    "shotgunEpaPerPlay": 0.08,
    "underCenterEpaPerPlay": 0.01,
    "shotgunSuccessRate": 0.47,
    "underCenterSuccessRate": 0.42
  },
  "sampleWarnings": [
    "Under-center sample is modest; describe directionally, not as a stable identity claim."
  ],
  "labels": ["shotgun_heavy", "under_center_run_lean"],
  "plainEnglish": [
    "This team is shotgun-heavy overall.",
    "Its under-center looks are used mostly for rushing.",
    "Formation is context, not destiny: down, distance, score, personnel, opponent, and game script still matter."
  ]
}
```

### Suggested label vocabulary

| Label | Meaning | Guardrail |
| --- | --- | --- |
| `shotgun_heavy` | Shotgun rate is materially high versus the chosen comparison baseline. | Baseline must be declared; do not hard-code league claims without source-backed league context. |
| `balanced_alignment_mix` | Shotgun and under-center rates are both meaningful. | Requires enough sample in both buckets. |
| `under_center_meaningful` | Under-center usage is large enough to discuss as a real part of the offense. | Does not imply old-school/playbook identity by itself. |
| `shotgun_pass_lean` | Pass rate from shotgun is materially higher than team or league comparison baseline. | Must account for game script where possible. |
| `under_center_run_lean` | Run rate from under center is materially higher than team or league comparison baseline. | Do not equate with predictability unless backed by split and context. |
| `small_under_center_sample` | Under-center count is too low for strong claims. | Should suppress strong prose and efficiency conclusions. |
| `small_shotgun_sample` | Shotgun count is too low for strong claims. | Rare at NFL team-season grain but possible in narrow slices. |
| `efficiency_split_context_only` | EPA/success differs by alignment, but explanatory context is incomplete. | Avoid causal claims. |

### Plain-English note patterns

Allowed examples:

- "This team is shotgun-heavy and pass-biased from shotgun."
- "This team uses under-center looks mostly for early-down rushing."
- "This team has a meaningful under-center package, but the efficiency split should be read with game-script context."
- "The under-center sample is too small to support a strong conclusion."
- "Formation is context, not destiny: down, distance, score, personnel, opponent, and game script matter."

Forbidden examples:

- "This team runs Shanahan concepts" unless source-backed by a separate approved concept taxonomy.
- "This team will be better for fantasy" or any start/sit, waiver, trade, dynasty, or ranking advice.
- "This formation split caused the efficiency difference" without a governed causal methodology.
- "Every non-shotgun play is under center" unless Data has explicitly validated that derivation.

## 6. Derivation risks TIBER-Data must solve first

The most important derivation guardrail is that Teamstate must **not** blindly treat every
non-shotgun row as under center. A candidate under-center rule might be:

```text
offensive_play && shotgun == 0 && play_type in ["run", "pass"]
```

That rule is not safe until TIBER-Data audits and documents at least the following risks:

1. **Kneels and spikes** — whether they are excluded from offensive tendency denominators.
2. **No-plays and penalty-only rows** — whether formation flags on erased plays should count.
3. **Special teams and two-point attempts** — whether they are excluded from offensive-snap accounting.
4. **Missing or ambiguous formation values** — whether they form a third bucket instead of being forced into under center.
5. **Designed QB runs, scrambles, sacks, and aborted plays** — how play type and pass/run splits are normalized.
6. **Shotgun flag semantics** — whether source `shotgun` means alignment at snap, charted formation, or a derived field.
7. **Pistol and other non-under-center looks** — whether they are separate, included in shotgun, or excluded from the binary split.
8. **Motion/shift/personnel claims** — not inferable from shotgun vs. under-center fields unless separately sourced.
9. **Down, distance, score, and game script** — needed before making predictability or identity claims too strong.
10. **Opponent and era baselines** — needed before saying "high" or "low" relative to league context.
11. **Sample-size thresholds** — minimum counts for labels, efficiency comparisons, and warning suppression.
12. **EPA/success definitions** — must be source-backed and stable before Teamstate explains efficiency by alignment.
13. **Temporal cutoffs** — team-week and team-season summaries must declare what games are included.
14. **Governance markers** — artifact promotion must be explicit and Data-owned, never inferred by Teamstate.

If these are unresolved, Teamstate may document the intended interpretation shape but must withhold
real-data prose or label it as fixture-only.

## 7. Non-goals for `formation_lens_v0`

This spec does not authorize Teamstate to:

- ingest raw play-by-play;
- define or mutate Data-owned formation derivation rules;
- promote any artifact as governed;
- infer full playbook concepts, route concepts, motion, shift, or personnel truth without source-backed fields;
- create fantasy rankings or start/sit, trade, waiver, or dynasty advice;
- wire Forecast features or claim model-readiness;
- change Fantasy UI; or
- use the lens as a scoring/ranking input.

## 8. Acceptance summary

- The Teamstate boundary is a human-readable explanation layer over Data-owned formation summaries.
- The first slice should remain documentation-only in Teamstate and blocked from real-data
  interpretation pending TIBER-Data source/spec work.
- The expected upstream artifact is a Data-owned team-season or team-week formation summary with
  explicit grain, denominators, split rates, optional efficiency fields, source refs, provenance
  status, sample notes, and generation metadata.
- The first reader-facing format should expose numeric split facts, sample warnings, conservative
  labels, and plain-English notes that preserve context and uncertainty.
- The major derivation risks are denominator safety, non-shotgun classification, ambiguous/missing
  formation values, excluded play types, baseline/sample handling, and governance/provenance.

## 9. Recommended next issue

Open a **TIBER-Data source/spec issue** for `formation_summary_v0` before any Teamstate fixture or
real-data lens work. That issue should audit play-by-play formation derivation, define inclusion and
exclusion rules, declare sample thresholds, specify source/provenance fields, and decide whether the
first artifact grain is team-season, team-week, or both.

After that Data issue exists, Teamstate can open a follow-up fixture-scaffold documentation issue for
`formation_lens_v0` renderer/copy examples that are clearly marked `fixture_scaffold` and barred
from production interpretation.
