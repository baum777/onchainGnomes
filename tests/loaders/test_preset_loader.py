"""Tests for preset_loader module."""

from pathlib import Path

import pytest
import yaml

from src.loaders.preset_loader import PresetLoader, ImagePreset


class TestPresetLoader:
    """Test suite for PresetLoader."""

    def test_load_preset(self, tmp_path: Path):
        """Test loading a preset."""
        presets_dir = tmp_path / "presets"
        presets_dir.mkdir()

        preset_data = {
            "preset_key": "test_preset",
            "name": "Test Preset",
            "size": "1024x1024",
            "style_prompt": "A beautiful test image",
        }

        preset_file = presets_dir / "test_preset.yaml"
        preset_file.write_text(yaml.dump(preset_data))

        loader = PresetLoader(presets_dir=str(presets_dir))
        preset = loader.load("test_preset")

        assert isinstance(preset, ImagePreset)
        assert preset.preset_key == "test_preset"

    def test_default_values(self, tmp_path: Path):
        """Test default values when fields are missing."""
        presets_dir = tmp_path / "presets"
        presets_dir.mkdir()

        preset_file = presets_dir / "minimal.yaml"
        preset_file.write_text(yaml.dump({"preset_key": "minimal"}))

        loader = PresetLoader(presets_dir=str(presets_dir))
        preset = loader.load("minimal")

        assert preset.size == "1024x1024"
