# Fresh independent review: private TTS Weeks 1–5 candidate

## Target and authority

Review the exact PR head and base named in the review-request comment. This is a new review of the multiweek successor, not a continuation of the old #96/#97 disposition. Joe directly requested PR publication and fresh independent review on October 15, 2026; this document is the assistant-materialized handoff. Keep the PR draft, unmerged and inactive. Report findings; do not implement, merge, deploy, activate a consumer, acquire sources, or publish private evidence under this request.

Fourteen code/definition files are byte-identical to the retained candidate and pinned in PUBLICATION-MANIFEST.json. The public-only README, this handoff, publication manifest, .gitignore and private CommonJS package boundary are packaging additions. Generated JS is not committed; the two locally regenerated JS payloads matched their archived originals byte-for-byte. The root repository's ESM/build/runtime configuration is untouched.

This is a review location for the delivered release, not a second producer or new small-cohort experiment. The directory is intentionally isolated from production entry points until a separately authorized integration decision.

## A. Public source review — available now

Inspect the actual implementation, not only these descriptions or passing tests:

- Compare `code/src/provisional/inspectReleaseWeek.ts` with the exact retained `code/upstream/inspectWeek4Boxscore.ts`. Check the week/game generalization, ten-field semantics, signed yards, limits, duplicates, reciprocal identities and matched/unknown reconciliation rules.
- Follow `code/release.py` from archive pin through manifests, source notices, witness/review bindings, raw CSV reconciliation, schedule scope, inspector invocation, aggregation, player joins and output. A static digest is integrity, not evidence of independent rights or consumer approval.
- Verify no-game slots come from the pinned schedule, not from absent boxscore rows. Test wrong season/week/game/team, duplicate identifiers, omitted counterparts, malformed/unknown fields, altered bytes and source conflicts. Do not treat schedule membership as game finality.
- Verify through-week views and exports exclude later observations from displayed calculations, while preserving the distinction between chronological retrospective filtering and original pre-kickoff availability. Inspect all serialized metadata and player selectors, not only cumulative totals.
- Verify sums and per-observed-game denominators, paired nonmissing rates and zero-denominator refusals. Check that missingness survives summary, text, chart, table and export paths; test incomplete records rather than relying only on the complete retained batch.
- Check exact ROP joins, original credited-target versus pass-attempt denominators, selected-player remainders and unassigned source gaps. Explicitly test missing/ineligible ROP from the outer loading path as well as `make_output(..., None, ...)`; optional player evidence must not falsely erase or certify the core team layer.
- Check reciprocal opponent lineage and the limits of team fumbles lost. The view must not imply that all lost fumbles were caused by the opposing defense or that unadjusted output is a defensive grade.
- Inspect `code/render_view.py` and the unpopulated HTML template for escaping, inert JSON handling, source leakage, CSP/network behavior, meaningful selectors, downloads, missing states and misleading status text.
- Verify safe local output paths, source immutability and no-overwrite behavior, including symlink/ancestor/path edge cases where relevant. Inspect code actually called by reproduction, not just a wrapper's stated intent.
- Confirm no runtime, provider, scoring, Forecast, scheduler, canonical source, public data publication or existing branch is activated by this isolated addition.

From `pilots/tts-2026-w01-w05`, with an already-available TypeScript compiler and Node:

```sh
tsc --project code/tsconfig.json
node --test code/tests/inspector.test.cjs
```

Publication preflight reran these: TypeScript 5.8.3 passed; Node 22.16.0 passed 78 synthetic tests. All copied Python sources compiled syntactically. These are executor checks, not this independent review. No new full-repository test, Python integration run or final private-output certification is claimed by publication.

The copied `code/tests/test_release.py` has a real-private-input `setUpClass`: its 28 tests cannot run from a public-only checkout. `code/tests/raw_verifier.py` also requires private inputs and outputs. Their code is inspectable here; report execution as unavailable unless separately authorized private bytes are actually accessible. Do not make their absence pass by skipping fixtures silently, inventing data or downloading replacements.

## B. Private final-release review — access must be established

GitHub repository access does not provide ChatGPT Library access. Only an independent context with existing authorized private access can complete this part. Do not change permissions or move private artifacts into this repository.

Exact retained candidate:

- `TIBER-TTS-2026-W01-W05-Private-Candidate.zip`
- 27,254,558 bytes
- SHA-256 `3083775eb46bd68c6ea528f7374a9c5af017f7385d0fb09db9d12e16d1299729`
- Release `tts-private-2026-w01-w05-20261015T121257Z`, revision `candidate-r1`
- Internal manifest SHA-256 `5b0ef746c72a39623855d3ad0592d93e7302ac9ccbb414ebf85f69b21b9e7295`, 65 listed members

Use the original package in a separate private directory. Authenticate its manifest and code against the public copy; do not replace its source files, clocks or receipts with this publication's metadata. Read its source-purpose and repeated-private-use records, exact input/output bindings, historical comparison receipts and evidence limits. Verify baseline values, reciprocal output, weighted rates and player attachments against actual retained sources. Reproduce only through the bounded offline path when that private review context has the authorized input access; no ROP producer execution, new acquisition or publication is permitted.

Required negative controls include missing/invalid optional ROP, missing required team data, zero versus null, wrong game/identity/cutoff, digest drift, source conflict, partial denominators and later-week mutation. Review Seattle's retained profile as a usability example without publishing private numerical extracts. Independently check the unassigned gaps and full coverage accounting rather than accepting the executor summary.

The original candidate reports 32 teams, 160 coverage slots, 158 observed records, two schedule no-game slots and 1,580 baseline values. Those are attributed delivery claims until this review independently verifies the actual bytes. Previous raw-value/historical/reproduction checks were all in the constructing agent's context. Previously reported viewport acceptance is not physical-iPhone or cross-conversation acceptance.

Inspect the final HTML at 375, 390 and 820 pixels where a permitted browser is available; exercise team/week/player selection, missing paths and exports. Record any local-file navigation limitations separately from rendering. Attempt an independently authorized package/Seattle readback and identify whether it is a separate agent, separate host, separate conversation or scheduled context. Do not conflate these access classes.

## Disposition required

Return reviewed head/base, review scope, actual checks, severity-ranked findings with file/line locations, and any unavailable portion. Distinguish:

- public code review clean / findings / incomplete;
- private exact input-output review passed / findings / not performed;
- private cross-context readback passed / failed / not tested.

A code-only clean result must explicitly leave private-release review and accepted recurring Morning Playbook use pending. A review request, bot reaction, completed check, prior review or lack of findings is not by itself full-release acceptance. If the head changes, do not transfer the disposition to the replacement automatically. Final merge and operational activation remain outside this review.
