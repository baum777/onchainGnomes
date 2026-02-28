"""
Tests für Image Presets

Validiert:
- Preset-Laden
- Prompt-Building
- Caption-Generation
"""

import pytest
import tempfile
import os
import yaml
from pathlib import Path

from src.prompts.image_presets import ImagePresetLoader, ImagePreset


class TestImagePresetLoader:
    """Test-Suite für ImagePresetLoader."""

    def test_load_defaults(self):
        """Testet Laden von Default-Presets."""
        loader = ImagePresetLoader(presets_dir="/nonexistent")
        presets = loader.load_all()

        assert len(presets) > 0
        assert "cyberpunk" in presets

    def test_get_preset(self):
        """Testet Preset-Abfrage."""
        loader = ImagePresetLoader(presets_dir="/nonexistent")
        loader.load_all()

        preset = loader.get("cyberpunk")
        assert preset is not None
        assert preset.name == "cyberpunk"

    def test_has_preset_true(self):
        """Testet has_preset (positiv)."""
        loader = ImagePresetLoader(presets_dir="/nonexistent")
        loader.load_all()

        assert loader.has_preset("cyberpunk") is True

    def test_has_preset_false(self):
        """Testet has_preset (negativ)."""
        loader = ImagePresetLoader(presets_dir="/nonexistent")
        loader.load_all()

        assert loader.has_preset("nonexistent") is False

    def test_list_presets(self):
        """Testet Auflisten von Presets."""
        loader = ImagePresetLoader(presets_dir="/nonexistent")
        loader.load_all()

        preset_list = loader.list_presets()
        assert "cyberpunk" in preset_list

    def test_get_preset_info(self):
        """Testet Preset-Info-Abfrage."""
        loader = ImagePresetLoader(presets_dir="/nonexistent")
        loader.load_all()

        info = loader.get_preset_info("cyberpunk")
        assert info is not None
        assert info["name"] == "cyberpunk"

    def test_load_from_directory(self):
        """Testet Laden aus Verzeichnis."""
        with tempfile.TemporaryDirectory() as tmpdir:
            preset_data = {
                "name": "test_preset",
                "style_prompt": "test style",
                "size": "1024x1024",
            }

            with open(os.path.join(tmpdir, "test.yaml"), "w") as f:
                yaml.dump(preset_data, f)

            loader = ImagePresetLoader(presets_dir=tmpdir)
            loader.load_all()

            assert loader.has_preset("test_preset")


class TestImagePreset:
    """Test-Suite für ImagePreset."""

    def test_build_full_prompt(self):
        """Testet Prompt-Building."""
        preset = ImagePreset(
            name="test",
            style_prompt="style here",
            negative_prompt="negative here"
        )

        full = preset.build_full_prompt("user input")
        assert "user input" in full
        assert "style here" in full

    def test_build_full_prompt_empty_user(self):
        """Testet Prompt-Building mit leerem User-Input."""
        preset = ImagePreset(
            name="test",
            style_prompt="style here"
        )

        full = preset.build_full_prompt("")
        assert full == "style here"

    def test_build_caption(self):
        """Testet Caption-Building."""
        preset = ImagePreset(
            name="test",
            style_prompt="style",
            caption_template="AI: {prompt} | Test"
        )

        caption = preset.build_caption({"prompt": "sunset"})
        assert "sunset" in caption


class TestImagePresetIntegration:
    """Integration-Tests für Presets."""

    def test_cyberpunk_preset(self):
        """Testet Cyberpunk Preset."""
        loader = ImagePresetLoader(presets_dir="/nonexistent")
        loader.load_all()

        preset = loader.get("cyberpunk")
        assert preset is not None
        assert "cyberpunk" in preset.style_prompt.lower()

    def test_all_defaults_loadable(self):
        """Testet dass alle Defaults ladbar sind."""
        loader = ImagePresetLoader(presets_dir="/nonexistent")
        loader.load_all()

        expected = ["cyberpunk", "vaporwave", "abstract", "photorealistic", "glitch"]

        for preset_name in expected:
            preset = loader.get(preset_name)
            assert preset is not None
            assert len(preset.style_prompt) > 0
