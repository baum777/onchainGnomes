"""Template loader for YAML meme templates."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml


@dataclass
class MemeTemplate:
    """Represents a loaded meme template."""

    template_key: str
    base_style_prompt: str
    overlay_elements: List[str] = field(default_factory=list)
    text_zones: Dict[str, List[str]] = field(default_factory=dict)
    caption_style: str = "sarcastic"
    tone_rules: List[str] = field(default_factory=list)
    roast_combos: List[Dict[str, str]] = field(default_factory=list)

    @property
    def zones(self) -> List[str]:
        """Return list of available text zone names."""
        return list(self.text_zones.keys())


class TemplateLoader:
    """
    Loads meme templates from YAML files in the memes/templates directory.

    Templates define:
    - text_zones: Mapping of zone names to lists of possible text values
    - roast_combos: Pre-coordinated zone text combinations
    - overlay_elements: PNG overlay assets to composite
    - base_style_prompt: Image generation prompt for the base image
    """

    def __init__(self, templates_dir: str = "memes/templates"):
        """
        Initialize the template loader.

        Args:
            templates_dir: Directory containing template YAML files
        """
        self.templates_dir = Path(templates_dir)
        self._cache: Dict[str, MemeTemplate] = {}

    def _resolve_file(self, template_key: str) -> Path:
        """Resolve the file path for a template key."""
        file_path = self.templates_dir / f"{template_key}.yaml"
        if file_path.exists():
            return file_path

        file_path = self.templates_dir / f"{template_key}.yml"
        if file_path.exists():
            return file_path

        raise FileNotFoundError(f'Template "{template_key}" not found in {self.templates_dir}')

    def load(self, template_key: str) -> MemeTemplate:
        """
        Load a template by key. Results are cached.

        Args:
            template_key: The template identifier (e.g., 'gorky_courtroom')

        Returns:
            Parsed MemeTemplate object
        """
        if template_key in self._cache:
            return self._cache[template_key]

        file_path = self._resolve_file(template_key)
        raw = yaml.safe_load(file_path.read_text(encoding="utf-8"))

        if not isinstance(raw, dict):
            raise ValueError(f'Template "{template_key}" must be a YAML object')

        if "template_key" not in raw:
            raise ValueError(f'Template "{template_key}" missing required field: template_key')

        text_zones: Dict[str, List[str]] = {}
        raw_zones = raw.get("text_zones", {})
        if isinstance(raw_zones, dict):
            for zone_name, values in raw_zones.items():
                if isinstance(values, list):
                    text_zones[zone_name] = [str(v) for v in values]
                else:
                    text_zones[zone_name] = [str(values)]

        roast_combos: List[Dict[str, str]] = []
        raw_combos = raw.get("roast_combos", [])
        if isinstance(raw_combos, list):
            for combo in raw_combos:
                if isinstance(combo, dict):
                    roast_combos.append({k: str(v) for k, v in combo.items()})

        overlay_elements = raw.get("overlay_elements", [])
        if not isinstance(overlay_elements, list):
            overlay_elements = [str(overlay_elements)] if overlay_elements else []

        template = MemeTemplate(
            template_key=raw.get("template_key", template_key),
            base_style_prompt=raw.get("base_style_prompt", ""),
            overlay_elements=overlay_elements,
            text_zones=text_zones,
            caption_style=raw.get("caption_style", "sarcastic"),
            tone_rules=raw.get("tone_rules", []),
            roast_combos=roast_combos,
        )

        self._cache[template_key] = template
        return template

    def list_templates(self) -> List[str]:
        """List all available template keys."""
        if not self.templates_dir.exists():
            return []

        templates = []
        for file_path in self.templates_dir.iterdir():
            if file_path.suffix in (".yaml", ".yml"):
                templates.append(file_path.stem)
        return sorted(templates)

    def clear(self) -> None:
        """Clear the cache."""
        self._cache.clear()

    def is_cached(self, template_key: str) -> bool:
        """Check if a template is currently cached."""
        return template_key in self._cache
