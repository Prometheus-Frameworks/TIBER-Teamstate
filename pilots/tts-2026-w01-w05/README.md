# Private TTS Weeks 1–5 candidate: code-review publication

This directory preserves the implementation behind the private 2026 REG Weeks 1–5 team-profile candidate. It is isolated from the production entry points, package scripts, runtime routes and existing Week 3/Week 4 branches. Nothing here activates a producer, deployment, scoring system, forecast or recurring consumer.

## Exact candidate and publication scope

- Release: `tts-private-2026-w01-w05-20261015T121257Z`, revision `candidate-r1`.
- Private archive: `TIBER-TTS-2026-W01-W05-Private-Candidate.zip`.
- Archive: 27,254,558 bytes; SHA-256 `3083775eb46bd68c6ea528f7374a9c5af017f7385d0fb09db9d12e16d1299729`.
- Private manifest: 65 members, SHA-256 `5b0ef746c72a39623855d3ad0592d93e7302ac9ccbb414ebf85f69b21b9e7295`.
- Source baseline: Teamstate PR #97, `4a602237db87c17afefcb1b0543551e328cc6697`, specifically `src/provisional/inspectWeek4Boxscore.ts`.

This public review copy includes source code and sanitized review documentation, not the private archive, raw inputs, output data, populated HTML, screenshots, private storage locators or original conversation records. The retained candidate is unchanged. `PUBLICATION-MANIFEST.json` separates twelve unchanged copied files from the two source files repaired after the first independent review. The repaired source is not byte-identical to `candidate-r1` and does not certify or replace that private package.

The operator directly requested publication as a PR and a fresh independent review on October 15, 2026. This is an agent-materialized record of that instruction, not independent human-origin proof or authority for merge, deployment, source acquisition or subsequent activation.

## Review in two distinct parts

1. Review the exact PR head's source, source-authentication path, scope checks, arithmetic, identity joins, missingness, rendering, exports and synthetic controls. Record actual checks and findings.
2. A separate authorized private-artifact review must verify the exact candidate's input/output bytes, source-purpose records, reproduction and private readback. Access to this repository does not establish access to ChatGPT Library. A clean GitHub code review alone cannot certify the private dataset or accepted recurring Morning Playbook use.

Use `REVIEW.md` for the requested checks and limits. Do not upload the missing private artifacts to make a public review pass. Report any inaccessible portion as not reviewed, not clean.

## Local code checks

From this directory, with installed Node and TypeScript:

```sh
tsc --project code/tsconfig.json
node --test code/tests/inspector.test.cjs
node --test code/tests/profile-view.test.cjs
python -m unittest discover -s code/tests -p test_release_synthetic.py -v
```

The added suites use synthetic evidence only: eleven Python entry-point tests exercise the actual loader, Data builder, TTS bridge and aggregation; sixteen template-script tests exercise missing comparisons, zero/signed values and unavailable player counts. They do not run or substitute for the 28 retained-input tests in `test_release.py`. Template-script checks use an in-memory DOM, not browser or physical-phone acceptance.

## Review repair

The first Codex review at `74958834db39c322048def8ddee8b189f8ec2882` found two P2 defects. `produce(include_rop=False)` now passes that choice into `load_and_qualify`, skipping both ROP attachment manifest reads and ROP payload/review qualification. Required container identity, source manifests, Data review, raw team/player CSV reconciliation, witnesses and schedules remain required. The archive itself contains the required TTS inputs even though its historical filename includes ROP. The enabled/default ROP path retains strict attachment qualification; invalid requested ROP is not silently certified or converted into a successful attachment.

Narratives compare sacks suffered and passing yards separately, only when both operands are finite. Missing pairs are explicitly unavailable. Player-remainder prose uses the same unavailable-value formatter as the tables. No private output has been regenerated, replaced or accepted by this repair. Fresh review must bind the corrected PR head; the first review cannot be transferred to it.

Private integration and reproduction checks require the separately retained candidate package and its exact local inputs/records. They are not expected to pass from a public-only checkout. Do not download or invent substitute football evidence.

The original candidate records 78 inspector tests and 28 profile tests passing, plus same-executor raw-value, historical-regression and seven-file byte-reproduction checks. Those are attributed construction results, not independent certification. Browser acceptance used authored-markup rendering at 375, 390 and 820 pixels; file navigation, physical-iPhone and independent cross-context acceptance were not established.

## Semantic boundary

Ten source-native fields only: attempts, completions, passing yards, passing touchdowns, interceptions thrown, sacks suffered, carries, rushing yards, rushing touchdowns and fumbles lost. Derived rates are ratios of summed compatible operands, with explicit missingness. Opponent output is an unadjusted same-game reciprocal view, not a defensive grade. ROP attachment uses the existing selected population and original team denominators, not a new ROP run or participation census.

Finality remains unknown; corrections remain open. Retrospective through-week filtering is not proof of historical pre-kickoff availability. No pace, EPA, neutral pass rate, coverage, pressure, route, blocking, ability or fantasy projection is manufactured. Private repeated-use acceptance remains pending exact final review.
