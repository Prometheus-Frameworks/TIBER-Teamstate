#!/usr/bin/env python3
"""Validate Teamstate rookie landing context tags artifact."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

REQUIRED_FIELDS = {
    "season",
    "team",
    "team_name",
    "context_tags",
    "positive_context_tags",
    "risk_context_tags",
    "notes",
    "source_status",
}

SOURCE_STATUS_ENUM = {"operator_seeded", "public_data_pending", "validated_public_data"}
EXPECTED_TEAMS = {
    "SF",
    "CLE",
    "TEN",
    "NO",
    "LAR",
    "PHI",
    "NYJ",
    "SEA",
    "PIT",
    "MIA",
    "CHI",
    "CAR",
    "TB",
    "BAL",
    "NYG",
    "WAS",
    "ATL",
    "JAX",
    "HOU",
    "NE",
    "ARI",
}


def _assert(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def _validate_tag_array(row: dict[str, Any], key: str, prefix: str, errors: list[str]) -> list[str]:
    value = row.get(key)
    _assert(isinstance(value, list), f"{prefix}: {key} must be an array.", errors)
    if not isinstance(value, list):
        return []

    _assert(all(isinstance(tag, str) and tag for tag in value), f"{prefix}: {key} must contain non-empty strings.", errors)
    _assert(len(value) == len(set(value)), f"{prefix}: {key} must not include duplicate tags.", errors)
    return value


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

        season = row.get("season")
        team = row.get("team")
        team_name = row.get("team_name")

        _assert(isinstance(season, int), f"{prefix}: season must be an integer.", errors)
        _assert(season == 2026, f"{prefix}: season must equal 2026.", errors)
        _assert(isinstance(team, str) and team, f"{prefix}: team must be a non-empty string.", errors)
        _assert(isinstance(team_name, str) and team_name, f"{prefix}: team_name must be a non-empty string.", errors)

        if isinstance(team, str):
            _assert(team in EXPECTED_TEAMS, f"{prefix}: unknown team code '{team}'.", errors)
            _assert(team not in seen_teams, f"{prefix}: duplicate team code '{team}'.", errors)
            seen_teams.add(team)

        context_tags = _validate_tag_array(row, "context_tags", prefix, errors)
        positive_tags = _validate_tag_array(row, "positive_context_tags", prefix, errors)
        risk_tags = _validate_tag_array(row, "risk_context_tags", prefix, errors)

        combined = positive_tags + risk_tags
        _assert(
            set(context_tags) == set(combined),
            f"{prefix}: context_tags must match positive_context_tags + risk_context_tags.",
            errors,
        )

        _assert(isinstance(row.get("notes"), str), f"{prefix}: notes must be a string.", errors)
        _assert(
            row.get("source_status") in SOURCE_STATUS_ENUM,
            f"{prefix}: invalid source_status '{row.get('source_status')}'.",
            errors,
        )

    _assert(len(rows) == len(EXPECTED_TEAMS), f"Expected {len(EXPECTED_TEAMS)} teams, found {len(rows)}.", errors)
    missing_teams = EXPECTED_TEAMS - seen_teams
    _assert(not missing_teams, f"Missing teams: {sorted(missing_teams)}", errors)

    return errors


def validate_file(path: Path) -> list[str]:
    with path.open("r", encoding="utf-8") as infile:
        payload = json.load(infile)
    return validate_rows(payload)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Teamstate rookie landing context tags JSON artifact.")
    parser.add_argument(
        "path",
        nargs="?",
        default="data/processed/2026_team_landing_context_tags.json",
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
