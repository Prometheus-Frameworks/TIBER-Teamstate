# Teamstate 2024 Offensive-Environment Public-Report Readiness Audit (2026-07-10)

## Scope and framing

This is an **investigation-only** document. It is the Teamstate-side technical audit feeding
[TIBER-Ops issue #11](https://github.com/Prometheus-Frameworks/TIBER-Ops/issues/11) and its
operator decision comment,
[Direction A](https://github.com/Prometheus-Frameworks/TIBER-Ops/issues/11#issuecomment-4940087322):

> Use the governed 2024 full-league Teamstate source as the first controlled public-report pilot.
> *"How did all 32 NFL offensive environments compare during the 2024 regular season, based on
> governed observed team-week data?"*

It answers one question: **does this repository's current governed 2024 data and code actually
support that report, under the boundaries the operator comment sets?** It does not implement the
report, define a route, or publish any football artifact — those remain out of scope per issue
#11 ("No football artifact is published in this issue") and are Phase 2 (next Teamstate
implementation issue) per the issue's phased plan.

Guardrails respected:

- no publication code, routes, or contract added — this is an audit and a gap list only;
- claims in the operator comment are checked against the actual committed artifact and metadata,
  not assumed;
- `output/` fixtures and the Forecast Run 2 handoff packet are inspected for eligibility, not
  reused, per the comment's required boundaries.

### Method

- Read the governed source artifact directly (`data/governed/team_week_raw_v0_2024_real_source_candidate.json`)
  and its metadata block.
- Read the existing governed-consumption boundary (`src/adapters/teamWeekRawV0GovernedAdapter.ts`,
  `src/governed/*`, `docs/teamstate-governed-consumption-team-week-raw-v0-2024.md`).
- Read the existing season-to-date aggregation path (`src/reports/buildSeasonToDateReports.ts`,
  `src/types/teamstate.ts`) to check whether it can be reused for the season-comparison report.
- Read `docs/output-artifact-policy.md` and `docs/teamstate-forecast-run2-full-governed-source-handoff.md`
  to confirm what the comment's "required boundaries" exclude.
- Cross-check `src/server.ts` for route collisions with the candidate public routes.

---

## 1. Verification of the operator comment's factual claims

| Claim in the comment | Verified against | Result |
| --- | --- | --- |
| Governed 2024 source exists | `data/governed/team_week_raw_v0_2024_real_source_candidate.json` | **Confirmed** |
| Coverage is all 32 teams | `metadata.coverage.presentTeams` (32 codes), `missingTeams: []`, `isFullLeague: true` | **Confirmed** |
| 544 played team-game rows | `rows.length === 544`, `metadata.coverage.expectedTeamGameRows === actualTeamGameRows === 544` | **Confirmed** |
| Provenance is explicit | `metadata.provenanceStatus: "governed_real_data"`, `metadata.governance.governanceStatus: "governed"`, `governanceSource: "explicit_marker"` | **Confirmed** |
| Cutoff / weeks are explicit | `metadata.coverage.weeks` = 1–18, `isFullRegularSeasonCalendar: true`, `byeWeeksHandled: true` | **Confirmed** |
| Null semantics are explicit | `metadata.fieldReadiness`, `metadata.deferredFields: ["pressureRateAllowed"]`, per-row null counts (below) | **Confirmed** |
| Report can be regenerated deterministically | Governed loader is a pure read of a committed, sha256-pinned mirror; no non-deterministic step in the consumption boundary | **Confirmed** |

Per-field null counts across all 544 rows (computed directly from the committed file):

- `pressureRateAllowed`: **544/544 null** (deferred — matches `fieldReadiness: "deferred"`)
- `redZoneTdRate`: **11/544 null** (legitimate zero-red-zone-trip rows — matches `"partial_nulls"`)
- `fantasyPointsForQB/RB/WR/TE`, `fantasyPointsAllowedQB/RB/WR/TE` (8 fields): **544/544 null each**
- All other 18 fields (`pointsFor`, `pointsAgainst`, `offensivePlays`, `neutralPlays`,
  `secondsPerPlay`, `passRate`, `neutralPassRate`, `rushRate`, `epaPerPlay`, `passEpaPerPlay`,
  `rushEpaPerPlay`, `successRate`, `explosivePlayRate`, `drives`, `pointsPerDrive`,
  `redZoneTrips`, `sacksAllowed`, `turnovers`): **0/544 null**

The comment's factual basis is accurate. Direction A is buildable from what is actually committed.

---

## 2. Required boundaries — checked

The comment requires two exclusions. Both are correctly avoidable and neither is currently wired
into anything that would leak:

- **`output/` fixtures must not be treated as production truth.** Confirmed: every artifact in
  `output/` is `fixture_scaffold` / non-full-league per `docs/output-artifact-policy.md`
  (`team_environment_movement_v1.json`, `team_environment_profiles_v0.json`). Neither is derived
  from the governed 2024 source — they trace to `data/fixtures/`/`data/sample/` inputs. Also
  distinct: `data/processed/2026_team_offensive_environment_v0.json` is a **2026, operator-seeded,
  qualitative-label** artifact (`docs/teamstate-offensive-environment-v0.md`) — despite the similar
  name, it is unrelated to the 2024 governed team-week data and must not be confused with it or
  substituted into the public report.
- **The Forecast Run 2 handoff packet must not be exposed directly as the public report.**
  Confirmed: `data/fixtures/team_week_raw_forecast_run2/team_week_raw_v0_2024_forecast_run2.full.json`
  is scoped and labeled for Forecast's gate evaluation (`docs/teamstate-forecast-run2-full-governed-source-handoff.md`),
  at team-week grain, with a Forecast-specific `forecastCutoff`/`readinessStatus` envelope. It is
  not a public-report contract and nothing in the repo currently serves it publicly.

Neither exclusion requires new code — both are satisfied simply by building the public report from
the governed source directly through a new, separately-scoped derivation, as the comment requires.

---

## 3. Field/lane support matrix for "2024 offensive-environment comparison"

Derived from `metadata.fieldReadiness` plus the observed null counts above:

| Field | Status | Public-report eligible |
| --- | --- | --- |
| `epaPerPlay`, `passEpaPerPlay`, `rushEpaPerPlay` | available, 0 nulls | Yes |
| `successRate`, `explosivePlayRate` | available, 0 nulls | Yes |
| `secondsPerPlay` (pace), `offensivePlays`, `neutralPlays` | available, 0 nulls | Yes |
| `passRate`, `neutralPassRate`, `rushRate` | available, 0 nulls | Yes |
| `drives`, `pointsPerDrive`, `redZoneTrips` | available, 0 nulls | Yes |
| `pointsFor`, `pointsAgainst`, `sacksAllowed`, `turnovers` | available, 0 nulls | Yes |
| `redZoneTdRate` | `partial_nulls` (11/544) | Yes, but must stay null-aware in any season average (exclude null rows from the denominator; never zero-fill) |
| `pressureRateAllowed` | `deferred`, 544/544 null | **No** — excluded per comment ("pressure rate") and per upstream deferral |
| `fantasyPointsFor{QB,RB,WR,TE}`, `fantasyPointsAllowed{QB,RB,WR,TE}` | 544/544 null, absent in practice | **No** — excluded per comment ("fantasy-position split fields") |
| Current/future-week expectations, market priors, coaching forecasts, QB stability | not present in this source at all | **No** — not applicable; this artifact is 2024 observed team-week data only, so these lanes require no explicit exclusion logic, only correct labeling as out of scope |

This matches the comment's exclusion list exactly and requires no new judgment calls beyond
deciding the season-aggregation method for the one partially-null field (`redZoneTdRate`).

---

## 4. Existing infrastructure vs. what's missing

**Reusable as-is:**

- `src/adapters/teamWeekRawV0GovernedAdapter.ts` + `src/governed/*` already implement exactly the
  null-aware, fail-closed governed-consumption boundary the comment asks for: it accepts governance
  only from explicit upstream markers, keeps `pressureRateAllowed` null, keeps `redZoneTdRate`
  partial-null, and **strips the fantasy split fields at the boundary** rather than passing them
  through. This is the correct data-layer foundation for the public report and should be reused,
  not rebuilt.
- The committed governed mirror is sha256-pinned and re-verified by the existing test suite, so the
  "regenerated deterministically" requirement is already met at the source layer.

**Missing — this is the actual gap:**

- There is **no team-week → team-season aggregation over the governed adapter's output**. The only
  existing season-aggregation code, `src/reports/buildSeasonToDateReports.ts`, operates on a
  completely different, older pipeline (`TeamWeekState`, built from `data/fixtures/`/`data/sample/`
  inputs via `mapRawTeamWeekToTeamStateInput`). Its `input.*` fields in `src/types/teamstate.ts` are
  typed as plain `number` (not nullable), and its averaging (`toAverages`) unconditionally computes
  `aggregateAverage` over `fantasyPointsForQB` and the other seven fantasy fields. Fed the governed
  2024 rows (all-null on those fields), this would either throw at the type boundary or silently
  produce `NaN` — exactly the kind of silent-bad-output the comment's boundaries are designed to
  prevent. **This pipeline must not be reused for the public report without modification**; a
  season-comparison derivation needs to be built directly on top of the governed adapter's
  null-aware rows, scoped to only the eligible fields in §3.
- No public-report contract (human- or machine-readable) or validator exists yet for this artifact.
  No route exists yet — `src/server.ts` currently serves only `/`, `/healthz`, and
  `/service-metadata.json`, so `/nfl/2024/offensive-environments` and
  `/nfl/2024/offensive-environments.json` are unclaimed and won't collide with anything.
  `service-metadata.json` still correctly reports `artifact_publication_enabled: false` and
  `public_reports: []`, which must stay true until a report contract and validator exist.

---

## 5. Summary

| Question | Answer |
| --- | --- |
| Is the governed 2024 source what the operator comment says it is? | Yes — 32/32 teams, 544/544 rows, `governed_real_data`, explicit provenance/cutoff/null semantics, all independently verified. |
| Can the required boundaries (no `output/` fixtures, no Forecast Run 2 packet as the public report) be honestly met? | Yes, with no code changes needed to *avoid* them — the risk is confusable artifacts (esp. `2026_team_offensive_environment_v0.json`), not missing controls. |
| Which fields can the first report honestly show? | The 18 fully-available fields plus null-aware `redZoneTdRate` (19 total eligible, §3). `pressureRateAllowed` and the 8 fantasy fields are out, matching the comment exactly. |
| Is there reusable data-layer code? | Yes — `teamWeekRawV0GovernedAdapter` + `src/governed/*` already do the null-aware, fail-closed governed read. |
| Is there a season-aggregation derivation ready to use? | **No.** The only existing one (`buildSeasonToDateReports.ts`) is on the wrong pipeline, non-null-aware, and would mishandle this source's nulls if pointed at it directly. |
| Do route paths collide with anything live? | No — `/nfl/2024/offensive-environments` and `.json` are unclaimed. |

## Recommendation

The governed 2024 source is genuinely ready to support Direction A's report. The gap is entirely on
the derivation/contract side, not the data side: a season-comparison methodology (how team-week
rows aggregate to a team-season row, in particular how the partially-null `redZoneTdRate` is
averaged) and a public report contract (human- and machine-readable, per issue #11 §5–6) need to be
defined before any implementation, reusing `teamWeekRawV0GovernedAdapter` as the data layer and
excluding the fields in §3.

**Machine-readable decision:** `may_open_teamstate_public_report_contract_issue`

Recommended next bounded Teamstate issue: define the `teamstate_public_offensive_environment_2024_v1`
report contract — team-season aggregation methodology over `teamWeekRawV0GovernedAdapter` output,
null-aware handling of `redZoneTdRate`, the human-readable page contract, and the machine-readable
JSON contract at `/nfl/2024/offensive-environments{,.json}` — followed by implementation and wiring
`service-metadata.json`'s `public_reports`/`artifact_publication_enabled` once the contract and its
validator exist.
