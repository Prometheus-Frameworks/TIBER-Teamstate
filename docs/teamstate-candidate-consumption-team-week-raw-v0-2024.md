# Teamstate Candidate Consumption: 2024 `team_week_raw_v0`

Tracks: TIBER-Teamstate issue [#52](https://github.com/Prometheus-Frameworks/TIBER-Teamstate/issues/52),
parent tracker #50. Upstream: TIBER-Data's `team_week_raw_v0_2024_real_source_candidate.json` source
artifact (TIBER-Data PR C build, PR D promotion review — issue #169 — decided **do not promote**).

## What this is

This is a **candidate-ingestion boundary**, not a governance promotion and not a modeling lane. It adds
the first Teamstate-side adapter/loader path that can read the 2024 `team_week_raw_v0` candidate
artifact TIBER-Data produced from real nflverse play-by-play and schedule data, while explicitly
preserving that artifact's `partial_real_data` / `ungoverned` status.

It does **not**:

- Promote the candidate to governed data. Only an explicit human promotion review (the TIBER-Data PR D
  process) can do that.
- Feed PPM, Product, ranking, or fantasy-advice outputs. Nothing in this change touches those lanes.
- Backfill, estimate, or zero-fill any deferred field. `pressureRateAllowed`, the eight fantasy-points
  fields, and `redZoneTdRate` (on zero-red-zone-trip rows) are `null` in the real candidate and stay
  `null` through this adapter.
- Mutate the TIBER-Data artifact or change its contract. This repo only reads it.

## What was added

| File | Purpose |
| --- | --- |
| `src/adapters/teamWeekRawV0CandidateAdapter.ts` | Pure function `adaptTeamWeekRawV0Candidate(raw, sourceArtifactPath)`. Validates the envelope, gates on declared provenance/governance metadata, and maps rows to a null-preserving shape. |
| `src/ingest/loadTeamWeekRawV0Candidate.ts` | Thin, read-only file loader: reads a candidate JSON file from disk and delegates to the adapter. |
| `data/fixtures/team_week_raw_candidate/team_week_raw_v0_2024_candidate.sample.json` | A 4-row excerpt of real values from the upstream candidate, used only for adapter tests. |
| `tests/teamWeekRawV0CandidateAdapter.spec.ts` | Proves the acceptance/rejection and null-preservation behavior below. |

This is deliberately a **separate** module from the existing `src/adapters/teamWeekRawV0Adapter.ts`.
That adapter requires every row metric to be a finite number and throws on `null` — it was built against
fixture/sample data that has no nulls. Routing the real candidate through it would throw on the first
null field encountered. Rather than loosening that adapter's contract (which would ripple
`number` → `number | null` into `mapRawTeamWeekToTeamStateInput.ts` and the downstream
movement/forecast-features pipeline that assume non-null arithmetic), this change adds a narrowly-scoped
adapter whose only job is candidate intake. Connecting candidate rows to that downstream pipeline is out
of scope here and would need its own explicitly authorized change.

## Acceptance gate

`adaptTeamWeekRawV0Candidate` reads acceptance criteria **only** from the artifact's own `metadata`
block — never from the file path or name passed in as `sourceArtifactPath`. That argument is carried
through into the result purely as a traceability label.

- `metadata.provenanceStatus` must be one of: `fixture_scaffold`, `sample`, `partial_real_data`,
  `unknown_provenance`. `governed_real_data` is explicitly rejected here — a governance promotion must
  go through an explicit human review, never through this read-only loader.
- `metadata.governance` must be present and declare `governanceStatus` / `governanceSource` as
  non-empty strings. Only `governanceStatus: "ungoverned"` is accepted; a missing governance block, or
  any other governance status (including `"governed"`), fails closed.
- Every row must supply each of the ~28 metric fields as either a finite number or `null`; missing
  fields, `NaN`, or non-numeric values fail closed.

Tests prove both directions of "no path inference": an artifact whose metadata says
`partial_real_data` / `ungoverned` is accepted even when passed a `sourceArtifactPath` containing the
string `governed_real_data`, and an artifact whose metadata says `governanceStatus: "governed"` is
rejected even when passed a path containing `candidate`/`partial_ungoverned`.

## Output shape

```ts
interface TeamWeekRawCandidateConsumption {
  upstream: {
    sourceArtifactPath: string;
    generatedAt: string | null;
    season: number | null;
    provenanceStatus: string;     // e.g. "partial_real_data"
    governanceStatus: string;     // e.g. "ungoverned"
    governanceSource: string;     // e.g. "not_set"
    deferredFields: string[];     // e.g. ["pressureRateAllowed", "fantasyPointsForQB", ...]
    validationReportPath: string | null;
    lineageManifestPath: string | null;
  };
  rows: TeamWeekRawCandidateRow[]; // metric fields are `number | null`
}
```

A test locks `Object.keys(result)` to exactly `['rows', 'upstream']` — no ranking, advice, or score
fields are produced by this adapter.

## Dry-run coverage lane (issue [#58](https://github.com/Prometheus-Frameworks/TIBER-Teamstate/issues/58))

The next bounded slice after the bye-aware validator (#56/#57) connects this read-only candidate
intake path to that validator, with no promotion, governance, scoring, or PPM work. It is a **dry-run
check only**.

| File | Purpose |
| --- | --- |
| `src/dryrun/teamWeekRawV0CandidateDryRun.ts` | Pure `dryRunTeamWeekRawV0CandidateCoverage(consumption, expectation?)` + file wrapper `dryRunTeamWeekRawV0CandidateFile(path, expectation?)`. Maps candidate rows to the `(team_code, week, season)` coverage shape and explicitly invokes `validateTeamWeekByeAwareCoverage`. Exports `REAL_2024_CANDIDATE_COVERAGE_EXPECTATION` (32 teams, Weeks 1-18, 17 games/team, season 2024). |
| `src/dryrun/runTeamWeekRawV0CandidateDryRun.ts` | Thin read-only CLI: loads a candidate file, prints the dry-run report JSON, exits non-zero only if coverage failed (usable as a CI gate). Run via `npm run dryrun:candidate -- <artifact.json>`. |
| `tests/teamWeekRawV0CandidateDryRun.spec.ts` | Proves the behaviors below on a generated 544-row shape and on the committed 4-row sample. |

The dry-run report echoes the artifact's declared candidate status and pins promotion/governance off:

```ts
interface TeamWeekRawV0CandidateDryRunReport {
  sourceArtifactPath: string;
  provenanceStatus: string;   // echoed, e.g. "partial_real_data"
  governanceStatus: string;   // echoed, e.g. "ungoverned"
  governanceSource: string;   // echoed, e.g. "not_set"
  promoted: false;            // pinned literal — this path never promotes
  governed: false;            // pinned literal — this path never governs
  rowCount: number;
  deferredFields: string[];
  pressurePosture: 'insufficient_data';            // #55 posture, fixed label, never read
  coverage: ByeAwareCoverageValidationResult;       // from validateTeamWeekByeAwareCoverage
}
```

What this lane deliberately does **not** do:

- **No dense-grid change.** The scaffold/dense-grid validator (`validateTeamWeekFullLeagueCoverage`)
  is untouched; the real candidate lane invokes only the bye-aware validator. A test asserts the
  result carries the bye-aware-only `totalRowCount` field and accepts 544 (=32×17) rows without
  requiring a row every week (no `"is missing week N"` error).
- **No governance inference.** Coverage success never upgrades status — a valid 544-row dry-run still
  reports `ungoverned` / `promoted: false` / `governed: false`.
- **No synthesized byes, no fabricated fields.** The dry-run reads only `team_code`/`week`/`season`;
  it never touches metric values. Missing teams/rows fail closed in `coverage.errors` rather than
  being invented (the 4-row sample reports invalid coverage **without throwing** and stays
  ungoverned).
- **No fantasy-source pollution.** This lane runs through the candidate adapter, which already
  accepts the eight deferred-null `fantasyPoints*` fields as `null`. The finite-number requirement
  that the non-candidate `teamWeekRawV0Adapter` imposes is simply not on this path, so no fantasy
  field is added to or required of the team-state source contract — the narrow real-lane relaxation
  already lives in the separate candidate adapter.
- **No scoring / PPM / Product / ranking / advice.** `Object.keys(report)` is locked in tests; no
  score, ranking, or advice field is produced, and nothing routes through `src/score/`.

## Verified against the real artifact

Spot-checked against TIBER-Data's `team_week_raw_v0_2024_real_source_candidate.json` (544 rows, 32
teams, weeks 1-18): `pressureRateAllowed` and all eight fantasy-points fields are `null` on every row;
`redZoneTdRate` is `null` on the 11 rows where `redZoneTrips` is `0`. The fixture used in this PR's
tests embeds four real rows (ATL/NO week 4, KC/BAL week 1, DET/LAR week 1, BUF/MIA week 9) reflecting
that exact nullability, including the zero-red-zone-trips case.
