# `teamstate_public_offensive_environment_2024_v1` Report Contract

## Status

- **Owning issue:** [TIBER-Teamstate #83](https://github.com/Prometheus-Frameworks/TIBER-Teamstate/issues/83)
  — contract design only.
- **Authorized by:** [TIBER-Ops #11](https://github.com/Prometheus-Frameworks/TIBER-Ops/issues/11) /
  [TIBER-Ops PR #12](https://github.com/Prometheus-Frameworks/TIBER-Ops/pull/12) /
  `docs/architecture/public-knowledge-and-agent-discovery-v0.md`. Final Ops decision:
  `may_open_teamstate_public_report_contract_issue`.
- **Technical evidence:** [TIBER-Teamstate PR #80](https://github.com/Prometheus-Frameworks/TIBER-Teamstate/pull/80) /
  `docs/audits/teamstate-2024-offensive-environment-public-report-readiness-audit-2026-07-10.md`.
- **Phase:** Phase 2 only — contract design, **zero publication code**. This document contains no
  derivation code, no validator code, no routes, no `service-metadata.json` changes, and does not
  enable publication. Current state is unchanged and stays unchanged:

  ```json
  { "service": "tiber-teamstate", "status": "deployment_scaffold", "public_reports": [], "artifact_publication_enabled": false }
  ```

- **What this document is not:** an implementation, a validator, a route, or an authorization to
  build one. Phase 3 (implementation) is a separate, later issue this document does not open.
- **Revision note:** this contract was narrowed after review to exclude `passRate`, `rushRate`,
  `successRate`, and `explosivePlayRate` (§2, §3, §12) once their true weighting denominator was
  identified as a real, already-computed TIBER-Data quantity (`competitive_plays`) that the
  governed artifact doesn't yet expose — matching, rather than approximating around, the same
  standard already applied to `passEpaPerPlay`/`rushEpaPerPlay`. The report is smaller than
  originally scoped as a result; that is the intended outcome of "prefer a smaller truthful report
  over a broader speculative one" (TIBER-Ops #11).

---

## 1. Declared scope and coverage contract

```json
{
  "artifact": "teamstate_public_offensive_environment_2024_v1",
  "season": 2024,
  "phase": "regular_season",
  "sourceGrain": "team_week_governed_observed",
  "reportGrain": "team_season_deterministic_derivation",
  "expectedTeams": ["ARI","ATL","BAL","BUF","CAR","CHI","CIN","CLE","DAL","DEN","DET","GB","HOU","IND","JAX","KC","LAC","LAR","LV","MIA","MIN","NE","NO","NYG","NYJ","PHI","PIT","SEA","SF","TB","TEN","WAS"],
  "expectedTeamCount": 32,
  "expectedTeamGameRows": 544,
  "expectedGamesPerTeam": 17,
  "outputMeaning": "historical_observed_comparison",
  "dataThrough": "2025-01-05",
  "dataThroughSource": "pinned_contract_constant_public_nfl_schedule_not_adapter_derived"
}
```

`outputMeaning: historical_observed_comparison` is an explicit, machine-checkable non-claim: this
report is not current-state, not a forecast, not a ranking recommendation, and not advice. It
describes what happened in the governed 2024 regular season, nothing else.

**`dataThrough` is a pinned contract constant, not derived from `teamWeekRawV0GovernedAdapter`
output.** The adapter's row shape carries `season`/`week`/`teamCode`/`opponentCode` plus metrics —
no game-date field. `2025-01-05` (the real-world final date of the 2024 NFL regular season, Week
18) is declared here the same way `expectedTeamCount: 32` and `expectedTeamGameRows: 544` are
declared: as a fixed property of this report's historical scope, checked for internal consistency
against the adapter's actual week range (1–18 present), not computed from adapter rows at runtime.
See §7 and §12 for why, and the upstream field that would let a future revision derive it instead.

**Coverage check (all must hold; any failure → withhold per §8/§9, never partial-publish):**

1. `presentTeams` (from `teamWeekRawV0GovernedAdapter` output) equals `expectedTeams` as a set —
   `missingTeams == []` and `unexpectedTeams == []`.
2. `actualTeamGameRows == expectedTeamGameRows` (544).
3. For every present team, that team's row count equals `expectedGamesPerTeam` (17). Verified
   directly against the committed governed source: every one of the 32 teams has exactly 17 rows
   (weeks 1–18 minus one bye week each, no synthetic bye rows).
4. The upstream governance markers the adapter already requires are present and unchanged:
   `provenanceStatus: "governed_real_data"`, `governance.governanceStatus: "governed"`,
   `governance.governanceSource: "explicit_marker"`.

This is a scope-relative check (per the TIBER-Ops architecture, `declared_scope`/`expected_entities`
§3), not a generic "full-league" rule — it happens to require all 32 teams because that is what
*this* report declares, and it is what the governed source actually has.

---

## 2. Field inclusion/exclusion matrix

Every field present in `TeamWeekRawGovernedRow` (`src/adapters/teamWeekRawV0GovernedAdapter.ts`)
gets an explicit disposition. None is included by default because it happens to be available.

| Field | Disposition | Reason |
| --- | --- | --- |
| `pointsFor` | **Included** | Core observed offensive output; season total + per-game (§3) |
| `offensivePlays` | **Included** | Core play-volume count; season total + per-game (§3) |
| `neutralPlays` | **Included** | Core neutral-script play-volume count; season total + per-game (§3) |
| `secondsPerPlay` | **Included** | Pace signal; play-weighted season average, denominator confirmed by upstream provenance notes (§3) |
| `epaPerPlay` | **Included** | Core offensive-efficiency signal; play-weighted, denominator confirmed by upstream provenance notes (§3) |
| `neutralPassRate` | **Included** | Neutral-script pass identity; exactly reconciled, `neutralPlays`-weighted (§3) |
| `drives` | **Included** | Core drive-volume count; season total + per-game (§3) |
| `pointsPerDrive` | **Included** | Core scoring-efficiency signal; exactly reconciled, `drives`-weighted (§3) |
| `redZoneTrips` | **Included** | Core red-zone opportunity count; season total + per-game (§3) |
| `redZoneTdRate` | **Included** | Core red-zone efficiency signal; exactly reconciled, `redZoneTrips`-weighted, null-aware (§3) |
| `sacksAllowed` | **Included** | Core pass-protection signal; season total + per-game (§3) |
| `turnovers` | **Included** | Core ball-security signal; season total + per-game (§3) |
| `passRate` | **Blocked pending upstream denominator field** | True per-row denominator is not `offensivePlays` (proven non-integer, §3) and is not reconstructable from emitted fields. TIBER-Data's governed builder already computes the correct denominator internally as `TeamGameStats.competitive_plays` (`passRate = pass_plays / competitive_plays`) but does not currently expose it in `team_week_raw_v0`. Not authorized for weighted-proxy approximation; excluded from v1 (§12). |
| `rushRate` | **Blocked pending upstream denominator field** | Same reason as `passRate` — `rushRate = rush_plays / competitive_plays`, `competitive_plays` not exposed. |
| `successRate` | **Blocked pending upstream denominator field** | Same category — `success_count / competitive_plays`, `competitive_plays` not exposed. |
| `explosivePlayRate` | **Blocked pending upstream denominator field** | Same category — `explosive_count / competitive_plays`, `competitive_plays` not exposed. |
| `passEpaPerPlay` | **Blocked pending upstream denominator field** | Correct weighting needs the exact pass-play count. It is not `offensivePlays × passRate` — proven non-integer on real rows (§3, evidence). Not authorized for approximation; excluded from v1. |
| `rushEpaPerPlay` | **Blocked pending upstream denominator field** | Same reason as `passEpaPerPlay`. |
| `pointsAgainst` | **Excluded** | `pointsAgainst` characterizes the *opponent's* offensive output against this team's defense, not this team's offensive environment. Including it — even as context — would blur this report's declared scope (offensive environment only) toward a team/defensive-performance report, which is a separately scoped future question, not this one. |
| `pressureRateAllowed` | **Excluded (withheld)** | `deferred`, 544/544 null upstream; unavailable, never zero-filled (PR #80). |
| `fantasyPointsForQB/RB/WR/TE` (4 fields) | **Excluded (withheld)** | 544/544 null / absent in practice; stripped at the governed-adapter boundary already (PR #80). |
| `fantasyPointsAllowedQB/RB/WR/TE` (4 fields) | **Excluded (withheld)** | Same as above. |

**12 fields included** with full methodology (§3). **6 fields blocked** pending the same,
well-specified upstream gap: TIBER-Data exposing `competitive_plays` (for `passRate`, `rushRate`,
`successRate`, `explosivePlayRate`) and exact pass-/rush-play denominators (for `passEpaPerPlay`,
`rushEpaPerPlay`) in `team_week_raw_v0` (§12). **1 field excluded** on declared-scope grounds
(`pointsAgainst`). **9 fields withheld** (`pressureRateAllowed` + 8 fantasy split fields). This
accounts for all 28 metric fields in the governed row shape.

---

## 3. Field-by-field aggregation methodology

### Weighting-denominator precision note (read before the table)

Before assigning a weighting denominator to any rate field, each candidate denominator was checked
against the committed governed source (`data/governed/team_week_raw_v0_2024_real_source_candidate.json`,
all 544 rows unless noted as a sample check):

- **Exactly reconciled, full dataset:** `pointsPerDrive × drives == pointsFor` holds (within
  floating-point tolerance) on **all 544 rows**. `drives` is the field's true denominator.
- **Exactly reconciled, full dataset:** `redZoneTdRate × redZoneTrips` is an integer (the TD count)
  on every non-null row; `redZoneTdRate` is null on exactly the 11 rows where `redZoneTrips == 0`,
  and non-null everywhere `redZoneTrips > 0`. `redZoneTrips` is the field's true denominator, and
  the null pattern is exactly "zero opportunities," not missing data.
- **Confirmed by upstream provenance text, not independently re-derived:** the governed source's
  own `metadata.provenanceNotes` states `secondsPerPlay`'s denominator is "the full competitive
  offensive-play count (the same set used for epaPerPlay)" — i.e. `offensivePlays`. This is taken
  as authoritative for both `secondsPerPlay` and `epaPerPlay`.
- **Exactly reconciled, 100-row sample:** `neutralPassRate × neutralPlays` is an integer on every
  sampled row (avg. fractional deviation 0.0). `neutralPlays` is `neutralPassRate`'s true
  denominator.
- **Resolved, not just disproven:** `passRate`, `rushRate`, `successRate`, and `explosivePlayRate`
  do **not** cleanly divide by `offensivePlays`. Proof: ARI, 2024 week 1 —
  `offensivePlays = 60`, `passRate = 0.644068`. `60 × 0.644068 = 38.644`, not an integer.
  `59 × 0.644068 = 38.000`, an exact integer — the field's true per-row denominator is `59`, one
  less than `offensivePlays` for this row (`passRate + rushRate == 1.0` on every row, confirming
  the two share *a* consistent denominator, just not `offensivePlays`). A 100-row sample shows the
  same pattern for `successRate`/`explosivePlayRate` (average fractional deviation against
  `offensivePlays`: ~0.15–0.17). **This is not an open question** — per review, TIBER-Data's
  governed builder already computes the exact denominator internally as
  `TeamGameStats.competitive_plays` (`offensivePlays` uses the broader `OFFENSIVE_PLAY_TYPES` set;
  `competitive_plays` counts only pass/run plays, explaining the gap). The governed
  `team_week_raw_v0` artifact and `teamWeekRawV0GovernedAdapter` simply do not currently expose
  `competitive_plays`. Because the correct denominator is known but not available at this
  contract's data boundary, these four fields are **excluded from v1** (§2) rather than published
  against an admittedly-imprecise proxy — see §12 for the exact upstream ask.

### Global conventions

- **Precision policy:** all season-level aggregation is computed at full floating-point precision;
  rounding is applied exactly once, to the final published value, never to intermediate sums.
  Rounding is round-half-away-from-zero at the stated precision.
- **Observed vs. derived:** a `*Total` field is a direct sum of observed weekly values (no formula
  judgment beyond addition — classified **observed**). A `*PerGame` field or a weighted-average
  field applies a division/weighting decision (classified **derived**).
- **`gamesPlayed`:** every team's count of governed rows for the season (17 for every team in this
  scope, per §1's coverage check) — computed per team, not hardcoded, so the formulas generalize if
  a future season's schedule length changes.

### Count fields — season total (observed) + per-game (derived), unweighted

| Source field | Output fields | Unit | Formula | Null behavior | Precision |
| --- | --- | --- | --- | --- | --- |
| `pointsFor` | `pointsForTotal`, `pointsForPerGame` | points | `Total = Σ pointsFor`; `PerGame = Total / gamesPlayed` | Never null in governed source (0/544); reject if any row is null (§9) | Total: integer. PerGame: 1 decimal |
| `offensivePlays` | `offensivePlaysTotal`, `offensivePlaysPerGame` | plays | Same pattern | Same | Total: integer. PerGame: 1 decimal |
| `neutralPlays` | `neutralPlaysTotal`, `neutralPlaysPerGame` | plays | Same pattern | Same | Total: integer. PerGame: 1 decimal |
| `drives` | `drivesTotal`, `drivesPerGame` | drives | Same pattern | Same | Total: integer. PerGame: 1 decimal |
| `redZoneTrips` | `redZoneTripsTotal`, `redZoneTripsPerGame` | trips | Same pattern | Same | Total: integer. PerGame: 1 decimal |
| `sacksAllowed` | `sacksAllowedTotal`, `sacksAllowedPerGame` | sacks | Same pattern | Same | Total: integer. PerGame: 1 decimal |
| `turnovers` | `turnoversTotal`, `turnoversPerGame` | turnovers | Same pattern | Same | Total: integer. PerGame: 1 decimal |

### Rate fields — exactly-reconciled weighting (derived)

| Source field | Output field | Unit | Formula | Weighting denominator | Null behavior | Precision |
| --- | --- | --- | --- | --- | --- | --- |
| `neutralPassRate` | `neutralPassRate` | rate [0,1] | `Σ(neutralPassRate_w × neutralPlays_w) / Σ neutralPlays_w` | `neutralPlays` (exactly reconciled) | If `Σ neutralPlays == 0` for a team-season (not expected in this dataset), emit `null` with warning `W_ZERO_DENOMINATOR_NEUTRAL_PLAYS`, never `0` | 4 decimals |
| `pointsPerDrive` | `pointsPerDrive` | points/drive | `Σ(pointsPerDrive_w × drives_w) / Σ drives_w` — equivalently `pointsForTotal / drivesTotal` | `drives` (exactly reconciled) | If `Σ drives == 0` (not expected), emit `null` with warning `W_ZERO_DENOMINATOR_DRIVES` | 2 decimals |
| `redZoneTdRate` | `redZoneTdRate` | rate [0,1] or `null` | `Σ(redZoneTdRate_w × redZoneTrips_w over non-null weeks) / Σ redZoneTrips_w` | `redZoneTrips` (exactly reconciled), null-preserving | `null` iff `Σ redZoneTrips == 0` for the team-season, with warning `W_ZERO_REDZONE_OPPORTUNITIES`. Never zero-filled. Not expected in 2024 (every team has ≥ 37 season red-zone trips), but the rule must hold generally | 4 decimals |

### Rate fields — provenance-confirmed weighting (derived)

| Source field | Output field | Unit | Formula | Weighting denominator | Null behavior | Precision |
| --- | --- | --- | --- | --- | --- | --- |
| `secondsPerPlay` | `secondsPerPlay` | seconds/play | `Σ(secondsPerPlay_w × offensivePlays_w) / Σ offensivePlays_w` | `offensivePlays` (confirmed by upstream provenance notes) | Never null in governed source; reject if null (§9) | 2 decimals |
| `epaPerPlay` | `epaPerPlay` | EPA/play | Same formula shape | `offensivePlays` (confirmed by upstream provenance notes) | Same | 4 decimals |

### Excluded / blocked fields — no methodology defined

`pointsAgainst`, `pressureRateAllowed`, and the 8 fantasy split fields have no aggregation
methodology in this contract — they are absent from the report entirely, not present-with-null.
`passRate`, `rushRate`, `successRate`, `explosivePlayRate`, `passEpaPerPlay`, and `rushEpaPerPlay`
are likewise absent for v1 — their correct denominator is known (`competitive_plays` /
exact pass-/rush-play counts) but not yet exposed by the governed source; see §12 for the specific
upstream requirement that would let a future revision include them with exact, not approximated,
weighting.

---

## 4. Human-readable report contract (finalized)

**Canonical alias:** `/nfl/2024/offensive-environments` (§6 defines identity semantics)

Required page content:

- **Title and question:** "2024 NFL Offensive Environments — Regular-Season Comparison," restating
  the plain-language question from §5 of the TIBER-Ops architecture: *how did all 32 NFL offensive
  environments compare during the 2024 regular season, based on governed observed team-week data?*
- **Declared scope and coverage summary:** season 2024, regular season, all 32 NFL teams, 544/544
  team-game rows, 17 games/team — stated plainly, not just as a metadata block.
- **Supported lanes vs. excluded lanes:** the 12 included fields (§2, §3) grouped in plain language
  (pace, overall efficiency, neutral-script pass tendency, red-zone, drives, ball security,
  protection); and an explicit statement of what is *not* shown and why — pass rate, rush rate,
  success rate, explosive-play rate, and pass-/rush-specific EPA (all blocked pending TIBER-Data
  exposing the exact play-classification denominator they need, §12), pressure rate (data withheld
  upstream), fantasy splits (not applicable to a team-environment report), and points allowed (out
  of this report's offensive scope, §2).
- **Per-team values:** every included field from §3, per team, with the season total for count
  fields and the per-game/weighted-average for rate fields both visible where both exist.
- **Methodology version and link:** `teamstate_public_offensive_environment_2024_v1`, linking to
  this document (or its eventual public-facing methodology-page rendering, §11 of the Ops
  architecture — not built here).
- **Provenance and source chain:** `governed_real_data`, governance markers, the `governed_input`
  pin (the exact Teamstate-local governed artifact consumed, with its checksum), and the
  `upstream_sources` list (each raw nflverse input's ref, snapshot timestamp, and recorded
  checksum) — plus the repository-qualified validation/lineage report references (§5, §7).
- **Warnings:** any per-team `W_ZERO_REDZONE_OPPORTUNITIES`/`W_ZERO_DENOMINATOR_*` warning that
  fires (§3). No exposure-weight-proxy warning exists in v1, because no proxy-weighted field is
  published (§2, §3).
- **Temporal metadata (§7):** `data_through`, `source_snapshot_at`, `generated_at` — three distinct,
  visible facts, not collapsed into one "cutoff" line.
- **Stable canonical pointer, no rendered status:** a frozen link to the canonical alias (§6) so a
  reader on a specific historical version can navigate to whatever is current. This page — at
  either the canonical alias or the immutable versioned identity — **never renders current/
  superseded status as content.** The link target text (`canonical_url`) never changes, even though
  what is served there does; that is sufficient navigation without the page itself displaying a
  status that would make its own content mutate over time (§6, §8 invariant 9).
- **Identity:** the immutable versioned identity for this exact report version (§6), distinct from
  the canonical alias, visible so a reader can cite the exact version.
- **Link to the JSON representation (§5).**
- **Explicit non-claims:** this is a historical, observed, governed-source comparison — not a
  current-state statement, not a projection or forecast, not a ranking recommendation, not fantasy,
  betting, or trade advice.

This defines the page's required content and semantics only. **No page is created by this
document.**

---

## 5. Machine-readable JSON contract (finalized)

**Canonical alias:** `/nfl/2024/offensive-environments.json` (§6 defines identity semantics)

**This payload is frozen once published** — see §6 for why it deliberately carries no
supersession/current-status field (that lives in a separate mutable registry entry, §6).

```json
{
  "artifact": "teamstate_public_offensive_environment_2024_v1",
  "schema_version": "1.0.0",
  "report_version_id": "teamstate_public_offensive_environment_2024_v1.r1",
  "canonical_url": "/nfl/2024/offensive-environments.json",
  "version_url": "/nfl/2024/offensive-environments/teamstate_public_offensive_environment_2024_v1.r1.json",
  "declared_scope": {
    "season": 2024,
    "phase": "regular_season",
    "expected_team_count": 32,
    "expected_team_game_rows": 544,
    "expected_games_per_team": 17,
    "output_meaning": "historical_observed_comparison",
    "data_through": "2025-01-05",
    "data_through_source": "pinned_contract_constant_public_nfl_schedule_not_adapter_derived"
  },
  "coverage": {
    "team_count": 32,
    "expected_team_count": 32,
    "team_game_row_count": 544,
    "expected_team_game_rows": 544,
    "missing_teams": [],
    "unexpected_teams": [],
    "is_full_league": true,
    "satisfies_declared_scope": true
  },
  "source_snapshot_at": "2026-06-27T13:42:05+00:00",
  "generated_at": "ISO-8601 timestamp — when this report version was derived",
  "provenance_status": "governed_real_data",
  "governance": {
    "governance_status": "governed",
    "governance_source": "explicit_marker"
  },
  "methodology_version": "teamstate_public_offensive_environment_2024_v1",
  "governed_input": {
    "artifact_id": "team_week_raw_v0_2024_real_source_candidate",
    "repository": "TIBER-Teamstate",
    "path": "data/governed/team_week_raw_v0_2024_real_source_candidate.json",
    "checksum": { "algorithm": "sha256", "value": "2aed00e68c1620af10d2ea4350104f7e183ff6ee050f5d385a503ef027281de9" },
    "checksum_verification": "recomputed_locally_at_generation_time_against_committed_repo_file"
  },
  "upstream_sources": [
    {
      "source_ref": "nflverse-data:pbp/play_by_play_2024",
      "source_snapshot_at": "2026-06-27T13:42:00+00:00",
      "checksum": { "algorithm": "sha256", "value": "6d432dd4308329bfddaef633309ea119f9ca46d52cbb3c09f47172a2e8efcd01" },
      "checksum_verification": "recorded_from_governed_artifact_metadata_no_network_refetch"
    },
    {
      "source_ref": "nflverse-data:schedules/games",
      "source_snapshot_at": "2026-06-27T13:42:05+00:00",
      "checksum": { "algorithm": "sha256", "value": "179ea0a014159b3aa4da59eee756272dd33ec876d704fb46650c08118fe75a05" },
      "checksum_verification": "recorded_from_governed_artifact_metadata_no_network_refetch"
    }
  ],
  "validation_report": {
    "repository": "TIBER-Data",
    "path": "exports/candidates/team_week_raw/team_week_raw_v0_2024_real_source_candidate.validation.json"
  },
  "lineage_manifest": {
    "repository": "TIBER-Data",
    "path": "data/manifests/team_week_raw_v0_2024_real_source_candidate.manifest.json"
  },
  "excluded_lanes": [
    { "field": "pointsAgainst", "reason": "out_of_declared_scope_defensive_facing" },
    { "field": "pressureRateAllowed", "reason": "withheld_upstream_deferred" },
    { "field": "passRate", "reason": "blocked_pending_upstream_denominator" },
    { "field": "rushRate", "reason": "blocked_pending_upstream_denominator" },
    { "field": "successRate", "reason": "blocked_pending_upstream_denominator" },
    { "field": "explosivePlayRate", "reason": "blocked_pending_upstream_denominator" },
    { "field": "passEpaPerPlay", "reason": "blocked_pending_upstream_denominator" },
    { "field": "rushEpaPerPlay", "reason": "blocked_pending_upstream_denominator" },
    { "field": "fantasyPointsForQB", "reason": "withheld_absent" },
    { "field": "fantasyPointsForRB", "reason": "withheld_absent" },
    { "field": "fantasyPointsForWR", "reason": "withheld_absent" },
    { "field": "fantasyPointsForTE", "reason": "withheld_absent" },
    { "field": "fantasyPointsAllowedQB", "reason": "withheld_absent" },
    { "field": "fantasyPointsAllowedRB", "reason": "withheld_absent" },
    { "field": "fantasyPointsAllowedWR", "reason": "withheld_absent" },
    { "field": "fantasyPointsAllowedTE", "reason": "withheld_absent" }
  ],
  "warnings": [],
  "teams": [
    {
      "team": "DET",
      "gamesPlayed": 17,
      "observed": {
        "pointsForTotal": 0,
        "offensivePlaysTotal": 0,
        "neutralPlaysTotal": 0,
        "drivesTotal": 0,
        "redZoneTripsTotal": 0,
        "sacksAllowedTotal": 0,
        "turnoversTotal": 0
      },
      "derived": {
        "pointsForPerGame": 0.0,
        "offensivePlaysPerGame": 0.0,
        "neutralPlaysPerGame": 0.0,
        "drivesPerGame": 0.0,
        "redZoneTripsPerGame": 0.0,
        "sacksAllowedPerGame": 0.0,
        "turnoversPerGame": 0.0,
        "secondsPerPlay": 0.0,
        "epaPerPlay": 0.0,
        "neutralPassRate": 0.0,
        "pointsPerDrive": 0.0,
        "redZoneTdRate": null
      },
      "warnings": []
    }
  ]
}
```

Notes on this shape:

- **No `supersession_status`/`superseded_by` field exists in this payload.** That is deliberate —
  see §6 for why putting a mutable status inside a document this contract calls immutable is
  self-contradictory, and where that status actually lives instead.
- **Two distinct pins, not one:** `governed_input` identifies and checksums the actual
  `team_week_raw_v0` artifact Teamstate consumes (repository-qualified as `TIBER-Teamstate`,
  since it's the committed local mirror this repo reads directly) — without this, a public report
  can't prove which exact governed intermediate produced its values, even if the raw upstream
  inputs are unchanged. `upstream_sources` is a separate array of the *raw* nflverse inputs that
  fed that governed artifact (play-by-play, schedules), each with its own `source_ref`,
  `source_snapshot_at`, and `checksum`, repository-qualified as `TIBER-Data` where applicable
  (`validation_report`, `lineage_manifest`) since those paths resolve in TIBER-Data, not here. The
  top-level `source_snapshot_at` is the **latest** of `upstream_sources[].source_snapshot_at`
  (`max()` — here, the schedules snapshot, `13:42:05`, one second after the play-by-play snapshot,
  `13:42:00`) — an explicit aggregation rule, not an arbitrary pick of one input.
- **Checksum verification differs by pin, and neither requires a network fetch (§7, §12):**
  `governed_input.checksum` is verified by **locally recomputing** the sha256 of the committed
  `data/governed/team_week_raw_v0_2024_real_source_candidate.json` bytes at generation time —
  implementable today with no network access, and precedented by this repo's existing
  `scripts/export_forecast_run2_full.mjs`, which already does exactly this and fails closed on
  drift. `upstream_sources[].checksum` is **recorded only** — read from the governed artifact's own
  `metadata.inputSources`, required to be present and well-formed, but **not** independently
  re-verified against a network re-fetch of the raw nflverse parquet files, because (a) the adapter
  boundary doesn't expose those raw bytes at all, and (b) the upstream URLs are documented as
  mutable rolling release assets — re-fetching later would not validate the exact historical bytes
  originally consumed and could produce false failures (or false passes) unrelated to whether the
  committed governed artifact is actually valid.
- `declared_scope.data_through` is a **pinned contract constant**, not a value derived from
  `teamWeekRawV0GovernedAdapter` output at runtime — see §1's callout for why, and §7/§12 for the
  upstream gap this works around. `source_snapshot_at` and `generated_at` remain genuinely
  runtime-derived (once the adapter extension in §12 lands). All three stay distinct (§7) — never
  collapsed into one field.
- `report_version_id`/`canonical_url`/`version_url` implement the two-identity requirement (§6).
- `excluded_lanes` names what is deliberately absent and why, without emitting a value for it
  (satisfies "withheld fields absent, not zero-filled or present-with-a-disclaimer").
- Every field in `teams[].observed`/`teams[].derived` traces to a row in §3's methodology tables —
  the JSON contract does not introduce any field §3 did not define.
- This is the **finalized** contract shape for Phase 3 to implement against — not illustrative
  placeholder text. All literal string/field names above (`artifact`, `schema_version`,
  `report_version_id`, etc.) are the actual contract, not examples of a shape TBD.

---

## 6. Canonical and immutable report identity

Two distinct identities, plus a separate mutable registry — three concepts, not two, because a
single "immutable" identity cannot also carry a mutating supersession status without contradicting
itself.

### The frozen report payload (§5) — strict immutability, HTML included

Once published at a `version_url`, a report payload's content is permanently frozen —
byte/semantically identical forever, including its `report_version_id`, all `teams[]` values, and
all metadata **except** anything about current/superseded status, which this payload does not
carry at all (see below). This is what makes `version_url` genuinely immutable: there is nothing
in it left to mutate.

**This applies identically to HTML and JSON — neither ever renders current/superseded status as
page content, at either the canonical alias or the immutable versioned identity.** An earlier draft
of this contract required the HTML page to display "whether this exact version is current or
superseded, per the registry" — that would make the HTML response at a `version_url` change
whenever the registry changes, directly contradicting "content never changes" (§8 invariant 9) and
leaving HTML/JSON parity (§9, `E_HTML_JSON_SEMANTIC_MISMATCH`) ambiguous, since the JSON payload
never carried a status field at all. The resolution: **strict immutable version pages.** Both
formats, at both URLs, include only a stable, frozen link to the canonical alias (`canonical_url`)
so a reader can navigate to whatever is current — the link *target text* never changes, even though
what is served there does. Neither page renders an explicit "you are viewing the current report" /
"this report has been superseded" status string. A future phase may add a separate,
explicitly-scoped public version-history page that *does* render registry state as its whole
purpose — that is not this contract, and not Phase 3.

### Two URL identities for the frozen payload

- **Canonical alias** — `/nfl/2024/offensive-environments` (HTML) and
  `/nfl/2024/offensive-environments.json` (JSON). Resolution logic (implemented in Phase 3, not
  here) looks up the current `report_version_id` in the mutable registry (below) and serves that
  exact version's frozen payload — directly, not a redirect, so a citation to the canonical alias
  always shows the current report's actual content.
- **Immutable versioned identity** — `/nfl/2024/offensive-environments/{report_version_id}` (HTML)
  and `/nfl/2024/offensive-environments/{report_version_id}.json` (JSON), where
  `report_version_id` follows the pattern `{methodology_version}.r{n}` (e.g.
  `teamstate_public_offensive_environment_2024_v1.r1`). `n` increments on every regeneration that
  changes published output (methodology change **or** a governed-source correction that changes
  values) — not on a no-op re-run that reproduces byte-identical output. This URL always serves the
  exact same frozen payload, regardless of which version is currently canonical.

### The mutable report registry (separate from the payload)

Current/superseded status and successor pointers live in `service-metadata.json`'s `public_reports`
array — a file this contract already treats as mutable and regeneratable (§1's Status block, §8
invariant on publication state) — **not** inside any report payload:

```json
{
  "public_reports": [
    {
      "report_version_id": "teamstate_public_offensive_environment_2024_v1.r1",
      "canonical_url": "/nfl/2024/offensive-environments",
      "version_url": "/nfl/2024/offensive-environments/teamstate_public_offensive_environment_2024_v1.r1",
      "status": "current",
      "superseded_by": null,
      "published_at": "ISO-8601 timestamp"
    }
  ]
}
```

When a new `report_version_id` is approved as current: a new registry entry is added with
`status: "current"`; the previous entry's `status` flips to `"superseded"` and its `superseded_by`
is set to the new `report_version_id`; the canonical alias begins resolving to the new version. The
frozen payload at the old version's `version_url` **does not change** — it never claimed
current-ness in the first place, so nothing about it needs to mutate. This flip must be atomic —
no window where the registry names two entries `current` for the same report family (mirrors the
Ops architecture's fail-closed supersession rule).

**Relationship between HTML and JSON:** both identities exist in both formats, sharing the same
`report_version_id` and the same frozen-payload/mutable-registry split. The HTML page for a given
version links to that same version's JSON (not the canonical JSON), so a reader following a
specific historical version stays pinned to that version's data. Phase 3 must verify HTML/JSON
semantic parity per version (§8, §9 — `E_HTML_JSON_SEMANTIC_MISMATCH`).

No route, redirect, identity-resolution, or registry code is implemented by this document.

---

## 7. Temporal metadata contract

Three distinct facts, never collapsed into one "cutoff" field (per the TIBER-Ops architecture §7):

- **`data_through`** — the latest football event/date the report's data actually includes. For
  this report: `2025-01-05`, the real-world final date of the 2024 NFL regular season (Week 18). A
  fixed historical fact that does not change across regenerations of this same report version. It
  is a **pinned `declared_scope` constant, not an adapter-derived value**: `TeamWeekRawGovernedRow`
  carries no game-date field, so there is nothing in `teamWeekRawV0GovernedAdapter` output for
  Phase 3 to compute this from at runtime (§1's callout, §12's upstream gap). Phase 3 must source
  it from this contract's pinned constant, not attempt to derive it from adapter rows.
- **`source_snapshot_at`** — when the governed upstream source bytes were retrieved, taken as the
  **latest** (`max()`) of the per-source snapshot timestamps in `upstream_sources` (§5) — this
  report depends on two distinct upstream inputs (play-by-play, schedules) with two distinct
  retrieval timestamps, and using only one of them would silently omit the other's snapshot time.
  **This requires a governed-adapter extension** — `teamWeekRawV0GovernedAdapter`'s
  `TeamWeekRawGovernedUpstream` currently preserves `sourceArtifacts` (a bare `string[]` of IDs),
  `validationReportPath`, and `lineageManifestPath`, but does **not** expose
  `metadata.inputSources` (which carries each source's `sourceRefs`, `sourceSnapshotAt`, and
  `checksum` in the raw governed artifact) at all. See §12 for the exact, minimal extension needed.
  Separately, `governed_input`'s own checksum (§5) is obtained via a small, existing-precedent local
  file read (§8, §11, §12) — not the adapter extension, which only covers `upstream_sources`.
- **`generated_at`** — when this specific report version was derived from the governed source. Can
  differ from both of the above; a report regenerated today can still have `data_through` fixed at
  the end of the 2024 season and `source_snapshot_at` fixed at whenever TIBER-Data retrieved the
  source.

All three are required on every published report (human- and machine-readable). Missing or
conflated temporal metadata is a validator rejection (§9, `E_TEMPORAL_METADATA_MISSING`).

---

## 8. Publication invariants

All of the following must be true before Phase 3 may enable publication of any version of this
report. Any single failure means: do not publish, no partial route, no best-effort output.

1. `provenance_status == "governed_real_data"`, with `governance_status == "governed"` and
   `governance_source == "explicit_marker"` (§1).
2. Coverage satisfies the declared scope exactly (§1): 32/32 teams, 544/544 rows, 17
   games/team, `missing_teams == []`, `unexpected_teams == []`.
3. `governed_input.checksum` matches a **fresh local recompute** of the committed
   `data/governed/team_week_raw_v0_2024_real_source_candidate.json` bytes at generation time (no
   network access required — precedented by `scripts/export_forecast_run2_full.mjs`). Each entry
   in `upstream_sources[]` has a `checksum` that is **present and well-formed**, as recorded in the
   governed artifact's own metadata — not independently re-verified against a network re-fetch of
   the raw upstream inputs (§7).
4. `methodology_version` is a known, approved value (`teamstate_public_offensive_environment_2024_v1`
   for this contract).
5. Only the 12 fields §3 defines methodology for are present in `teams[].observed`/`derived`; no
   undocumented field is emitted.
6. `pointsAgainst`, `pressureRateAllowed`, `passRate`, `rushRate`, `successRate`,
   `explosivePlayRate`, `passEpaPerPlay`, `rushEpaPerPlay`, and all 8 fantasy split fields are
   absent from every team record — never present, never null-as-placeholder, never zero-filled.
7. `redZoneTdRate` is `null` if and only if that team's season `redZoneTripsTotal == 0`; never `0`
   for a genuinely zero-opportunity season.
8. `data_through`, `source_snapshot_at`, and `generated_at` are all present and are not the
   identical literal value by construction (i.e., the fields are wired to their distinct sources,
   not to one shared timestamp variable), and `source_snapshot_at` equals `max()` of
   `upstream_sources[].source_snapshot_at`.
9. `report_version_id`, `canonical_url`, and `version_url` are all present; the payload at
   `version_url` never carries a `supersession_status`/`superseded_by` field (§6), never renders
   current/superseded status as HTML page content either, and, once published, its content (JSON
   and HTML alike) never changes.
10. The human-readable and machine-readable forms for a given `report_version_id` are semantically
    equivalent (same values, same warnings, same scope).
11. Current/superseded status is tracked only in the `service-metadata.json` registry (§6), never
    inside a report payload; the registry never names two entries `status: "current"` for the same
    report family at once, and any `superseded_by` names a real, resolvable `report_version_id`.
12. An explicit human publication-approval action has been recorded for this specific
    `report_version_id` — the presence of a passing validator run is necessary but not sufficient.

---

## 9. Validator specification and rejection reason codes

This is a **specification**, not validator code. Phase 3 implements a validator that enforces every
rule below and returns one of these stable, machine-readable rejection codes on failure. On any
rejection, the expected behavior is uniform: **do not publish this report version; do not serve a
partial or best-effort route.**

| Code | Condition | Invariant (§8) |
| --- | --- | --- |
| `E_PROVENANCE_MISSING` | `provenance_status`/governance markers absent | 1 |
| `E_PROVENANCE_NOT_GOVERNED` | `provenance_status != "governed_real_data"`, or governance markers not `governed`/`explicit_marker` | 1 |
| `E_COVERAGE_TEAM_MISSING` | `missing_teams` non-empty | 2 |
| `E_COVERAGE_TEAM_UNEXPECTED` | `unexpected_teams` non-empty | 2 |
| `E_COVERAGE_ROW_COUNT_MISMATCH` | `team_game_row_count != expected_team_game_rows`, or any team's row count `!= expected_games_per_team` | 2 |
| `E_GOVERNED_INPUT_CHECKSUM_MISMATCH` | `governed_input.checksum` absent, or does not match a fresh local recompute of the committed governed artifact bytes | 3 |
| `E_UPSTREAM_SOURCE_CHECKSUM_MISSING` | Any `upstream_sources[].checksum` absent or malformed (presence/well-formedness only — no network re-verification required) | 3 |
| `E_METHODOLOGY_VERSION_UNKNOWN` | `methodology_version` not a recognized, approved value | 4 |
| `E_UNDOCUMENTED_FIELD_PRESENT` | Any field in `teams[].observed`/`derived` not defined in §3 | 5 |
| `E_WITHHELD_FIELD_PRESENT` | `pointsAgainst`, `pressureRateAllowed`, `passRate`, `rushRate`, `successRate`, `explosivePlayRate`, `passEpaPerPlay`, `rushEpaPerPlay`, or any fantasy field present in a team record | 6 |
| `E_WITHHELD_FIELD_ZERO_FILLED` | Any withheld field present with value `0` instead of being absent | 6 |
| `E_REDZONE_NULL_INVARIANT_VIOLATED` | `redZoneTdRate` is `null` while `redZoneTripsTotal > 0`, or non-null while `redZoneTripsTotal == 0` | 7 |
| `E_UNWEIGHTED_AGGREGATION_USED` | Any rate field computed as a simple mean of weekly values instead of the weighted formula §3 specifies | §3 (formula conformance) |
| `E_APPROXIMATED_DENOMINATOR_UNAUTHORIZED` | Any of the six blocked fields (§2) present at all, regardless of method used to compute them | 6 |
| `E_TEMPORAL_METADATA_MISSING` | Any of `data_through`/`source_snapshot_at`/`generated_at` absent | 8 |
| `E_TEMPORAL_METADATA_CONFLATED` | Two or more of the three temporal fields are wired to the same source value (structural check, not a coincidental-equality check), or `source_snapshot_at != max(upstream_sources[].source_snapshot_at)` | 8 |
| `E_VERSION_IDENTITY_MISSING` | `report_version_id`/`canonical_url`/`version_url` absent | 9 |
| `E_VERSION_IDENTITY_MUTABLE` | A previously published `version_url`'s content (HTML or JSON) differs from a fresh regeneration at the same `report_version_id`; the JSON payload contains a `supersession_status`/`superseded_by` field at all; or the HTML page at any `version_url` (canonical or immutable) renders current/superseded status text | 9 |
| `E_HTML_JSON_SEMANTIC_MISMATCH` | HTML and JSON for the same `report_version_id` disagree on any published value, scope, or warning | 10 |
| `E_REGISTRY_STATE_INVALID` | `service-metadata.json`'s `public_reports` registry names more than one `status: "current"` entry for this report family, or a `superseded_by` doesn't resolve to a real `report_version_id` | 11 |
| `E_PUBLICATION_NOT_APPROVED` | No recorded explicit human approval for this `report_version_id` | 12 |

---

## 10. Fail-closed acceptance test matrix

Concrete test cases Phase 3's validator test suite must include (not exhaustive of every code
above, but enough to drive real tests for each):

| # | Given | Expect |
| --- | --- | --- |
| 1 | Input row set missing team `BUF` | `E_COVERAGE_TEAM_MISSING`, no publication |
| 2 | Input has 543 rows (one dropped) with all 32 teams present | `E_COVERAGE_ROW_COUNT_MISMATCH`, no publication |
| 3 | One team has 16 rows, another has 18 | `E_COVERAGE_ROW_COUNT_MISMATCH`, no publication |
| 4 | Source `provenanceStatus` is `partial_real_data` | `E_PROVENANCE_NOT_GOVERNED`, no publication |
| 5 | The committed `data/governed/team_week_raw_v0_2024_real_source_candidate.json` bytes have drifted from the pinned `governed_input.checksum` (local recompute mismatch) | `E_GOVERNED_INPUT_CHECKSUM_MISMATCH`, no publication |
| 5a | An `upstream_sources[]` entry is emitted with `checksum: null` | `E_UPSTREAM_SOURCE_CHECKSUM_MISSING`, no publication |
| 6 | Output includes a `pressureRateAllowed` field on any team, even as `null` | `E_WITHHELD_FIELD_PRESENT`, no publication |
| 7 | Output includes `fantasyPointsForQB: 0` on any team | `E_WITHHELD_FIELD_ZERO_FILLED`, no publication |
| 8 | Output includes a `passRate` or `passEpaPerPlay` field at all, by any computation method | `E_APPROXIMATED_DENOMINATOR_UNAUTHORIZED`, no publication |
| 9 | `neutralPassRate` computed as a plain arithmetic mean of 17 weekly values, not weighted | `E_UNWEIGHTED_AGGREGATION_USED`, no publication |
| 10 | A team with `redZoneTripsTotal == 0` has `redZoneTdRate: 0` instead of `null` | `E_REDZONE_NULL_INVARIANT_VIOLATED`, no publication |
| 11 | A team with `redZoneTripsTotal > 0` has `redZoneTdRate: null` | `E_REDZONE_NULL_INVARIANT_VIOLATED`, no publication |
| 12 | `data_through` absent | `E_TEMPORAL_METADATA_MISSING`, no publication |
| 13 | `source_snapshot_at` set to the play-by-play timestamp (`13:42:00`) instead of `max()` across both sources (`13:42:05`) | `E_TEMPORAL_METADATA_CONFLATED`, no publication |
| 14 | JSON `report_version_id` present, HTML page for the same version omits it | `E_VERSION_IDENTITY_MISSING`, no publication |
| 15 | Regenerating an already-published `report_version_id` produces different values | `E_VERSION_IDENTITY_MUTABLE`, no publication (must mint a new `report_version_id` instead) |
| 16 | A report payload includes a `supersession_status` field at all | `E_VERSION_IDENTITY_MUTABLE`, no publication (that concept belongs only in the registry, §6) |
| 16a | The HTML page at a version_url renders "This report has been superseded" text sourced from the registry | `E_VERSION_IDENTITY_MUTABLE`, no publication (strict immutable version pages, §6) |
| 17 | HTML shows a team's `epaPerPlay` rounded differently than the JSON for the same version | `E_HTML_JSON_SEMANTIC_MISMATCH`, no publication |
| 18 | Registry has two entries with `status: "current"` for the same report family | `E_REGISTRY_STATE_INVALID`, no publication |
| 19 | All invariants pass, but no recorded human approval for this `report_version_id` | `E_PUBLICATION_NOT_APPROVED`, no publication |
| 20 | All invariants pass and approval is recorded | Publication permitted; `artifact_publication_enabled` may flip to `true` and the registry may add this entry as `current` |

Only test #20 results in a passing, publishable state. Every other row must result in **zero**
output — not a truncated, partial, or best-effort report.

---

## 11. Phase 3 implementation acceptance criteria

This checklist defines **future** requirements for a separate, later implementation issue. It does
not authorize starting that work.

- [ ] Extend `TeamWeekRawGovernedUpstream`/`adaptTeamWeekRawV0Governed`
      (`src/adapters/teamWeekRawV0GovernedAdapter.ts`) to preserve `metadata.inputSources`
      (`sourceRefs`, `sourceSnapshotAt`, `checksum` per source) as a read-only pass-through — the
      same posture as its existing preserved `sourceArtifacts`/`validationReportPath`/
      `lineageManifestPath` fields, no new governance judgment. Required before `upstream_sources`
      and `source_snapshot_at` (§5, §7) can be populated at all.
- [ ] Compute `governed_input.checksum` (§5, §8 invariant 3) by locally re-hashing the committed
      `data/governed/team_week_raw_v0_2024_real_source_candidate.json` bytes at generation time —
      reuse or align with the existing sha256-check pattern in
      `scripts/export_forecast_run2_full.mjs` rather than inventing a new one. This is separate from
      the adapter extension above and requires no network access.
- [ ] Deterministic derivation built directly on `teamWeekRawV0GovernedAdapter` output for all 12
      methodology fields (§3) plus `source_snapshot_at`/`generated_at` (no bypass of its
      fail-closed governance checks). `declared_scope.data_through` is the one exception — sourced
      from this contract's pinned constant (§1, §7), not computed from adapter rows.
- [ ] Output conforms exactly to §5's JSON schema — every field name, nesting, and type matches;
      no additional undocumented fields, and no `supersession_status`/`superseded_by` field inside
      any report payload.
- [ ] Every formula in §3 is implemented exactly as specified, including the weighted (not simple
      mean) aggregation for every rate field.
- [ ] The mutable report registry (`service-metadata.json`'s `public_reports` array, §6) is
      implemented separately from report payload generation, with its own tests for the
      current/superseded flip being atomic.
- [ ] Validator implemented per §9, covering every rejection code with a real test, including all
      of §10's acceptance-matrix cases.
- [ ] HTML and JSON routes for both the canonical alias and the immutable versioned identity (§6),
      with semantic-parity tests between the two formats. Neither format, at either URL, renders
      current/superseded status as page content (§6, strict immutable version pages) — tested by
      confirming the HTML at a `version_url` is byte-identical before and after a registry flip.
- [ ] `service-metadata.json` updated only as part of this later, separately authorized work — not
      touched by this contract-design issue.
- [ ] Publication remains disabled (`artifact_publication_enabled: false`) throughout
      implementation and testing, flipping to `true` only after an explicit, recorded human
      approval for a specific `report_version_id` (invariant 12, §8).
- [ ] A successful full-scope dry run against the real governed 2024 source (not a fixture) is
      run and reviewed before requesting publication approval.
- [ ] Supersession behavior (§6) is tested via the registry, not the payload: publishing a second
      `report_version_id` correctly flips the registry's first entry to `superseded` atomically
      with the second entry going `current`, and the first version's frozen payload at its
      `version_url` is verified byte-identical before and after.

---

## 12. Unresolved questions / upstream requirements

- **`passRate`, `rushRate`, `successRate`, `explosivePlayRate`, `passEpaPerPlay`, and
  `rushEpaPerPlay` all need the same upstream fix: expose `competitive_plays` (and exact
  pass-/rush-play counts) in `team_week_raw_v0`.** TIBER-Data's governed builder already computes
  `TeamGameStats.competitive_plays` internally and derives `passRate`/`rushRate`/`successRate`/
  `explosivePlayRate` from it (`offensivePlays` uses the broader `OFFENSIVE_PLAY_TYPES` set,
  explaining the reconciliation gap proven in §3). This is a **known, well-specified, low-effort
  ask** — not an open research question — and would let a v2 methodology weight these fields
  exactly, and potentially derive `passEpaPerPlay`/`rushEpaPerPlay` from the same exposed
  denominator. This does not block v1's authorization; v1 simply excludes all six fields rather
  than approximate around a denominator that's known to exist but isn't exposed yet.
- **`teamWeekRawV0GovernedAdapter` does not expose `metadata.inputSources`.** It currently
  preserves `sourceArtifacts` (a bare array of source-ID strings), `validationReportPath`, and
  `lineageManifestPath`, but not each input source's own `sourceRefs`/`sourceSnapshotAt`/
  `checksum` — needed for §5's `upstream_sources` and §7's `source_snapshot_at`. This is a
  Teamstate-internal boundary extension (§11), not a TIBER-Data ask: the data already exists in the
  governed artifact's `metadata.inputSources`, the adapter just doesn't surface it yet. A minimal,
  read-only pass-through extension resolves it, consistent with the adapter's existing
  preservation posture.
- **`team_week_raw_v0` / `teamWeekRawV0GovernedAdapter` carry no game-date field**, so
  `declared_scope.data_through` cannot be computed at runtime from adapter output — it is pinned as
  a contract constant instead (§1, §7). The underlying `nflverse-data:schedules/games` source
  (already in `upstream_sources`, §5) does carry real game dates; a future revision could add a
  `gameDate`/`weekEndDate` field to `team_week_raw_v0`'s row shape so `data_through` could be
  derived automatically instead of pinned. This does not block v1.
- **Operator publication-approval mechanics** (who records the approval named in invariant 12, and
  how) are Phase 3/4 tooling questions, not resolved here — this contract only requires that the
  approval exist and be checkable, not how it is captured.

None of these block this contract's authorization: two are well-specified, low-effort boundary
extensions Phase 3 must complete before it can populate the affected fields at all (source metadata,
data_through); the third is a genuine upstream TIBER-Data ask with a known fix, resolved here by
exclusion rather than approximation, not by blocking the whole contract.

---

## Non-goals (unchanged from issue #83)

Implementing team-season aggregation; writing validator code; adding HTML or JSON routes; modifying
`src/server.ts`; changing `service-metadata.json`; enabling artifact publication; publishing a
football report; adding crawler, sitemap, SEO, API, MCP, or agent-tool functionality; using
fixture, sample, candidate, operator-seeded, Forecast handoff, or superseded artifacts as the
public source; expanding into current-season, forecast, ranking, fantasy-advice, or betting
surfaces.

## Final machine-readable decision

```text
may_open_teamstate_public_report_implementation_issue
```

The contract is complete and internally consistent: all 19 source-available non-withheld fields
have an explicit disposition (12 included with full methodology, 1 excluded on scope grounds, 6
blocked pending the *same*, well-specified upstream gap — `competitive_plays` exposure — with a
documented, non-blocking path forward); `pressureRateAllowed` and all 8 fantasy fields remain
withheld; the declared scope and its coverage gate are explicit; human-readable and JSON contracts
are finalized; the report payload's immutability no longer contradicts itself — current/superseded
status lives only in a separate mutable registry, never inside a "frozen" payload; the temporal and
source-artifact contract is scoped to what an explicitly-specified adapter extension can actually
supply, with a defined multi-source aggregation rule; a validator specification with stable
rejection codes and a fail-closed acceptance matrix are both in place; and Phase 3 acceptance
criteria are defined without authorizing that work. No derivation code, validator code, routes,
deployment changes, or publication-state changes are introduced here —
`artifact_publication_enabled` remains `false` and `public_reports` remains empty.
