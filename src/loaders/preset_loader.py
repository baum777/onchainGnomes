"""Preset loader for YAML image presets."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml


@dataclass
class ImagePreset:
    """Represents a loaded image generation preset."""

    preset_key: str
    name: str
    size: str = "1024x1024"
    style_prompt: str = ""
    negative_prompt: str = ""
    brand_rules: List[str] = field(default_factory=list)
    caption_templates: List[str] = field(default_factory=list)
    default_template_keys: List[str] = field(default_factory=list)
    parameters: Dict[str, Any] = field(default_factory=dict)


class PresetLoader:
    """
    Loads image generation presets from YAML files.

    Presets define:
    - style_prompt: The main image generation prompt
    - negative_prompt: What to avoid in generation
    - brand_rules: Safety and style guidelines
    - caption_templates: Public-safe caption templates
    - default_template_keys: Recommended meme templates for this preset
    """

    def __init__(self, presets_dir: str = "prompts/presets/images"):
        """
        Initialize the preset loader.

        Args:
            presets_dir: Directory containing preset YAML files
        """
        self.presets_dir = Path(presets_dir)
        self._cache: Dict[str, ImagePreset] = {}

    def _resolve_file(self, preset_key: str) -> Path:
        """Resolve the file path for a preset key."""
        # Try with .yaml extension
        file_path = self.presets_dir / f"{preset_key}.yaml"
        if file_path.exists():
            return file_path

        # Try with .yml extension
        file_path = self.presets_dir / f"{preset_key}.yml"
        if file_path.exists():
            return file_path

        raise FileNotFoundError(f'Preset "{preset_key}" not found in {self.presets_dir}')

    def load(self, preset_key: str) -> ImagePreset:
        """
        Load a preset by key. Results are cached.

        Args:
            preset_key: The preset identifier (e.g., 'gorky_roast_card')

        Returns:
            Parsed ImagePreset object

        Raises:
            FileNotFoundError: If the preset file doesn't exist
            ValueError: If the YAML is invalid or missing required fields
        """
        if preset_key in self._cache:
            return self._cache[preset_key]

        file_path = self._resolve_file(preset_key)
        raw = yaml.safe_load(file_path.read_text(encoding="utf-8"))

        if not isinstance(raw, dict):
            raise ValueError(f'Preset "{preset_key}" must be a YAML object')

        # Validate required fields
        if "preset_key" not in raw:
            raise ValueError(f'Preset "{preset_key}" missing required field: preset_key')

        # Parse multi-line strings (YAML handles this, but ensure clean values)
        style_prompt = raw.get("style_prompt", "")
        if isinstance(style_prompt, str):
            style_prompt = style_prompt.strip()

        negative_prompt = raw.get("negative_prompt", "")
        if isinstance(negative_prompt, str):
            negative_prompt = negative_prompt.strip()

        # Parse lists
        brand_rules = raw.get("brand_rules", [])
        if not isinstance(brand_rules, list):
            brand_rules = [str(brand_rules)] if brand_rules else []

        caption_templates = raw.get("caption_templates", [])
        if not isinstance(caption_templates, list):
            caption_templates = [str(caption_templates)] if caption_templates else []

        default_template_keys = raw.get("default_template_keys", [])
        if not isinstance(default_template_keys, list):
            default_template_keys = [str(default_template_keys)] if default_template_keys else []

        preset = ImagePreset(
            preset_key=raw.get("preset_key", preset_key),
            name=raw.get("name", preset_key),
            size=raw.get("size", "1024x1024"),
            style_prompt=style_prompt,
            negative_prompt=negative_prompt,
            brand_rules=brand_rules,
            caption_templates=caption_templates,
            default_template_keys=default_template_keys,
            parameters=raw.get("parameters", {}),
        )

        self._cache[preset_key] = preset
        return preset

    def list_presets(self) -> List[str]:
        """List all available preset keys."""
        if not self.presets_dir.exists():
            return []

        presets = []
        for file_path in self.presets_dir.iterdir():
            if file_path.suffix in (".yaml", ".yml"):
                presets.append(file_path.stem)
        return sorted(presets)

    def clear(self) -> None:
        """Clear the cache."""
        self._cache.clear()

    def is_cached(self, preset_key: str) -> bool:
        """Check if a preset is currently cached."""
        return preset_key in self._cache
