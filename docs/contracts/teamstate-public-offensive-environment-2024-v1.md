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
  "outputMeaning": "historical_observed_comparison"
}
```

`outputMeaning: historical_observed_comparison` is an explicit, machine-checkable non-claim: this
report is not current-state, not a forecast, not a ranking recommendation, and not advice. It
describes what happened in the governed 2024 regular season, nothing else.

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
| `secondsPerPlay` | **Included** | Pace signal; play-weighted season average (§3) |
| `passRate` | **Included** | Core pass/rush identity signal; weighted season average, weighting-precision caveat applies (§3) |
| `neutralPassRate` | **Included** | Neutral-script pass identity; exactly reconciled, `neutralPlays`-weighted (§3) |
| `rushRate` | **Included** | Core pass/rush identity signal; weighted season average, weighting-precision caveat applies (§3) |
| `epaPerPlay` | **Included** | Core offensive-efficiency signal; play-weighted, denominator confirmed by upstream provenance notes (§3) |
| `passEpaPerPlay` | **Blocked pending upstream denominator field** | Correct weighting needs the exact pass-play count. It is not `offensivePlays × passRate` — proven non-integer on real rows (§3, evidence). Not authorized for approximation; excluded from v1. |
| `rushEpaPerPlay` | **Blocked pending upstream denominator field** | Same reason as `passEpaPerPlay`. |
| `successRate` | **Included** | Core efficiency-consistency signal; weighted season average, weighting-precision caveat applies (§3) |
| `explosivePlayRate` | **Included** | Core explosiveness signal; weighted season average, weighting-precision caveat applies (§3) |
| `drives` | **Included** | Core drive-volume count; season total + per-game (§3) |
| `pointsPerDrive` | **Included** | Core scoring-efficiency signal; exactly reconciled, `drives`-weighted (§3) |
| `redZoneTrips` | **Included** | Core red-zone opportunity count; season total + per-game (§3) |
| `redZoneTdRate` | **Included** | Core red-zone efficiency signal; exactly reconciled, `redZoneTrips`-weighted, null-aware (§3) |
| `sacksAllowed` | **Included** | Core pass-protection signal; season total + per-game (§3) |
| `turnovers` | **Included** | Core ball-security signal; season total + per-game (§3) |
| `pointsFor` vs `pointsAgainst` — `pointsAgainst` | **Excluded** | `pointsAgainst` characterizes the *opponent's* offensive output against this team's defense, not this team's offensive environment. Including it — even as context — would blur this report's declared scope (offensive environment only) toward a team/defensive-performance report, which is a separately scoped future question, not this one. |
| `pressureRateAllowed` | **Excluded (withheld)** | `deferred`, 544/544 null upstream; unavailable, never zero-filled (PR #80). |
| `fantasyPointsForQB/RB/WR/TE` (4 fields) | **Excluded (withheld)** | 544/544 null / absent in practice; stripped at the governed-adapter boundary already (PR #80). |
| `fantasyPointsAllowedQB/RB/WR/TE` (4 fields) | **Excluded (withheld)** | Same as above. |

16 fields included. 2 fields blocked pending upstream work. 10 fields excluded (1 scope-rationale
exclusion + 9 withheld/absent). This accounts for all 28 metric fields in the governed row shape.

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
- **NOT reconciled against `offensivePlays` — disclosed approximation:** `passRate`, `rushRate`,
  `successRate`, and `explosivePlayRate` do **not** cleanly divide by `offensivePlays`. Proof:
  ARI, 2024 week 1 — `offensivePlays = 60`, `passRate = 0.644068`. `60 × 0.644068 = 38.644`, not an
  integer. `59 × 0.644068 = 38.000`, an exact integer — the field's true per-row denominator is
  `59`, one less than `offensivePlays` for this row, for a reason not reconstructable from the
  emitted fields alone (`passRate + rushRate == 1.0` on every row, so the two share *a* consistent
  denominator, just not the emitted `offensivePlays`). A 100-row sample shows the same pattern for
  `successRate` and `explosivePlayRate` (average fractional deviation against `offensivePlays`:
  ~0.15–0.17, not close to zero). `offensivePlays` is nonetheless used below as the season-weighting
  exposure variable for these four fields — see the field table for what that claim is and is not.

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

### Rate fields — disclosed exposure-weighted approximation (derived)

| Source field | Output field | Unit | Formula | Weighting denominator | Null behavior | Precision |
| --- | --- | --- | --- | --- | --- | --- |
| `passRate` | `passRate` | rate [0,1] | `Σ(passRate_w × offensivePlays_w) / Σ offensivePlays_w` | `offensivePlays` used as an **exposure-weight proxy**, not the field's proven exact per-row denominator (see precision note above) | Never null; reject if null (§9) | 4 decimals |
| `rushRate` | `rushRate` | rate [0,1] | Same formula shape | Same caveat | Same | 4 decimals |
| `successRate` | `successRate` | rate [0,1] | Same formula shape | Same caveat | Same | 4 decimals |
| `explosivePlayRate` | `explosivePlayRate` | rate [0,1] | Same formula shape | Same caveat | Same | 4 decimals |

These four fields are published because they are core, well-defined, internally consistent weekly
observations (`passRate + rushRate == 1.0` on every row, confirmed across the full dataset) and
`offensivePlays` is the closest, most complete play-volume field the source emits — but this
contract does **not** claim the season-weighted value exactly reconstructs a true season-level
rate the way `pointsPerDrive` or `neutralPassRate` do. Phase 3 must carry this caveat into the
published `warnings` array for every team record that includes these fields (§9's `W_EXPOSURE_WEIGHT_PROXY`
warning) and must re-verify the true denominator against TIBER-Data's exact source formula before
implementation (§10, §11).

### Excluded / blocked fields — no methodology defined

`pointsAgainst`, `pressureRateAllowed`, and the 8 fantasy split fields have no aggregation
methodology in this contract — they are absent from the report entirely, not present-with-null.
`passEpaPerPlay`/`rushEpaPerPlay` are likewise absent; see §12 for the upstream requirement that
would let a future revision include them.

---

## 4. Human-readable report contract (finalized)

**Canonical alias:** `/nfl/2024/offensive-environments` (§6 defines identity semantics)

Required page content:

- **Title and question:** "2024 NFL Offensive Environments — Regular-Season Comparison," restating
  the plain-language question from §5 of the TIBER-Ops architecture: *how did all 32 NFL offensive
  environments compare during the 2024 regular season, based on governed observed team-week data?*
- **Declared scope and coverage summary:** season 2024, regular season, all 32 NFL teams, 544/544
  team-game rows, 17 games/team — stated plainly, not just as a metadata block.
- **Supported lanes vs. excluded lanes:** the 16 included fields (§2, §3) grouped in plain language
  (pace, pass/rush identity, efficiency, red-zone, ball security, protection); and an explicit
  statement of what is *not* shown and why — pressure rate (data withheld upstream), fantasy
  splits (not applicable to a team-environment report), pass-specific/rush-specific EPA (blocked
  pending an upstream denominator field, §12), and points allowed (out of this report's offensive
  scope, §2).
- **Per-team values:** every included field from §3, per team, with the season total for count
  fields and the per-game/weighted-average for rate fields both visible where both exist.
- **Methodology version and link:** `teamstate_public_offensive_environment_2024_v1`, linking to
  this document (or its eventual public-facing methodology-page rendering, §11 of the Ops
  architecture — not built here).
- **Provenance and source artifact references:** `governed_real_data`, governance markers, source
  artifact ID and sha256, upstream validation/lineage report paths (carried through from
  `teamWeekRawV0GovernedAdapter`'s preserved references).
- **Warnings:** the `W_EXPOSURE_WEIGHT_PROXY` caveat (§3) on the four affected fields, plus any
  per-team `W_ZERO_REDZONE_OPPORTUNITIES`/`W_ZERO_DENOMINATOR_*` warning that fires.
- **Temporal metadata (§7):** `data_through`, `source_snapshot_at`, `generated_at` — three distinct,
  visible facts, not collapsed into one "cutoff" line.
- **Supersession state:** `current` or `superseded`, with a link to the successor if superseded.
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
    "output_meaning": "historical_observed_comparison"
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
  "data_through": "ISO-8601 date — the 2024 regular season's final game date; not independently verified by this contract and must be sourced from the governed artifact's own schedule data at implementation time, not hardcoded",
  "source_snapshot_at": "2026-06-27T13:42:00+00:00",
  "generated_at": "ISO-8601 timestamp — when this report version was derived",
  "provenance_status": "governed_real_data",
  "governance": {
    "governance_status": "governed",
    "governance_source": "explicit_marker"
  },
  "methodology_version": "teamstate_public_offensive_environment_2024_v1",
  "source_artifacts": [
    {
      "source_artifact_id": "team_week_raw_v0",
      "sha256": "2aed00e68c1620af10d2ea4350104f7e183ff6ee050f5d385a503ef027281de9",
      "validation_report_path": "exports/candidates/team_week_raw/team_week_raw_v0_2024_real_source_candidate.validation.json",
      "lineage_manifest_path": "data/manifests/team_week_raw_v0_2024_real_source_candidate.manifest.json"
    }
  ],
  "excluded_lanes": [
    { "field": "pointsAgainst", "reason": "out_of_declared_scope_defensive_facing" },
    { "field": "pressureRateAllowed", "reason": "withheld_upstream_deferred" },
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
  "supersession_status": "current",
  "superseded_by": null,
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
        "successRate": 0.0,
        "explosivePlayRate": 0.0,
        "passRate": 0.0,
        "rushRate": 0.0,
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

- `data_through`, `source_snapshot_at`, and `generated_at` are three distinct fields (§7) — never
  collapsed.
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

Two distinct identities, both required, so supersession is actually implementable (per the
TIBER-Ops architecture §6/§8):

- **Canonical alias** — `/nfl/2024/offensive-environments` (HTML) and
  `/nfl/2024/offensive-environments.json` (JSON). Always serves whichever `report_version_id` is
  currently `supersession_status: "current"` for this declared scope. Serves content directly (not
  a redirect) — a citation to the canonical alias always shows the current report.
- **Immutable versioned identity** — `/nfl/2024/offensive-environments/{report_version_id}` (HTML)
  and `/nfl/2024/offensive-environments/{report_version_id}.json` (JSON), where
  `report_version_id` follows the pattern `{methodology_version}.r{n}` (e.g.
  `teamstate_public_offensive_environment_2024_v1.r1`). `n` increments on every regeneration that
  changes published output (methodology change **or** a governed-source correction that changes
  values) — not on a no-op re-run that reproduces byte-identical output. Once published, a
  versioned URL's content never changes and is never deleted; it is the only thing a citation, an
  agent tool, or a search index should treat as permanent.

**Relationship between HTML and JSON:** both identities exist in both formats, sharing the same
`report_version_id`. The HTML page links to its own-version JSON (not the canonical JSON) so a
reader following a specific historical version stays pinned to that version's data. Phase 3 must
verify HTML/JSON semantic parity per version (§8, §9 — `E_HTML_JSON_SEMANTIC_MISMATCH`).

**Superseded behavior:** when a new `report_version_id` is approved as current, the previous
version's `supersession_status` flips to `"superseded"` and `superseded_by` is set to the new
`report_version_id`; the canonical alias begins serving the new version; the old version's
immutable URL keeps serving its exact original content, unchanged, forever. This flip must be
atomic with the new version's publication — no window where both look current (mirrors the
Ops architecture's fail-closed supersession rule).

No route, redirect, or identity-resolution code is implemented by this document.

---

## 7. Temporal metadata contract

Three distinct facts, never collapsed into one "cutoff" field (per the TIBER-Ops architecture §7):

- **`data_through`** — the latest football event/date the report's data actually includes. For
  this report: the end of the 2024 NFL regular season. A fixed historical fact that does not change
  across regenerations of this same report version.
- **`source_snapshot_at`** — when the governed upstream source bytes were retrieved. Carried
  through from the governed source's own `retrievalTimestamp` (already tracked at the TIBER-Data
  layer per `metadata.inputSources`) — the public report must preserve this, not discard or
  re-derive it.
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
3. `source_artifacts[].sha256` present and matches the governed mirror's recomputed hash at
   generation time.
4. `methodology_version` is a known, approved value (`teamstate_public_offensive_environment_2024_v1`
   for this contract).
5. Only the 16 fields §3 defines methodology for are present in `teams[].observed`/`derived`; no
   undocumented field is emitted.
6. `pointsAgainst`, `pressureRateAllowed`, `passEpaPerPlay`, `rushEpaPerPlay`, and all 8 fantasy
   split fields are absent from every team record — never present, never null-as-placeholder, never
   zero-filled.
7. Every field in §3's "disclosed exposure-weighted approximation" table carries the
   `W_EXPOSURE_WEIGHT_PROXY` warning on every team record.
8. `redZoneTdRate` is `null` if and only if that team's season `redZoneTripsTotal == 0`; never `0`
   for a genuinely zero-opportunity season.
9. `data_through`, `source_snapshot_at`, and `generated_at` are all present and are not the
   identical literal value by construction (i.e., the fields are wired to their distinct sources,
   not to one shared timestamp variable).
10. `report_version_id`, `canonical_url`, and `version_url` are all present and `version_url`
    resolves to content that will never change after this publication.
11. The human-readable and machine-readable forms for a given `report_version_id` are semantically
    equivalent (same values, same warnings, same scope).
12. `supersession_status` is a valid state (`current` or `superseded`) and, if `superseded`,
    `superseded_by` names a real, resolvable `report_version_id`.
13. An explicit human publication-approval action has been recorded for this specific
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
| `E_SOURCE_ARTIFACT_HASH_MISSING` | `source_artifacts[].sha256` absent or does not match a fresh recompute | 3 |
| `E_METHODOLOGY_VERSION_UNKNOWN` | `methodology_version` not a recognized, approved value | 4 |
| `E_UNDOCUMENTED_FIELD_PRESENT` | Any field in `teams[].observed`/`derived` not defined in §3 | 5 |
| `E_WITHHELD_FIELD_PRESENT` | `pointsAgainst`, `pressureRateAllowed`, `passEpaPerPlay`, `rushEpaPerPlay`, or any fantasy field present in a team record | 6 |
| `E_WITHHELD_FIELD_ZERO_FILLED` | Any withheld field present with value `0` instead of being absent | 6 |
| `E_MISSING_EXPOSURE_WEIGHT_WARNING` | `passRate`/`rushRate`/`successRate`/`explosivePlayRate` present without the `W_EXPOSURE_WEIGHT_PROXY` warning on that team record | 7 |
| `E_REDZONE_NULL_INVARIANT_VIOLATED` | `redZoneTdRate` is `null` while `redZoneTripsTotal > 0`, or non-null while `redZoneTripsTotal == 0` | 8 |
| `E_UNWEIGHTED_AGGREGATION_USED` | Any rate field computed as a simple mean of weekly values instead of the weighted formula §3 specifies | 3, §3 |
| `E_APPROXIMATED_DENOMINATOR_UNAUTHORIZED` | `passEpaPerPlay`/`rushEpaPerPlay` (or any field requiring their denominator) present at all | 6 |
| `E_TEMPORAL_METADATA_MISSING` | Any of `data_through`/`source_snapshot_at`/`generated_at` absent | 9 |
| `E_TEMPORAL_METADATA_CONFLATED` | Two or more of the three temporal fields are wired to the same source value (structural check, not a coincidental-equality check) | 9 |
| `E_VERSION_IDENTITY_MISSING` | `report_version_id`/`canonical_url`/`version_url` absent | 10 |
| `E_VERSION_IDENTITY_MUTABLE` | A previously published `version_url`'s content differs from a fresh regeneration at the same `report_version_id` | 10 |
| `E_HTML_JSON_SEMANTIC_MISMATCH` | HTML and JSON for the same `report_version_id` disagree on any published value, scope, or warning | 11 |
| `E_SUPERSESSION_STATE_INVALID` | `supersession_status` not one of `current`/`superseded`, or `superseded` without a resolvable `superseded_by` | 12 |
| `E_PUBLICATION_NOT_APPROVED` | No recorded explicit human approval for this `report_version_id` | 13 |

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
| 5 | Source `sha256` does not match a fresh recompute | `E_SOURCE_ARTIFACT_HASH_MISSING`, no publication |
| 6 | Output includes a `pressureRateAllowed` field on any team, even as `null` | `E_WITHHELD_FIELD_PRESENT`, no publication |
| 7 | Output includes `fantasyPointsForQB: 0` on any team | `E_WITHHELD_FIELD_ZERO_FILLED`, no publication |
| 8 | Output includes a `passEpaPerPlay` field at all | `E_APPROXIMATED_DENOMINATOR_UNAUTHORIZED`, no publication |
| 9 | `passRate` computed as a plain arithmetic mean of 17 weekly values, not weighted | `E_UNWEIGHTED_AGGREGATION_USED`, no publication |
| 10 | `passRate` present without `W_EXPOSURE_WEIGHT_PROXY` warning on that team | `E_MISSING_EXPOSURE_WEIGHT_WARNING`, no publication |
| 11 | A team with `redZoneTripsTotal == 0` has `redZoneTdRate: 0` instead of `null` | `E_REDZONE_NULL_INVARIANT_VIOLATED`, no publication |
| 12 | A team with `redZoneTripsTotal > 0` has `redZoneTdRate: null` | `E_REDZONE_NULL_INVARIANT_VIOLATED`, no publication |
| 13 | `data_through` absent | `E_TEMPORAL_METADATA_MISSING`, no publication |
| 14 | `source_snapshot_at` and `generated_at` both wired to the same variable in the implementation | `E_TEMPORAL_METADATA_CONFLATED`, no publication |
| 15 | JSON `report_version_id` present, HTML page for the same version omits it | `E_VERSION_IDENTITY_MISSING`, no publication |
| 16 | Regenerating an already-published `report_version_id` produces different values | `E_VERSION_IDENTITY_MUTABLE`, no publication (must mint a new `report_version_id` instead) |
| 17 | HTML shows a team's `epaPerPlay` rounded differently than the JSON for the same version | `E_HTML_JSON_SEMANTIC_MISMATCH`, no publication |
| 18 | `supersession_status: "superseded"` with `superseded_by: null` | `E_SUPERSESSION_STATE_INVALID`, no publication |
| 19 | All invariants pass, but no recorded human approval for this `report_version_id` | `E_PUBLICATION_NOT_APPROVED`, no publication |
| 20 | All invariants pass and approval is recorded | Publication permitted; `artifact_publication_enabled` may flip to `true` and `public_reports` may include this entry |

Only test #20 results in a passing, publishable state. Every other row must result in **zero**
output — not a truncated, partial, or best-effort report.

---

## 11. Phase 3 implementation acceptance criteria

This checklist defines **future** requirements for a separate, later implementation issue. It does
not authorize starting that work.

- [ ] Deterministic derivation built directly on `teamWeekRawV0GovernedAdapter` output (no new
      adapter, no bypass of its fail-closed governance checks).
- [ ] Output conforms exactly to §5's JSON schema — every field name, nesting, and type matches;
      no additional undocumented fields.
- [ ] Every formula in §3 is implemented exactly as specified, including the weighted (not simple
      mean) aggregation for every rate field.
- [ ] The weighting-precision re-verification from §3's exposure-weight note is completed against
      TIBER-Data's exact source formula before this report is authorized to publish (a concrete,
      checkable pre-publication step, not a permanent open question).
- [ ] Validator implemented per §9, covering every rejection code with a real test, including all
      of §10's acceptance-matrix cases.
- [ ] HTML and JSON routes for both the canonical alias and the immutable versioned identity (§6),
      with semantic-parity tests between the two formats.
- [ ] `service-metadata.json` updated only as part of this later, separately authorized work — not
      touched by this contract-design issue.
- [ ] Publication remains disabled (`artifact_publication_enabled: false`) throughout
      implementation and testing, flipping to `true` only after an explicit, recorded human
      approval for a specific `report_version_id` (invariant 13, §8).
- [ ] A successful full-scope dry run against the real governed 2024 source (not a fixture) is
      run and reviewed before requesting publication approval.
- [ ] Supersession behavior (§6) is tested: publishing a second `report_version_id` correctly
      flips the first to `superseded` atomically with the second going `current`, and the first's
      immutable URL still serves its original content afterward.

---

## 12. Unresolved questions / upstream requirements

- **`passEpaPerPlay`/`rushEpaPerPlay` need an exact upstream denominator.** TIBER-Data's
  `team_week_raw_v0` does not emit exact pass-play/rush-play integer counts, and `offensivePlays ×
  passRate` is proven non-integer on real rows (§3). A future contract revision (v2) could include
  these fields if TIBER-Data adds an explicit `passPlays`/`rushPlays` (or equivalent) field to a
  future `team_week_raw_v0` revision. This does not block this contract or v1's implementation —
  v1 simply excludes these two fields, the same way it excludes `pressureRateAllowed`.
- **The true per-row denominator for `passRate`/`rushRate`/`successRate`/`explosivePlayRate`** is
  not `offensivePlays` and is not reconstructable from the emitted fields (§3). This contract
  authorizes `offensivePlays` as a disclosed exposure-weight proxy for season aggregation, with a
  mandatory warning and a Phase 3 pre-publication re-verification step (§11) — it does not resolve
  the underlying question of what TIBER-Data's exact denominator is. If TIBER-Data can confirm or
  expose it, a v2 methodology should adopt the exact value.
- **Operator publication-approval mechanics** (who records the approval named in invariant 13, and
  how) are Phase 3/4 tooling questions, not resolved here — this contract only requires that the
  approval exist and be checkable, not how it is captured.

None of these block this contract's authorization; each is either a documented, disclosed
approximation (with a re-verification checkpoint) or a scoped-out field with a clear future path.

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
have an explicit disposition (16 included with full methodology, 1 excluded on scope grounds,
2 blocked pending upstream work with a documented, non-blocking path forward); `pressureRateAllowed`
and all 8 fantasy fields remain withheld; the declared scope and its coverage gate are explicit;
human-readable and JSON contracts are finalized; canonical and immutable identities are both
defined; the three temporal facts are distinct; a validator specification with stable rejection
codes and a fail-closed acceptance matrix are both in place; and Phase 3 acceptance criteria are
defined without authorizing that work. No derivation code, validator code, routes, deployment
changes, or publication-state changes are introduced here — `artifact_publication_enabled` remains
`false` and `public_reports` remains empty.
