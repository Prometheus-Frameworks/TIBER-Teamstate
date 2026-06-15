# TIBER-Teamstate Downstream Consumer Status (2026-06-15)

## Scope and framing

This is an **investigation-only** document for TIBER-Teamstate issue #27. It answers a
single question:

> Do the current Teamstate artifacts feed any downstream system today?

Guardrails respected (per the issue):

- no Teamstate→Fantasy Management wiring added
- no scoring or Team Direction logic changed
- usage is confirmed only from **actual artifact reads / imports / consumer contracts**, not
  from similar field names
- where no consumer exists, that is documented explicitly rather than inventing an integration

### Method

- Org-wide GitHub code search across `Prometheus-Frameworks` for the artifact literals
  `team_environment_profiles_v0`, `team_environment_movement_v0`, and the string
  `TIBER-Teamstate`.
- Direct inspection of the consumer files surfaced in `TIBER-Fantasy`.
- Confirmation searches against `TIBER-FORGE` and `Point-prediction-model`.
- Inspection of this repo's committed `output/` directory and artifact provenance.

The only repository that references or reads Teamstate artifacts is **`TIBER-Fantasy`**. No
other promoted TIBER repo (FORGE, Point-prediction-model, Rookies, Data, Strategy, etc.) reads
these artifacts.

---

## 1) Consumed today

### `team_environment_movement_v0` → TIBER-Fantasy (live, read-only)

- **Consumer module:** `server/modules/externalModels/teamState/teamEnvironmentMovementClient.ts`
  and `teamEnvironmentMovementService.ts`.
- **Path / config:** env `TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_PATH`, default
  `../TIBER-Teamstate/output/team_environment_movement_v0.json`.
- **Validation:** asserts the `artifact: 'team_environment_movement_v0'` literal (fails closed on
  a wrong literal) and preserves `metadata.coverage` / provenance.
- **Surfaces:**
  - Data Lab API routes `GET /api/data-lab/team-environment-movement` and
    `GET /api/data-lab/team-environment-movement/:teamAbbr`
    (`server/routes/dataLabTeamEnvironmentMovementRoutes.ts`).
  - The Management cockpit `client/src/pages/TiberManagementDashboard.tsx` consumes the route
    response (`teamstateResponse?: TeamEnvironmentMovementResponse`) and renders it as a
    **Team Direction / Management diagnostic model-signal card** (this is the "Management Phase 3"
    surface referenced in the issue).
- **Fields used:** `artifact` (literal validation), `artifactAvailable`, `provenanceStatus`,
  `inputSources`, `metadata.coverage`, per-team `movement` directions + `verdict`, `warnings`,
  and the `source` provenance block.
- **Boundary:** explicitly **read-only / visibility-only**. TIBER-Fantasy's own README and
  `MODULE.md` state movement is **not wired into FORGE scoring, rankings, projections, trade
  advice, or player truth**. Fixture/scaffold provenance stays visibly conservative downstream.

### `team_environment_profiles_v0` → TIBER-Fantasy (offline report script only)

- **Consumer module:** `server/modules/externalModels/teamState/teamEnvironmentProfilesClient.ts`.
- **Path / config:** env `TEAMSTATE_ENVIRONMENT_PROFILES_PATH`, default
  `../TIBER-Teamstate/output/team_environment_profiles_v0.json`.
- **Surfaces:** consumed only by the offline script
  `server/scripts/dynastyRosterTeamEnvironmentSummary.ts` via
  `buildDynastyRosterTeamEnvironmentSummary` (`dynastyRosterTeamEnvironmentSummaryHelper.ts`),
  which writes a one-off report `docs/reports/dynasty-roster-team-environment-summary-2026-05-25.md`.
- **Fields used:** `teamAbbr` (roster join), `offenseTier`, `passEnvironmentTier`, `paceTier`,
  `volatilityTier` (exposure tables).
- **Boundary:** **not** wired to any live API route, the Management dashboard, or scoring. It is a
  dynasty-roster exposure summary generator only.

---

## 2) Produced but not consumed (future Phase 4 planning scope)

- **No scoring/Team-Direction consumption.** Neither artifact influences any FORGE score,
  ranking, projection, Team Direction score, or advice path today. The Management consumption of
  `team_environment_movement_v0` is **diagnostic display**, not a scoring input. The contract
  doc's "intended downstream consumption (TIBER-Fantasy) … canonical team environment layer for
  roster-state reasoning" for `team_environment_profiles_v0` is **not yet realized** as a live
  Management input — that wiring is Phase 4 scope.
- **`team_environment_profiles_v0` has no live consumer** — only the offline dynasty report
  script. Promoting it into a live Management/roster-state path is Phase 4 scope.
- **No downstream consumer for the rest of the `output/` surface.** Org-wide search finds zero
  readers of: `current_snapshot.json`, `current_offense_environments.json`,
  `current_matchup_environments.json`, `pipeline_metadata.json`, `teamstate_weekly.json`, and all
  `rankings.*.json`, `latest_week.*.json`, `season_to_date.*.json`. These are produced for
  internal diagnostics / potential future use only.

---

## 3) Stale / deprecated / cleanup candidates

- **Provenance is fixture-scaffold, not governed.** The committed
  `output/team_environment_profiles_v0.json` is `provenanceStatus: "fixture_scaffold"`, 4 teams
  (DET, MIA, PIT, TEN), `isFullLeague: false`, generated `2026-05-28` from
  `data/fixtures/team_week_raw/team_week_raw_v0.sample.json`. It is a demo seed, not production
  truth. Downstream already treats it conservatively.
- **Missing committed movement artifact.** `output/team_environment_movement_v0.json` is **not
  committed** in this repo, yet TIBER-Fantasy's default consumer path points at
  `../TIBER-Teamstate/output/team_environment_movement_v0.json`. With defaults and no operator
  override, the live consumer resolves "artifact not found" (it fails closed gracefully). The
  movement artifact is only emitted when the pipeline is run against a multi-week temporal
  fixture. Worth deciding in Phase 4 whether to commit a representative fixture-scaffold movement
  artifact or document that the path is operator-supplied.
- **Committed generated `output/`.** The whole `output/` tree is checked-in generated, fixture-
  scaffold data (`.gitignore` does not exclude `output/`). It is not stale per se, but it is
  demo-only and should be regenerated (or excluded) once governed inputs land. Candidate for a
  separate cleanup issue if these committed artifacts cause confusion about "real" data.

---

## Summary

| Question | Answer |
| --- | --- |
| Does any downstream system consume Teamstate artifacts today? | **Yes — only `TIBER-Fantasy`.** |
| `team_environment_movement_v0` | Consumed live, **read-only**, as a Data Lab inspection surface + Management "Team Direction" diagnostic card. Not a scoring input. |
| `team_environment_profiles_v0` | Consumed only by an **offline dynasty-roster report script**. No live route, no Management/scoring use. |
| TIBER-FORGE scoring / alpha | **Not consumed.** Zero references. |
| Point-prediction-model | **Not consumed.** Zero references. |
| Any other promoted TIBER consumer | **None.** |
| Phase 4 readiness | Profiles → Management roster-state wiring is clean to plan as a new Phase 4 issue; movement default artifact path needs a produce/commit decision. |
</content>
</invoke>
