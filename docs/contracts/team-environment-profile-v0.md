# Team Environment Profile V0

## Purpose
`team_environment_profiles_v0` is Teamstate's first governed downstream contract for compact team-level environment signals. It is designed for later TIBER-Fantasy roster-state reasoning and is built only from existing Teamstate outputs.

## Artifact
- Output path: `output/team_environment_profiles_v0.json`
- Shape:
  - `artifact`: `team_environment_profiles_v0`
  - `generatedAt`: ISO timestamp
  - `sourceArtifacts`: source artifact names used by derivation
  - `metadata`: provenance + coverage metadata (`TeamstateArtifactMetadataV0`)
  - `profiles`: `TeamEnvironmentProfileV0[]`

## Contract fields
Each profile row contains:
- Identity/time: `teamId`, `teamAbbr`, `season`, `generatedAt`, `sourceSnapshotAt`
- Lanes:
  - `marketTier`: intentionally `unknown` in v0
  - `offenseTier`: derived from `fantasyEnvironmentScore`
  - `passEnvironmentTier`: derived from `neutralPassRate`
  - `paceTier`: derived from `secondsPerPlay`
  - `volatilityTier`: derived from `volatilityScore`
- `signals`: auditable source metrics used for derivation
- `warnings`: lane-level warning messages when unknown or intentionally unavailable

## Derivation rules (v0)
- `marketTier`
  - Always `unknown`.
  - Warning: no governed market-prior input artifact exists yet.
- `offenseTier` from season-to-date `fantasyEnvironmentScore`
  - `elite >= 85`
  - `strong >= 70`
  - `average >= 50`
  - `weak < 50`
  - `unknown` when score missing
- `passEnvironmentTier` from season-to-date `neutralPassRate`
  - `pass_heavy >= 0.57`
  - `run_heavy <= 0.43`
  - `balanced` otherwise
  - `unknown` when missing
- `paceTier` from season-to-date `secondsPerPlay`
  - `fast <= 27.0`
  - `slow >= 29.0`
  - `neutral` otherwise
  - `unknown` when missing
- `volatilityTier` from season-to-date `volatilityScore`
  - `stable <= 45`
  - `volatile >= 60`
  - `unknown` in neutral middle band `(45, 60)` or when missing

## Source boundaries
- Teamstate uses only existing Teamstate-produced outputs and aggregates.
- No new model, no external ingest, no odds/market scrape, no Vegas priors.
- `marketTier` stays `unknown` until TIBER-Data publishes a governed market-prior lane.

## Intended downstream consumption (TIBER-Fantasy)
- Consume this artifact as the canonical team environment layer per team+season.
- Map roster players to team via TIBER-Data ownership truth, then apply Teamstate profile lanes for roster-state grouping.
- Treat `unknown` as explicit missing/withheld information; do not fabricate replacements downstream.


## Provenance and coverage metadata (v0)
`metadata` exposes machine-readable safety context for downstream consumers.

- `provenanceStatus`: one of `fixture_scaffold | sample | partial_real_data | governed_real_data | unknown_provenance`
- `provenanceNotes`: conservative explanations for how status was assigned
- `generatedAt`: artifact generation timestamp
- `inputSources[]`: source path + type (`sample | fixture | generated | governed_artifact | unknown`) inferred from normalized repo-relative location (for example, `data/sample/` or `fixtures/`)
- `coverage`:
  - `teamCount`, `expectedTeamCount`, `isFullLeague`
  - `presentTeams`, `missingTeams`, `unexpectedTeams`
  - `seasons`, `weeks`, `latestWeek`
  - `gamesPerTeamMin`, `gamesPerTeamMax`

### Guardrails
- Never label `governed_real_data` unless input provenance is explicit and coverage is full-league.
- If input source cannot be proven, use `unknown_provenance`.
- Incomplete team coverage (`teamCount < 32`) must keep `isFullLeague: false` and must not be promoted to governed production truth.
