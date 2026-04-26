#!/usr/bin/env python3
"""Validate Teamstate 2026 team context v0 artifact."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

REQUIRED_FIELDS = {
    "season",
    "team",
    "team_name",
    "head_coach",
    "offensive_coordinator",
    "play_caller",
    "qb_context",
    "offensive_identity_tags",
    "personnel_usage_tags",
    "pace_pass_environment_tags",
    "positive_team_context_tags",
    "risk_team_context_tags",
    "rookie_landing_context_tags",
    "source_status",
    "notes",
}

EXPECTED_TEAMS = {
    "SF", "CLE", "TEN", "PHI", "LAR", "SEA", "PIT", "WAS", "JAX", "KC", "BUF", "NYG",
    "MIA", "CHI", "HOU", "NO", "NYJ", "ATL", "CAR", "TB", "BAL", "NE", "ARI",
}

SOURCE_STATUS_ENUM = {"operator_seeded", "operator_seeded_unknown"}
KNOWN_RISK_TAGS = {
    "low_pass_volume_risk",
    "role_specific_usage_dependency",
    "day2_49ers_skill_pick_hit_rate_caution",
    "browns_offensive_volatility",
    "target_competition_between_rookies",
    "qb_environment_uncertainty",
    "young_qb_development_dependency",
    "offense_environment_uncertainty",
    "depth_chart_volume_cap",
    "target_concentration_ahead",
    "veteran_depth_chart_block",
    "delayed_start_path",
    "shared_backfield_context",
    "workload_projection_risk",
    "qb_room_uncertainty",
    "steelers_wr_room_watch",
    "role_projection_uncertainty",
    "round5_insulation_risk",
    "depth_chart_path_uncertain",
    "delayed_te_translation_watch",
    "late_round_role_uncertainty",
    "depth_chart_dependency",
    "role_competition_risk",
    "low_draft_capital_insulation",
    "profile_translation_risk",
    "target_competition_cluster",
    "role_assignment_uncertainty",
    "target_hierarchy_uncertainty",
    "offensive_line_dependency",
    "play_caller_transfer_uncertainty",
    "qb_context_uncertainty",
    "scheme_transition_variance",
}


def _assert(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def _validate_str_array(row: dict[str, Any], key: str, prefix: str, errors: list[str]) -> list[str]:
    value = row.get(key)
    _assert(isinstance(value, list), f"{prefix}: {key} must be an array.", errors)
    if not isinstance(value, list):
        return []
    _assert(all(isinstance(item, str) and item for item in value), f"{prefix}: {key} must contain non-empty strings.", errors)
    _assert(len(value) == len(set(value)), f"{prefix}: {key} must not contain duplicates.", errors)
    return value


def validate_rows(rows: Any) -> list[str]:
    errors: list[str] = []
    _assert(isinstance(rows, list), "Top-level JSON value must be an array.", errors)
    if not isinstance(rows, list):
        return errors

    seen_teams: set[str] = set()

    for index, row in enumerate(rows):
        prefix = f"Row {index}"
        _assert(isinstance(row, dict), f"{prefix}: value must be an object.", errors)
        if not isinstance(row, dict):
            continue

        missing = REQUIRED_FIELDS - set(row.keys())
        _assert(not missing, f"{prefix}: missing required fields: {sorted(missing)}", errors)

        for str_key in [
            "team", "team_name", "head_coach", "offensive_coordinator", "play_caller", "qb_context", "notes"
        ]:
            _assert(isinstance(row.get(str_key), str) and row.get(str_key), f"{prefix}: {str_key} must be a non-empty string.", errors)

        _assert(row.get("season") == 2026, f"{prefix}: season must equal 2026.", errors)

        team = row.get("team")
        if isinstance(team, str):
            _assert(team in EXPECTED_TEAMS, f"{prefix}: unknown team code '{team}'.", errors)
            _assert(team not in seen_teams, f"{prefix}: duplicate team code '{team}'.", errors)
            seen_teams.add(team)

        positive = _validate_str_array(row, "positive_team_context_tags", prefix, errors)
        risk = _validate_str_array(row, "risk_team_context_tags", prefix, errors)
        _validate_str_array(row, "offensive_identity_tags", prefix, errors)
        _validate_str_array(row, "personnel_usage_tags", prefix, errors)
        _validate_str_array(row, "pace_pass_environment_tags", prefix, errors)
        rookie = _validate_str_array(row, "rookie_landing_context_tags", prefix, errors)

        _assert(not (set(positive) & KNOWN_RISK_TAGS), f"{prefix}: positive_team_context_tags includes known risk tag(s).", errors)
        _assert(set(positive + risk).issubset(set(rookie)), f"{prefix}: rookie_landing_context_tags must include all positive/risk tags.", errors)

        _assert(
            row.get("source_status") in SOURCE_STATUS_ENUM,
            f"{prefix}: source_status must be one of {sorted(SOURCE_STATUS_ENUM)}.",
            errors,
        )

    _assert(len(rows) == len(EXPECTED_TEAMS), f"Expected {len(EXPECTED_TEAMS)} team rows, found {len(rows)}.", errors)
    missing_teams = EXPECTED_TEAMS - seen_teams
    _assert(not missing_teams, f"Missing required teams: {sorted(missing_teams)}", errors)

    return errors


def validate_file(path: Path) -> list[str]:
    with path.open("r", encoding="utf-8") as infile:
        rows = json.load(infile)
    return validate_rows(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate 2026 Teamstate context artifact.")
    parser.add_argument("path", nargs="?", default="data/processed/2026_teamstate_context_v0.json")
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
