from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from scripts.validate_team_offensive_environment import validate_file


ARTIFACT_PATH = Path("data/processed/2026_team_offensive_environment_v0.json")


class TestTeamOffensiveEnvironmentArtifact(unittest.TestCase):
    def test_offensive_environment_v0_artifact_is_valid(self) -> None:
        errors = validate_file(ARTIFACT_PATH)
        self.assertEqual(errors, [])

    def test_validator_detects_invalid_enums(self) -> None:
        payload = json.loads(ARTIFACT_PATH.read_text(encoding="utf-8"))
        payload[0]["pace_label"] = "warp_speed"

        with tempfile.TemporaryDirectory() as tmpdir:
            bad_path = Path(tmpdir) / "bad.json"
            bad_path.write_text(json.dumps(payload), encoding="utf-8")
            errors = validate_file(bad_path)

        self.assertTrue(any("invalid pace_label" in err for err in errors))


if __name__ == "__main__":
    unittest.main()
