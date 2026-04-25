# Rookie Landing Context Tags (2026 Seed)

## Purpose

This artifact gives downstream consumers an inspectable, team-level context layer for post-draft rookie interpretation.

Ownership boundaries:

- **Teamstate owns team/environment context** (coaching tendencies, volume risk, role friction, depth-chart pressure).
- **TIBER-Rookies owns prospect and draft translation** (prospect profile, draft capital effects, and player-level interpretation).
- **Downstream integration should join both layers** so context logic is centralized in Teamstate and does not get duplicated in rookie-only repos.

## Scope and Constraints

- This is a simple context artifact, not a projection model.
- No scoring logic changes are made in Teamstate.
- No projections are created in this deliverable.
- No proprietary data scraping is used.
- Every row is currently `source_status: "operator_seeded"` until canonical 2026 team/offense data is available.

## Artifact

Path:

- `data/processed/2026_team_landing_context_tags.json`

Row schema:

```json
{
  "season": 2026,
  "team": "SF",
  "team_name": "San Francisco 49ers",
  "context_tags": [],
  "positive_context_tags": [],
  "risk_context_tags": [],
  "notes": "",
  "source_status": "operator_seeded"
}
```

## Included Teams (Initial 2026 Rookie Relevance Set)

- SF, CLE, TEN, NO, LAR, PHI, NYJ, SEA, PIT, MIA
- CHI, CAR, TB, BAL, NYG, WAS, ATL, JAX, HOU, NE, ARI

## Validation

Validator:

- `scripts/validate_team_landing_context_tags.py`

Checks include:

- Required schema fields.
- 2026 season enforcement.
- Expected team set and uniqueness.
- `source_status` enum enforcement.
- Tag arrays are string arrays with no duplicates.
- `context_tags` equals `positive_context_tags + risk_context_tags`.

Run:

```bash
python scripts/validate_team_landing_context_tags.py
```

## 2026 Taxonomy Refinement Notes

To reduce false-positive "good context" signaling, the following tags are classified as
`risk_context_tags` (not `positive_context_tags`) wherever they appear:

- `depth_chart_volume_cap`
- `target_concentration_ahead`
- `delayed_start_path`
- `veteran_depth_chart_block`
- `steelers_wr_room_watch`
- `shared_backfield_context`
- `scheme_transition_variance`

The following tags remain valid `positive_context_tags` where present:

- `shanahan_efficiency_environment`
- `yac_creation_scheme`
- `concentrated_wr_investment`
- `rookie_wr_priority_signal`
- `wr1_depth_chart_path`
- `top5_wr_opportunity_insulation`
- `kellen_moore_pace_boost`
- `pass_environment_upside`
- `mcvay_developmental_environment`
- `efficient_passing_environment`
- `high_efficiency_environment`
- `late_round1_wr_commitment`
- `round1_rb_commitment`
- `speed_space_environment`
- `organizational_development_path`

Reference team examples in the current seed:

- PHI risk includes `depth_chart_volume_cap` and `target_concentration_ahead`.
- LAR risk includes `delayed_start_path` and `veteran_depth_chart_block`.
- PIT risk includes `steelers_wr_room_watch` and `delayed_start_path`.
- SEA risk includes `shared_backfield_context` and `workload_projection_risk`.
- NO risk includes `scheme_transition_variance` and `qb_context_uncertainty`.

## Downstream Join Guidance

When consuming this artifact in downstream repos (for example, TIBER-Rookies):

1. Join by `season` + `team`.
2. Keep rookie/prospect translation logic in the rookie repo.
3. Treat these tags as transparent modifiers or review flags, not direct projections.
4. Preserve `source_status` and `notes` in outputs for auditability.
