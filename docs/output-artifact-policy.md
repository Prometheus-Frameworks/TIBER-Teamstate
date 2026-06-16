# `output/` Commit Policy

> Status: **policy doc** for issue #32. Documentation-only — this PR defines the policy and
> classifies the current `output/` tree. It does **not** delete, move, regenerate, or `.gitignore`
> anything, and it does **not** change builders, adapters, Fantasy consumers, scoring, Team
> Direction, or ML. Acting on the cleanup is deferred to an explicitly scoped follow-up.

## Why this policy exists

`output/` is the pipeline's generated artifact directory. Today the entire tree (32 files) is
checked into git as `fixture_scaffold`/demo data produced from sample inputs. That creates two
problems the TTS v1 boundary work flagged:

1. **Truth confusion** — broad generated demo output can be mistaken for governed or full-league
   production truth.
2. **Repo churn** — every pipeline run rewrites many files (timestamps + values), producing noisy
   diffs and merge friction for data that has no downstream consumer.

At the same time, issue #31 (merged in #33) intentionally committed **one** representative
`fixture_scaffold` artifact — `team_environment_movement_v0.json` — at TIBER-Fantasy's default
consumer path. That is legitimate and must remain allowed. This policy draws the line between the
two cases.

## Policy

### Allowed to be committed under `output/`
A generated artifact may be committed **only if all** of the following hold:

1. **It backs a real or documented downstream consumer** (a live read, or a documented consumer
   contract), so the committed file serves a purpose beyond a local run.
2. **It is a single representative sample**, not a full generated sweep.
3. **It is explicitly labeled fixture/demo provenance** — `metadata.provenanceStatus:
   fixture_scaffold` (or another non-governed label) and, where the shape supports it,
   `metadata.coverage.isFullLeague: false` (the contracted path — see
   `TeamEnvironmentMovementMetadataV0` / `TeamstateArtifactMetadataV0`; there is no top-level
   `coverage` field).
4. **It does not claim full-league, governed, or production truth** unless the input is actually
   governed and full-league (which today it is not).
5. **It is reproducible** from a committed source fixture under `data/fixtures/` (so the artifact
   can be regenerated and audited).

### Not to be committed under `output/`
- **Broad generated output with no downstream consumer.** Internal diagnostics, rankings, weekly
  states, season-to-date aggregates, and pipeline metadata should be **regenerated on demand** and
  kept out of git (e.g., `output/` git-ignored except the allowed representative fixtures, or those
  fixtures relocated to a clearly-labeled fixtures path). Implementing that exclusion is a
  follow-up; see "Deferred cleanup".
- **Anything labeled or implying `governed`/full-league truth.** Governed production artifacts are
  out of scope for the committed demo tree entirely.

### Provenance labeling requirement
Any committed `output/` artifact must make its demo status legible from the file itself — never
rely on the path or this doc alone. A reader opening the JSON must be able to see it is
`fixture_scaffold` and non-full-league.

## Current `output/` inventory (classification only — no deletion in this PR)

### Keep — representative `fixture_scaffold` contract artifacts (downstream-relevant)
Per the downstream-consumer audit (`docs/audits/teamstate-downstream-consumer-status-2026-06-15.md`),
these are the only two `output/` artifacts with a downstream consumer, and both are explicitly
`fixture_scaffold`:

| Artifact | Why kept |
| --- | --- |
| `team_environment_movement_v0.json` | Live read-only consumer in TIBER-Fantasy (Data Lab + Management diagnostic). Committed as the representative fixture at Fantasy's default path (#31 / #33). |
| `team_environment_profiles_v0.json` | Consumed by the TIBER-Fantasy offline dynasty-roster report script. Named downstream contract artifact (`docs/contracts/team-environment-profile-v0.md`). |

> Note: the legacy fantasy-point fields inside `team_environment_movement_v0.json` are a separate
> v0 contract concern tracked in #34 — **out of scope here**.

> Note on `sourceArtifacts` references: `team_environment_profiles_v0.json` lists generated
> intermediate artifact names in its `sourceArtifacts` (e.g. `season_to_date.fantasy_environment.json`,
> `season_to_date.team_power.json`, `teamstate_weekly.json`) — some of which are part of the
> generated clutter this policy stops tracking. Those intermediates are **not required to remain
> tracked in git**: the field records the derivation lineage, not a tracked-file dependency. The
> artifact is retained as a representative downstream contract fixture and is reproducible from the
> committed source fixtures under `data/fixtures/` via local pipeline generation (which writes the
> full `output/` tree, intermediates included). No artifact or schema change is implied — the
> `sourceArtifacts` values are left exactly as generated.

### Generated/demo clutter — no downstream consumer (candidates for exclusion/regeneration)
These 30 files are internal diagnostics produced by the pipeline with **no** downstream consumer
identified in the audit. Under this policy they should not accumulate in git:

- Current snapshot slices (3): `current_snapshot.json`, `current_offense_environments.json`,
  `current_matchup_environments.json`
- Latest-week reports (7): `latest_week.team_power.json`, `latest_week.fantasy_environment.json`,
  `latest_week.matchup_environment.json`, `latest_week.qb_matchups.json`,
  `latest_week.rb_matchups.json`, `latest_week.wr_matchups.json`, `latest_week.te_matchups.json`
- Rankings (7): `rankings.team_power.json`, `rankings.fantasy_environment.json`,
  `rankings.matchup_environment.json`, `rankings.qb_matchups.json`, `rankings.rb_matchups.json`,
  `rankings.wr_matchups.json`, `rankings.te_matchups.json`
- Season-to-date reports (11): `season_to_date.team_power.json`,
  `season_to_date.fantasy_environment.json`, `season_to_date.matchup_environment.json`,
  `season_to_date.qb_offense_environment.json`, `season_to_date.rb_offense_environment.json`,
  `season_to_date.wr_offense_environment.json`, `season_to_date.te_offense_environment.json`,
  `season_to_date.qb_matchups.json`, `season_to_date.rb_matchups.json`,
  `season_to_date.wr_matchups.json`, `season_to_date.te_matchups.json`
- Pipeline + full state (2): `pipeline_metadata.json`, `teamstate_weekly.json`

## Deferred cleanup (not done in this PR)

This PR is policy + classification only. The following are intentionally **not** done here and
should be scoped as an explicit follow-up cleanup PR:

- Stop committing the 30 generated/demo files (git-ignore `output/` except the allowed
  representative fixtures, or relocate the two kept fixtures to a labeled fixtures path and ignore
  the rest).
- Remove the already-committed clutter once the ignore/relocate decision is made.
- Confirm the pipeline still writes the full `output/` locally for development (behavior unchanged;
  only what is tracked in git changes).

Guardrail for the follow-up: do not break the two downstream-relevant artifacts' availability at
the paths their consumers expect, and keep #34 (v0 → v1 fantasy-point-field cleanup) separate.

## Why representative fixtures are allowed but broad output is not (summary)

- A single, clearly-labeled `fixture_scaffold` artifact that backs a real consumer is **legible and
  purposeful**: a reader knows it is demo data, and a downstream default path resolves instead of
  silently missing.
- A full generated sweep with no consumer is **noise and risk**: it churns diffs, can be mistaken
  for governed truth, and goes stale with no one reading it.
