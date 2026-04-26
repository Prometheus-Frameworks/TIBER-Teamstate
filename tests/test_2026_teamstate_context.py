from __future__ import annotations

import json
import unittest
from pathlib import Path

from scripts.validate_2026_teamstate_context import validate_file


ARTIFACT_PATH = Path("data/processed/2026_teamstate_context_v0.json")


class TestTeamstate2026ContextArtifact(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.payload = json.loads(ARTIFACT_PATH.read_text(encoding="utf-8"))
        cls.by_team = {row["team"]: row for row in cls.payload}

    def test_validator_passes(self) -> None:
        self.assertEqual(validate_file(ARTIFACT_PATH), [])

    def test_sf_has_expected_tags(self) -> None:
        sf = self.by_team["SF"]
        self.assertIn("shanahan_efficiency_environment", sf["positive_team_context_tags"])
        self.assertIn("low_pass_volume_risk", sf["risk_team_context_tags"])

    def test_cle_has_expected_tags(self) -> None:
        cle = self.by_team["CLE"]
        self.assertIn("concentrated_wr_investment", cle["positive_team_context_tags"])
        self.assertIn("qb_environment_uncertainty", cle["risk_team_context_tags"])

    def test_ten_has_expected_tags(self) -> None:
        ten = self.by_team["TEN"]
        self.assertIn("wr1_depth_chart_path", ten["positive_team_context_tags"])
        self.assertIn("young_qb_development_dependency", ten["risk_team_context_tags"])

    def test_phi_risk_tag_not_positive(self) -> None:
        phi = self.by_team["PHI"]
        self.assertIn("depth_chart_volume_cap", phi["risk_team_context_tags"])
        self.assertNotIn("depth_chart_volume_cap", phi["positive_team_context_tags"])

    def test_lar_has_expected_tags(self) -> None:
        lar = self.by_team["LAR"]
        self.assertIn("mcvay_developmental_environment", lar["positive_team_context_tags"])
        self.assertIn("delayed_start_path", lar["risk_team_context_tags"])

    def test_jax_has_expected_tags(self) -> None:
        jax = self.by_team["JAX"]
        self.assertIn("late_round_te_watch", jax["positive_team_context_tags"])
        self.assertIn("round5_insulation_risk", jax["risk_team_context_tags"])


if __name__ == "__main__":
    unittest.main()
