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

`node --test tests/week3ProvisionalPreparation.node.test.mjs` compiles only the inspector/binding and unchanged Week 1 field dependency with installed TypeScript, then executes 15 synthetic Node tests. All pass, including strict TypeScript compilation. Numeric values are invented; real game keys test scope, not actual football activity. No real raw input, player data, Data replay or Teamstate output was produced.

The test uses local installed TypeScript or an installed `tsc` executable and has no download/install fallback. It cleans its temporary build. Its filename does not overlap the repository's existing Vitest `tests/**/*.spec.ts` selection. Existing dependencies/scripts/Week 1 files are unchanged. Vitest and the full repository suite were not run in this executor; no claim about those suites is made.

## Independent-review repair

The first exact-head review found P2 `4145934068`: TypeScript 6 refuses positional source files when the repository's root tsconfig is discoverable. The original focused snapshot had no root tsconfig. This is a real harness defect, not a football-rule issue. The exact root configuration was retrieved and restored locally. The independent reviewer reproduced the failure on TypeScript 6.0.3; this executor has TypeScript 5.8.3 and did not reproduce that version-specific failure. The test now creates an explicit temporary project with only two input files, a separate output directory, no inherited config and no ambient types. It invokes `tsc --project`, not version-specific `--ignoreConfig`, then removes the temporary build. An added regression checks the isolated-project command. Fifteen synthetic tests pass locally on TypeScript 5.8.3 with the repository config present; TypeScript 6 re-verification belongs to the fresh independent review. No dependency, repository config, source binding or inspector logic changed. Fresh exact-head review is requested for this repair.

## Stop point

Independent exact-head review of this partial slice precedes any next binding change. Completing it requires exact missing witnesses, a reviewed authenticated adapter and a separate operator provisional-purpose/execution decision. The later run must retain the ten-field semantics, provisional correction/finality, source-native identity and missingness. ROP remains a parallel direct Data consumer, not dependent on TTS for supported player observations. No merge, production deployment, source admission, Forecast input, scheduler or report activation occurs here.


## October 5 bounded binding repair (supersedes missing-witness implementation status)

Joe authorized the exact bounded repair and one independent final-head review on October 5. This section is the current implementation checkpoint; prior preparation/review accounts above remain historical. Starting PR #96 head is `cee7f3d107ec307f05b9aa3bcc26904cafbb5889`, main is `9513fdae81d3a70189b8ebf03f38d40e1921204e`. No competing PR discussion was found. Dot owns this isolated bounded task under the current grant; another session's live execution status is not globally verifiable.

The only new files are `src/provisional/week3Binding.ts`, `src/provisional/adaptWeek3ProvisionalPacket.ts` and `tests/week3ProvisionalBinding.node.test.mjs`; only these paired preparation documents are edited. Existing shape inspector, shape descriptor, W1/W2 behavior, package/config, routes and runtime exports remain unchanged.

### Closed retained replay

The binding pins all 16 files: 13 source dependencies plus unchanged build receipt, manifest and independent-review JSON. Every pin carries repository path, exact commit, size and SHA-256. Full byte/hash/size/Git-blob authentication was completed independently during this authorized preparation. Historical manifest/build `independent_review=pending` fields remain unchanged. The separately pinned clean review binds Data repair head `4821a08ecad8c4ed7177b2acda0cb29d93a2649a`, tree `e0dde60d67b719258ea3cfb190702204d0bf7756`; storage head `739b7acdbc92f3b81463cb9a707e71ef8b0911ba` adds only review JSON/Markdown and the Vikings proposal and is not mislabeled as the reviewed head.

`authenticateWeek3Evidence` copies and hashes every supplied file, rejects missing/extra/wrong-size/drifted evidence and performs no producer inspection. The closed wrapper authenticates first, asserts replay/manifest/review semantics, then invokes the unchanged ten-field inspector. Its output remains purpose-pending, unadmitted and inactive. There is no generic pin override or generic week selector. The exported semantic assertion is a synthetic-test seam returning no artifact and grants no byte authentication or execution authority.

The replay is `fresh_offline_replay_materialization`, started `2026-10-03T15:34:05.067808Z`, completed `2026-10-03T15:34:05.379891Z`. Original candidate generation remains null. No retrieval/commit clock is relabeled as generation. Embedded source and schedule receipts use structural deep equality, preserving the retained W2 key-order repair. Unknown finality, open/provisional correction, null cutoff, ten fields, 16 reciprocal games, 32 teams, source rows, nulls, unavailable enrichments and exclusions remain intact.

### Future purpose verification, not acceptance application

`verifyWeek3PurposeReceipt` authenticates supplied receipt bytes against separately approved digest/size anchors and validates exact scope, ordered ten fields, sorted 32 teams, games, both final reviewed producer code heads, producer-review digest, authenticated-input-manifest digest, candidate, fresh replay and Data review identities. It returns void. Neither this verifier nor the wrapper creates, signs, writes or applies operator acceptance. There is no W1 hardcoded acceptance reference. No receipt exists or is accepted by this repair.

The caller must obtain the expectation anchors from Joe's separately approved final proposal, never from the untrusted receipt itself. A matching digest proves identity, not operator authority. The final acceptance event must supply the immutable receipt digest/size, final reviewed heads and review digest, actual acceptance time and permitted purpose. The verifier requires source admission, consumer activation and real-input execution flags false: a purpose receipt does not replace the separate execution grant. Applying acceptance or invoking the wrapper on real input remains blocked until that later decision.

Receipt schema: `teamstate_week3_provisional_purpose_receipt_v1`; purpose: `teamstate_ten_field_description`; scope: 2026 REG W3. Required keys and value shapes are defined by the verifier and synthetic fixtures. Test receipts are fictional in-memory values, not operator receipts. The authenticated input manifest identity is SHA-256 `cf1c2a555bda20199ca36642f427eb83edfbfbb5f4546e233ce994a0fe8aa1b1`; its private custody location is excluded from this public repository.

### Fresh checks and publication boundary

Installed TypeScript **5.9.2** strictly compiles the isolated source slice. Existing shape harness: **15/15**; new binding harness: **44/44**, no skipped tests. Commands: `node --test tests/week3ProvisionalPreparation.node.test.mjs` and `node --test tests/week3ProvisionalBinding.node.test.mjs`. No dependency install or TS6 claim. No full repository/Vitest execution claim. Synthetic tests cover receipt ordering, manifest membership, pins, clocks, review/head/tree mismatch, pending-receipt preservation and future receipt rejection. Real retained bytes are used only for input hash verification, never wrapper/inspector/producer execution.

There are no workflows in the pinned repository. Read-only Railway preflight on October 5 at 12:37–12:38 UTC found only production tracking `main`, no staged changes and PR environments disabled. That establishes the known Railway branch/preview boundary, not universal absence of other integrations. Draft state is preserved; no review bot is invoked by the implementer. An immutable commit is supplied for one independent exact-head review before any non-force branch update. No merge, deployment, provider access, runtime, schedule, source admission or cohort expansion is authorized.

Stop after the one independent review if material findings or failed checks arise. The final review and run/acceptance proposal must return to Joe; this document is neither review completion nor execution permission.
