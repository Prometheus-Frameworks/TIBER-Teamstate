# Metric definitions and missingness

The authoritative grain is one native team × one exact game × 2026 REG week, with a separate coverage slot for every team-week. The original Data field definitions are retained; no new model score is added.

| Field | Meaning / boundary |
|---|---|
| attempts | Team source passing attempts; not receiver-credited target count or all dropbacks. |
| completions | Team source completed passes. |
| passing_yards | Source passing yards; not net passing yards, not adjusted for sacks. Signed integer values are preserved. |
| passing_tds | Passing touchdowns; not total team touchdowns or scoreboard points. |
| passing_interceptions | Source interceptions thrown by the team, not interceptions made by its defense. |
| sacks_suffered | Recorded sacks of team passers; not total pressures and not a diagnosis of offensive-line fault. |
| carries | All team rushing attempts, including quarterbacks and source-defined rushing events. Not an RB-room denominator or called-run rate. |
| rushing_yards | Source rushing yards; signed integer values are preserved. |
| rushing_tds | Source rushing touchdowns; no passing/receiving double counting into a team points total. |
| fumbles_lost_total | Source total fumbles lost across represented team participants. Not every fumble, a specific player's mistakes, or necessarily offense-only events. |

Through-week totals sum only observed field values on supported games at or before the selected week. Per-observed-game figures divide by that field's observed-game count, showing expected/missing counts. Missing values do not become zero. A no-game slot contributes no observed game.

Rates use matched nonmissing operands from the same games:
- Completion percentage = 100 × sum(completions) / sum(attempts).
- Passing yards per attempt = sum(passing_yards) / sum(attempts).
- Rushing yards per carry = sum(rushing_yards) / sum(carries).

Zero denominators return unavailable; weighted cumulative rates are not means of weekly rates. Descriptive deltas compare explicitly identified observed weeks, preserving changes in opponents. They are not opponent-adjusted, causal, predictive or validated change-point detections.

## ROP attachment

Original player carries, targets, receptions and applicable shares are attached by native ID plus exact season/week/game/team. Target share uses receiver-credited team targets from the original ROP candidate, never pass attempts. Carry share uses all-team carries. RB-room shares remain outside this attachment. Unselected players are not redistributed into a fake full-population share. The remainder is the source-team denominator minus the sum of attached selected-player observations, labelled other/unselected. A remainder does not identify which player received it.

106 original missing-source player-week records are preserved globally because their team membership is not established by their missing rows. No roster/availability claim is inferred. The original ROP population remains 209 identities; the original ROP producer is not run.

## Opponent output

Join the other team's exact row from the same game and preserve its source CSV row and same snapshot lineage. The opponent's passing/rushing/interception/sack/fumble values are still that offense's source observations. Especially for total fumbles lost, do not relabel all events as a defensive accomplishment. This view is unadjusted and not a defense, coverage, unit-quality or fantasy D/ST score.

## Status vocabulary

`observed`: supported exact team-game row. Numeric zero is meaningful when observed.
`no_game_in_pinned_schedule`: no team appearance in the retained full weekly schedule; not inferred from a missing boxscore.
`missing_source_evidence`: a scheduled appearance lacks supported source evidence.
A field may independently be null or have a reconciliation conflict; conflicts fail the affected computation rather than being smoothed away.
`private_candidate_pending_independent_release_review`: this successor's final review gate remains open, even where all local arithmetic passes.
