# Isolated Week 1 provisional adapter

Scope: local implementation under the [operator acceptance receipt](receipts/teamstate-week1-provisional-acceptance-2026-09-22.md). Teamstate base: `467583ae331e6d6c22e935e4e25f751384ed6bb6`.

## Interface and containment

`src/provisional/adaptWeek1ProvisionalPacket.ts` exports a pure function accepting an in-memory `ReadonlyMap<string, Uint8Array>`. Keys are exact Data-relative evidence paths from `week1Binding.ts`. They are identifiers only; the adapter does not open them or execute any supplied code. Every one of the eighteen exact byte lengths and SHA-256 values must match, with no missing or extra member. It copies verified bytes before parsing. No caller can pass a replacement pin, scope, purpose or field list.

The function returns an isolated `teamstate_week1_provisional_description_v0` object with ten observed source-native metrics, raw game/team identity, source row pointers, selected reconciliation records, field-null counts, complete pinned evidence manifest, original source/schedule receipts, separate clocks and review identity. Original attribution survives in the receipts. Receipt text remains untrusted data. Player rows and excluded metric values are not emitted.

The output distinguishes operator-accepted provisional input from `sourceConsumerAdmitted:false`, `consumerActivated:false`, `productionReady:false`, unknown finality and unestablished source-record finalization. It makes no new historical availability claim. There is no wall-clock generated field: identical inputs yield identical objects. A future authorized runner must record its own execution time/code identity separately from source clocks.

`inspectWeek1Boxscore.ts` is a shape-only inspector with an explicit `unadmitted_shape_inspection` result. It accepts bounded JSON bytes for synthetic tests, validates the exact week and game/team set, reciprocal opponents, unique source/team rows, integral/ranged values and reconciliations, and projects only the allowlist. It cannot grant source or run authority. Nulls remain null; signed yardage and observed zeros are preserved. Partial/mismatched inputs fail for this exact full-membership packet; no rows are synthesized. Supporting a later partial or different-week packet requires a separate purpose/binding decision.

No module is re-exported from `src/index.ts`, imported by the existing pipeline/server, attached to a route, or exposed as an npm/CLI command. No filesystem/network/writer/scoring dependency is added. Historical Teamstate contracts and Forecast Run 2 remain unchanged.

## Validation and limits

Focused synthetic tests cover allowed projection, LA identity, null/zero/negative yards, malformed scope, duplicate/missing/conflicting identity, source row provenance, invalid numeric/reconciliation values, false finality/admission, oversized input, deterministic ordering and byte nonmutation. Packet tests reject changed/missing/extra/wrong-size members, preserve metadata and verify no network calls.

Wrapper success tests explicitly mock hash results **for registered synthetic buffers only**; otherwise the mock delegates to real SHA-256. They do not establish real-source acceptance. The real candidate and raw files are never read by these tests. No adapter call using actual Week 1 data or real pilot report has been executed. A separately authorized real run must verify actual hashes with unmocked crypto and record code/input identities and results.

Run focused checks with `npm test -- tests/week1Provisional.spec.ts` and `npm run check`. These execute no football data pipeline. The earlier recovery audit already established real bytes and field evidence; it is not repeated as a pilot during implementation.

Implementation validation on September 22: **22/22 focused tests passed; TypeScript `npm run check` exited 0.** Dependencies were installed from the existing lockfile with lifecycle scripts disabled; package metadata/lockfile did not change. No full pipeline, real-data invocation, public service or deployment was run. These are implementer checks; independent code review is pending.

## Next pickup

Review this exact implementation and receipt first. A real-data pilot run is a separate operator action after review; it must call the isolated function with the exact accepted packet, retain source status and produce only a candidate report. Consumer activation, publication and deployment remain later decisions.
