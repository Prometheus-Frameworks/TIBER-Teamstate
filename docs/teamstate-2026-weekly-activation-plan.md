# TTS 2026 weekly activation intent and pilot pickup

Recorded: 2026-09-22.

## Intent and present status

Joe intends to bring TIBER-Teamstate online for the 2026 NFL season, beginning with observed weekly team-environment evidence for Weeks 1 and 2. The recommended first delivery is a small **2026 weekly descriptive Teamstate pilot**.

This records direction and the next pickup point before implementation. The current authorization covers documentation only; it does not activate acquisition, a run, source admission, consumers, publication, deployment, or Forecast integration.

Repository inspection on 2026-09-21, reconfirmed against main `61485d1309484bad300378ef5d9aaa67365d3d62` on 2026-09-22, found no recorded 2026 Week 1 or Week 2 Teamstate run or corresponding weekly artifact. This is a repository-evidence statement, not proof that no unrecorded local experiment exists.

| Existing surface | What it establishes |
| --- | --- |
| Governed 2024 team-week source and handoff | Historical 32-team / 544 team-game capability; not a 2026 weekly run |
| `data/processed/2026_teamstate_context_v0.json` and other 2026 seeds | Operator-seeded rookie/landing context; not observed 2026 weekly performance |
| Representative artifacts in `output/` | Fixture/scaffold examples; not current-season production evidence |
| Public-report implementation ([PR #91](https://github.com/Prometheus-Frameworks/TIBER-Teamstate/pull/91)) | 2024 report generation with publication disabled |
| GitHub Actions and HTTP service | No Actions run history found; serving does not execute the analytics pipeline |

## Next pickup point: field-by-field readiness inventory

**Begin with a bounded, read-only inventory of the 2026 Data-to-Teamstate handoff.** Refresh repository heads and inspect the relevant TIBER-Data contracts, artifacts, receipts and Teamstate adapters before proposing implementation.

Produce one readiness matrix with, for each proposed field:

- exact source artifact/ref/hash and season/week scope;
- observed source field or deterministic formula, including numerator and denominator;
- team/game identity, expected versus observed coverage, and duplicate/missing-row handling;
- source observation/retrieval time separately from artifact generation time;
- game-completion evidence separately from source-record finalization/correction status;
- admitted use, or explicit candidate/preliminary/unavailable status;
- null semantics, adapter compatibility, missing evidence and responsible repository.

Start by checking whether any existing 2026 Data evidence can support a useful descriptive subset. Artifact existence does not establish admission, and weekly player/team box scores do not automatically satisfy the play-by-play-derived `team_week_raw_v0` contract.

The pickup deliverable should identify the smallest useful supported field set, exact blockers, reusable code, and one bounded implementation/run proposal. Stop before acquiring new football records or running the pilot. If support is insufficient, return a specific upstream evidence request rather than filling gaps or declaring the entire system ready.

## Main gaps to resolve

1. **2026 source handoff.** The inspected Data team-week builder is fixed to 2024 and derives from play-by-play plus schedules. Establish a Data-owned 2026 handoff with coverage, provenance, corrections and explicit use status. Source acquisition and canonical fact production remain in TIBER-Data.
2. **Weekly execution assumptions.** The basic governed adapter accepts integer seasons, but the readiness default uses 2024 coverage and Forecast Run 2 explicitly pins 2024 input to 2025 target. Design and validate the 2026 weekly scope without repurposing or weakening that historical contract.
3. **Evidence eligibility.** Determine what can be inspected as preliminary descriptive evidence and what requires stronger completion/finalization evidence. Preserve unresolved states; do not borrow Forecast eligibility or treat an upstream candidate as governed.
4. **Short history.** Existing movement semantics require at least four weeks. Weeks 1 and 2 can support eligible descriptive snapshots, but movement labels/verdicts must remain `insufficient_data`. Do not lower thresholds to manufacture a trend.

## Recommended pilot after a separate implementation/run decision

1. Produce one isolated, inspectable **2026 Week 1 descriptive candidate** from exact accepted inputs.
2. Validate coverage, source-to-output traceability, formulas, nulls, deterministic reproduction and evidence status.
3. Repeat for **Week 2** through the same validated path after its inputs independently qualify.
4. Show supported weekly observations side by side. Emit arithmetic changes only where field definitions, denominators and coverage are comparable; keep these distinct from movement classifications and predictions.

Aim for league-wide coverage where evidenced, with missing teams/games visible. Do not force 32 populated rows or imply a complete week from a partial source. Candidate fields to assess include scoring, offensive volume, pace, pass tendency, efficiency and drive/red-zone context; this list is a discovery checklist, not a promise that all fields are currently available.

Reuse existing adapters, coverage validation and null-aware candidate/rehearsal work where compatible. Check the documented null-to-zero risks before selecting the legacy scoring pipeline. No unsupported metric should become zero, a score or a confident label. Pressure remains unavailable/deferred without an eligible source; sacks are not a pressure-rate substitute.

## Pilot acceptance and later activation

A future pilot should provide:

- exact code/input pins and a run receipt identifying season, week and evidence cutoff;
- expected/observed team-game coverage and explicit exclusions;
- separate observed facts, deterministic derivations and unavailable fields;
- source and correction status preserved through the output;
- reproducible results and focused validation of coverage, nulls and temporal scope;
- no unsupported movement verdict for fewer than four weeks;
- a readable candidate report with a clear list of unresolved blockers.

A reviewed pilot candidate is not automatically a promoted/current artifact. Recurring execution, source promotion, TIBER Team consumption, public publication and deployment each remain later decisions. Forecast integration is a separate evaluated feature path; the descriptive pilot need not wait for Forecast, and does not authorize changing it.

## Reference points

- [TTS v1 ownership boundary](tts-v1-team-state-layer.md)
- [Candidate consumption](teamstate-candidate-consumption-team-week-raw-v0-2024.md)
- [Null-aware transform feasibility](reviews/team-week-raw-v0-candidate-transform-feasibility.md)
- [Governed consumption](teamstate-governed-consumption-team-week-raw-v0-2024.md)
- [Historical Forecast Run 2 contract](teamstate-forecast-run2-artifact-2024.md)
- [2026 operator-seeded context](2026-teamstate-context-v0.md)
- [Output artifact policy](output-artifact-policy.md)
- [Data historical team-week builder](https://github.com/Prometheus-Frameworks/TIBER-Data/blob/main/scripts/build_team_week_raw_v0_2024_candidate.py)
- [Data weekly box-score intake PR #273](https://github.com/Prometheus-Frameworks/TIBER-Data/pull/273) — separate evidence lane; recheck current receipts and admission before use
