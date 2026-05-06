# Teamstate Boundary After the May TIBER-Data Milestone

## Purpose

This note aligns Teamstate with the May TIBER-Data milestone. TIBER-Data now owns governed source/provenance truth for source-backed GOBLIN evidence, GOBLIN research candidates, play-caller PROE scaffold/input validation, and Receiving Role Integrity / route participation proxy scaffold work.

Teamstate's role is to explain the **team environment** after those facts are proven upstream. Teamstate should consume governed artifacts, preserve their audit context, and translate source-backed team facts into deterministic environment language.

## System Boundary

| Layer | Responsibility |
| --- | --- |
| TIBER-Data | Proves what happened and owns governed source/provenance truth. |
| Teamstate | Explains the team environment using governed upstream artifacts. |
| Role-and-opportunity | Explains player role and opportunity. |
| GOBLIN | Finds ugly-output legitimate-signal candidates and maintains candidate/evidence context. |
| FORGE | Grades fantasy signal. |
| TIBER-Fantasy | Serves as the cockpit that assembles and presents governed ecosystem signals. |

Teamstate should not become a shadow source database. If a team-context claim depends on source-backed evidence, the evidence belongs in TIBER-Data first, then Teamstate can consume the resulting governed artifact.

## Future TIBER-Data Inputs for Teamstate

The following inputs are expected to become Teamstate inputs only after they are governed/source-backed in TIBER-Data:

- play-caller PROE, once source-backed
- team pass tendency
- pass-play environment
- red-zone tendencies
- Receiving Role Integrity proxy aggregates, once source-backed
- GOBLIN candidate context as read-only signal, not a scoring input by default

GOBLIN candidate context is read-only context for Teamstate by default. It can help explain why an environment should be inspected, but it should not become a scoring input unless a later PR explicitly changes scoring policy and documents that change.

## Guardrails

Teamstate contributors should follow these guardrails when adding or editing team-environment context:

- No fabricated team tendencies.
- No copied screenshot values.
- No proprietary route claims.
- No mutation of TIBER-Data artifacts.
- No scoring/ranking changes in this docs-only alignment PR.

## Consumption Pattern

1. TIBER-Data governs and publishes source-backed artifacts.
2. Teamstate ingests or references those governed artifacts without mutating them.
3. Teamstate emits deterministic team-environment explanations and preserves upstream provenance/audit status where applicable.
4. Downstream layers decide how to use Teamstate context alongside Role-and-opportunity, GOBLIN, FORGE, and TIBER-Fantasy outputs.
