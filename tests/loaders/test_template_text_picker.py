"""Tests for template_text_picker module."""

from pathlib import Path

import pytest
import yaml

from src.loaders.template_loader import TemplateLoader
from src.loaders.template_text_picker import pick_template_text, PickTemplateTextArgs, PickedTemplateText


class TestPickTemplateText:
    """Test suite for pick_template_text function."""

    @pytest.fixture
    def sample_template(self, tmp_path: Path):
        """Create a sample template."""
        templates_dir = tmp_path / "templates"
        templates_dir.mkdir()

        template_data = {
            "template_key": "test_template",
            "base_style_prompt": "Test style",
            "text_zones": {
                "header": ["Header A", "Header B", "Header C"],
                "verdict": ["Verdict A", "Verdict B", "Verdict C"],
                "footer": ["Footer A", "Footer B", "Footer C"],
            },
            "roast_combos": [
                {"header": "Combo Header", "verdict": "Combo Verdict", "footer": "Combo Footer"}
            ],
        }

        template_file = templates_dir / "test_template.yaml"
        template_file.write_text(yaml.dump(template_data))

        loader = TemplateLoader(templates_dir=str(templates_dir))
        return loader.load("test_template")

    def test_returns_picked_template_text(self, sample_template):
        """Test that function returns PickedTemplateText."""
        args = PickTemplateTextArgs(
            template=sample_template,
            seed_key="test_seed"
        )

        result = pick_template_text(args)

        assert isinstance(result, PickedTemplateText)
        assert isinstance(result.text_by_zone, dict)

    def test_all_zones_populated(self, sample_template):
        """Test that all zones have text."""
        args = PickTemplateTextArgs(
            template=sample_template,
            seed_key="test_seed"
        )

        result = pick_template_text(args)

        assert "header" in result.text_by_zone
        assert "verdict" in result.text_by_zone
        assert "footer" in result.text_by_zone

    def test_determinism(self, sample_template):
        """Test that same seed produces same result."""
        args = PickTemplateTextArgs(
            template=sample_template,
            seed_key="deterministic_seed"
        )

        result1 = pick_template_text(args)
        result2 = pick_template_text(args)

        assert result1.text_by_zone == result2.text_by_zone
        assert result1.used_combo == result2.used_combo

    def test_combo_with_high_chance(self, sample_template):
        """Test that combo is used when chance is 100%."""
        args = PickTemplateTextArgs(
            template=sample_template,
            seed_key="any_seed",
            combo_chance=1.0  # 100% chance
        )

        result = pick_template_text(args)

        assert result.used_combo is True
        assert result.text_by_zone["header"] == "Combo Header"
        assert result.text_by_zone["verdict"] == "Combo Verdict"
        assert result.text_by_zone["footer"] == "Combo Footer"

    def test_no_combo_with_zero_chance(self, sample_template):
        """Test that combo is not used when chance is 0%."""
        args = PickTemplateTextArgs(
            template=sample_template,
            seed_key="test_seed",
            combo_chance=0.0  # 0% chance
        )

        result = pick_template_text(args)

        assert result.used_combo is False

    def test_zone_overrides(self, sample_template):
        """Test that zone overrides are applied."""
        args = PickTemplateTextArgs(
            template=sample_template,
            seed_key="test_seed",
            zone_overrides={"header": "Custom Header", "footer": "Custom Footer"}
        )

        result = pick_template_text(args)

        assert result.text_by_zone["header"] == "Custom Header"
        assert result.text_by_zone["footer"] == "Custom Footer"
        # Verdict should come from normal selection
        assert result.text_by_zone["verdict"] in ["Verdict A", "Verdict B", "Verdict C"]
