#!/usr/bin/env python3
"""Validate Teamstate offensive environment v0 artifact."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

REQUIRED_FIELDS = {
    "season",
    "team",
    "offensive_playcaller",
    "head_coach",
    "pace_label",
    "pass_rate_label",
    "play_volume_label",
    "qb_stability_label",
    "scoring_environment_label",
    "rookie_landing_spot_modifier",
    "modifier_strength",
    "context_tags",
    "notes",
    "source_status",
}

PACE_ENUM = {"high", "above_average", "neutral", "below_average", "unknown"}
PASS_RATE_ENUM = PACE_ENUM
PLAY_VOLUME_ENUM = PACE_ENUM
QB_STABILITY_ENUM = {"strong", "moderate", "uncertain", "weak", "unknown"}
SCORING_ENV_ENUM = QB_STABILITY_ENUM
MODIFIER_ENUM = {"positive", "neutral", "negative", "uncertain"}
MODIFIER_STRENGTH_ENUM = {"strong", "moderate", "light", "unknown"}
SOURCE_STATUS_ENUM = {"operator_seeded", "public_data_pending", "validated_public_data"}

EXPECTED_TEAMS = {
    "ARI","ATL","BAL","BUF","CAR","CHI","CIN","CLE","DAL","DEN","DET","GB","HOU","IND",
    "JAX","KC","LAC","LAR","LV","MIA","MIN","NE","NO","NYG","NYJ","PHI","PIT","SEA",
    "SF","TB","TEN","WAS",
}


def _assert(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def validate_rows(rows: Any) -> list[str]:
    errors: list[str] = []
    _assert(isinstance(rows, list), "Top-level JSON value must be an array.", errors)
    if errors:
        return errors

    seen_teams: set[str] = set()

    for index, row in enumerate(rows):
        prefix = f"Row {index}"
        _assert(isinstance(row, dict), f"{prefix}: value must be an object.", errors)
        if not isinstance(row, dict):
            continue

        missing = REQUIRED_FIELDS - set(row.keys())
        extra = set(row.keys()) - REQUIRED_FIELDS
        _assert(not missing, f"{prefix}: missing required fields: {sorted(missing)}", errors)
        _assert(not extra, f"{prefix}: unexpected fields: {sorted(extra)}", errors)

        team = row.get("team")
        season = row.get("season")
        _assert(isinstance(season, int), f"{prefix}: season must be an integer.", errors)
        _assert(season == 2026, f"{prefix}: season must equal 2026.", errors)
        _assert(isinstance(team, str) and team, f"{prefix}: team must be a non-empty string.", errors)
        if isinstance(team, str):
            _assert(team in EXPECTED_TEAMS, f"{prefix}: unknown team code '{team}'.", errors)
            _assert(team not in seen_teams, f"{prefix}: duplicate team code '{team}'.", errors)
            seen_teams.add(team)

        _assert(row.get("pace_label") in PACE_ENUM, f"{prefix}: invalid pace_label '{row.get('pace_label')}'.", errors)
        _assert(row.get("pass_rate_label") in PASS_RATE_ENUM, f"{prefix}: invalid pass_rate_label '{row.get('pass_rate_label')}'.", errors)
        _assert(row.get("play_volume_label") in PLAY_VOLUME_ENUM, f"{prefix}: invalid play_volume_label '{row.get('play_volume_label')}'.", errors)
        _assert(row.get("qb_stability_label") in QB_STABILITY_ENUM, f"{prefix}: invalid qb_stability_label '{row.get('qb_stability_label')}'.", errors)
        _assert(
            row.get("scoring_environment_label") in SCORING_ENV_ENUM,
            f"{prefix}: invalid scoring_environment_label '{row.get('scoring_environment_label')}'.",
            errors,
        )
        _assert(
            row.get("rookie_landing_spot_modifier") in MODIFIER_ENUM,
            f"{prefix}: invalid rookie_landing_spot_modifier '{row.get('rookie_landing_spot_modifier')}'.",
            errors,
        )
        _assert(
            row.get("modifier_strength") in MODIFIER_STRENGTH_ENUM,
            f"{prefix}: invalid modifier_strength '{row.get('modifier_strength')}'.",
            errors,
        )
        _assert(
            row.get("source_status") in SOURCE_STATUS_ENUM,
            f"{prefix}: invalid source_status '{row.get('source_status')}'.",
            errors,
        )
        _assert(isinstance(row.get("offensive_playcaller"), str), f"{prefix}: offensive_playcaller must be a string.", errors)
        _assert(isinstance(row.get("head_coach"), str), f"{prefix}: head_coach must be a string.", errors)
        _assert(isinstance(row.get("notes"), str), f"{prefix}: notes must be a string.", errors)

        context_tags = row.get("context_tags")
        _assert(isinstance(context_tags, list), f"{prefix}: context_tags must be an array.", errors)
        if isinstance(context_tags, list):
            _assert(all(isinstance(tag, str) and tag for tag in context_tags), f"{prefix}: context_tags must contain non-empty strings.", errors)

    _assert(len(rows) == 32, f"Expected 32 teams, found {len(rows)}.", errors)
    missing_teams = EXPECTED_TEAMS - seen_teams
    _assert(not missing_teams, f"Missing teams: {sorted(missing_teams)}", errors)

    return errors


def validate_file(path: Path) -> list[str]:
    with path.open("r", encoding="utf-8") as infile:
        payload = json.load(infile)
    return validate_rows(payload)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Teamstate offensive environment v0 JSON artifact.")
    parser.add_argument(
        "path",
        nargs="?",
        default="data/processed/2026_team_offensive_environment_v0.json",
        help="Path to artifact JSON file.",
    )
    args = parser.parse_args()

    errors = validate_file(Path(args.path))
    if errors:
        print("Validation failed:")
        for err in errors:
            print(f"- {err}")
        return 1

    print(f"Validation passed: {args.path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
