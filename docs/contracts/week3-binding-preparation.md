# Week 3 Teamstate binding preparation — shape only

**Status: partial interface preparation; not a reviewed-source adapter or a real-input execution.**
Joe authorized reconciliation, minimum isolated Week 3 binding/test preparation and independent review on September 30. No merge, source admission, real-player producer run, additional cohort expansion, Forecast change or scheduled-report activation is permitted. This is an agent-materialized record, not a use or merge receipt.

## Existing work preserved

Base: `9513fdae81d3a70189b8ebf03f38d40e1921204e`. Main contains the Week 1 adapter; the unrelated README link PR #93 remains untouched. No existing Week 3 branch was identified in the inspected branch list.

The real Week 2 work is retained outside main. This preparation recovered:
- initial implementation ZIP `80d3169badd54f0e837c563cfae137a1e6435cbcbcda5a3c444e401d9176bf40`;
- repair ZIP `b9fb2666869ffe6441170942fce089daeb0381f77f10bd2ebad410d89fc04743`;
- pure Week 2 inspector SHA-256 `92955d9ff87d3cd158ebcc96711973ceac23e11e6626607ed206eb3a32fbe29d`;
- repaired receipt adapter SHA-256 `56027626d11060f8e038c47332e2f581c69ee26b00aaab693cae2090b733b570`.

The Week 2 receipt repair uses structural equality rather than JSON property order. None of these original bytes is changed, imported into main, or republished as Week 3 evidence. A future Week 3 source adapter must preserve that correction. Its absence from main is not evidence the work never occurred.

## Minimum prepared slice

`week3BindingPreparation.ts` fixes only the requested game's scope and reuses the unchanged `WEEK1_FIELDS` ten-field order. Its preparation descriptor explicitly says real input is disabled and generation/review qualification is missing. This is not a caller-toggle activation mechanism.

`inspectWeek3Boxscore.ts` copies the retained Week 2 pure shape-validation rules with only the explicit Week 3 scope/game binding. It returns `unadmitted_shape_inspection`, never an authenticated Teamstate artifact. It validates reciprocal game/team membership, unique source rows, lifecycle, unknown finality, supported numeric/null fields and source-team reconciliation. It does not hash a candidate, check a source-review packet or confer purpose eligibility. No runtime export/route or real-input runner is added.

The separate inspector avoids rewriting the working Week 1 path or silently promoting unpublished Week 2 files. It is intentionally not a new generic week selector or a broader environment model. No pace, pressure, neutral pass rate, route, scoring-area or movement field is introduced.

## Missing binding witnesses

The exact selected Data candidate/head/support are listed in the non-executable `week3-binding-preparation.json`. #277's canonical ancestry is preserved, and the latest independent reconciliation review reports no major issues at `eac3b9bc22` (comments `5913251206` / `5913333560`). Earlier P1 comments remain intact and any eventual merge must be normal/ancestry-preserving.

The exact retained input manifest, authenticated members and review receipt still need to be supplied to a real source adapter. The original candidate-generation witness was not established in the inspected Data audit/handoff; source retrieval and Git publication clocks are not substitutes. No bytes from the separate September 29 exploratory candidate are adopted. The full real-input adapter is deliberately not manufactured around these gaps.

## Checks and limits

`node --test tests/week3ProvisionalPreparation.node.test.mjs` compiles only the inspector/binding and unchanged Week 1 field dependency with installed TypeScript, then executes 14 synthetic Node tests. All pass, including strict TypeScript compilation. Numeric values are invented; real game keys test scope, not actual football activity. No real raw input, player data, Data replay or Teamstate output was produced.

The test uses local installed TypeScript or an installed `tsc` executable and has no download/install fallback. It cleans its temporary build. Its filename does not overlap the repository's existing Vitest `tests/**/*.spec.ts` selection. Existing dependencies/scripts/Week 1 files are unchanged. Vitest and the full repository suite were not run in this executor; no claim about those suites is made.

## Stop point

Independent exact-head review of this partial slice precedes any next binding change. Completing it requires exact missing witnesses, a reviewed authenticated adapter and a separate operator provisional-purpose/execution decision. The later run must retain the ten-field semantics, provisional correction/finality, source-native identity and missingness. ROP remains a parallel direct Data consumer, not dependent on TTS for supported player observations. No merge, production deployment, source admission, Forecast input, scheduler or report activation occurs here.
