# Teamstate Offensive Environment v0 (2026 Seed)

## Purpose

Teamstate Offensive Environment v0 is a deterministic seed artifact for TIBER post-draft rookie translation.

Core doctrine:

- Teamstate does **not** grade the rookie.
- Teamstate grades the **offensive environment** the rookie joined.
- TIBER-Rookies may consume this artifact later as a landing-spot translator input.

## Scope and Constraints

- This v0 artifact is intentionally lightweight and transparent.
- Labels are conservative unless public validation data is wired.
- `source_status` tracks whether rows are operator seeded or validated.
- No proprietary analyst content is scraped or embedded.
- No live API or scoring-model changes are introduced.

## Artifact

Path:

- `data/processed/2026_team_offensive_environment_v0.json`

Shape per team:

```json
{
  "season": 2026,
  "team": "NO",
  "offensive_playcaller": "Kellen Moore",
  "head_coach": "",
  "pace_label": "high|above_average|neutral|below_average|unknown",
  "pass_rate_label": "high|above_average|neutral|below_average|unknown",
  "play_volume_label": "high|above_average|neutral|below_average|unknown",
  "qb_stability_label": "strong|moderate|uncertain|weak|unknown",
  "scoring_environment_label": "strong|moderate|uncertain|weak|unknown",
  "rookie_landing_spot_modifier": "positive|neutral|negative|uncertain",
  "modifier_strength": "strong|moderate|light|unknown",
  "context_tags": [],
  "notes": "",
  "source_status": "operator_seeded|public_data_pending|validated_public_data"
}
```

## Initial Seeding Notes

- All 32 teams are included for season 2026.
- The New Orleans (`NO`) row is seeded for Jordyn Tyson landing-spot context with:
  - `offensive_playcaller: "Kellen Moore"`
  - `context_tags`:
    - `kellen_moore_pace`
    - `elevated_play_volume_potential`
    - `positive_rookie_wr_environment`
  - `source_status: "operator_seeded"`

## Validation

Validator:

- `scripts/validate_team_offensive_environment.py`

Checks:

- Required fields exist for every row.
- Enum-constrained labels are valid.
- Exactly 32 unique NFL team codes are present.
- Season is fixed to 2026 for v0.

Run:

```bash
python scripts/validate_team_offensive_environment.py
```

## Future Tag Translation Examples

As TIBER-Rookies integration is added later, v0 labels/tags can be translated into deterministic feature flags such as:

- `high_pace_environment`
- `pass_volume_buff`
- `qb_uncertainty_penalty`
- `target_competition_penalty`
- `scoring_environment_buff`

These should remain explicit and auditable until a stronger data-validation pipeline is in place.
