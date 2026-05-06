# Teamstate 2026 Context v0 (Operator-Seeded)

## Purpose

This artifact is an inspectable, operator-seeded team environment layer for 2026 rookie landing-spot analysis.

- Teamstate captures team/offensive context, not player scoring outcomes.
- This is intentionally conservative and inspect-only.
- Unknowns are explicit via `operator_seeded_unknown` rather than implied certainty.

## May TIBER-Data Boundary Alignment

Teamstate context rows are interpretation artifacts, not raw evidence stores. After the May TIBER-Data milestone, governed source/provenance truth for play-caller PROE scaffolds, Receiving Role Integrity proxy scaffolds, GOBLIN evidence, and GOBLIN research candidates should live upstream in TIBER-Data.

For this v0 context artifact, operator-seeded unknowns remain placeholders until source-backed TIBER-Data artifacts are available. Teamstate may later consume those governed inputs to explain team environment, but this document does not authorize fabricated tendencies, copied screenshot values, proprietary route claims, mutation of TIBER-Data artifacts, or scoring/ranking changes.

## Artifacts

- `data/processed/2026_teamstate_context_v0.json`
- `data/processed/2026_team_landing_context_tags.json`

## Canonical Teamstate Row Schema

```json
{
  "season": 2026,
  "team": "SF",
  "team_name": "San Francisco 49ers",
  "head_coach": "operator_seeded_unknown",
  "offensive_coordinator": "operator_seeded_unknown",
  "play_caller": "operator_seeded_unknown",
  "qb_context": "operator_seeded_unknown",
  "offensive_identity_tags": ["operator_seeded_unknown"],
  "personnel_usage_tags": ["operator_seeded_unknown"],
  "pace_pass_environment_tags": ["operator_seeded_unknown"],
  "positive_team_context_tags": [],
  "risk_team_context_tags": [],
  "rookie_landing_context_tags": [],
  "source_status": "operator_seeded_unknown",
  "notes": "Operator-seeded 2026 team context v0 for inspect-only downstream joins."
}
```

## Required Teams in v0

SF, CLE, TEN, PHI, LAR, SEA, PIT, WAS, JAX, KC, BUF, NYG, MIA, CHI, HOU, NO, NYJ, ATL, CAR, TB, BAL, NE, ARI.

## Validation

Validator:

- `scripts/validate_2026_teamstate_context.py`

Checks:

- required team set exists with no duplicates
- required fields per row exist
- `positive_team_context_tags` and `risk_team_context_tags` are arrays
- no known risk tags appear in `positive_team_context_tags`
- `source_status` is `operator_seeded` or `operator_seeded_unknown`

Run:

```bash
python scripts/validate_2026_teamstate_context.py
python -m unittest tests/test_2026_teamstate_context.py
```

## Downstream Join Guidance (TIBER-Rookies)

Join keys:

- `season`
- `team`

Recommended usage:

1. Join `2026_teamstate_context_v0.json` by `season + team`.
2. Use `positive_team_context_tags` and `risk_team_context_tags` as transparent context flags.
3. Preserve `source_status` and `notes` in exported inspection outputs for auditability.
