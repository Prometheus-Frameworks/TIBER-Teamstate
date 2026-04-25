from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from scripts.validate_team_landing_context_tags import validate_file


ARTIFACT_PATH = Path("data/processed/2026_team_landing_context_tags.json")


class TestTeamLandingContextTagsArtifact(unittest.TestCase):
    def test_team_landing_context_tags_artifact_is_valid(self) -> None:
        errors = validate_file(ARTIFACT_PATH)
        self.assertEqual(errors, [])

    def test_validator_detects_context_tag_mismatch(self) -> None:
        payload = json.loads(ARTIFACT_PATH.read_text(encoding="utf-8"))
        payload[0]["context_tags"] = ["tag_a"]
        payload[0]["positive_context_tags"] = ["tag_b"]
        payload[0]["risk_context_tags"] = []

        with tempfile.TemporaryDirectory() as tmpdir:
            bad_path = Path(tmpdir) / "bad.json"
            bad_path.write_text(json.dumps(payload), encoding="utf-8")
            errors = validate_file(bad_path)

        self.assertTrue(any("context_tags must match" in err for err in errors))


if __name__ == "__main__":
    unittest.main()
