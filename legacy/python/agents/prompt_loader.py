"""Prompt loading and registry with versioning."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from src.config import get_settings
from src.observability.logger import get_logger

logger = get_logger(__name__)


@dataclass
class PromptMeta:
    """Metadata about a prompt."""

    name: str
    version: str
    description: str = ""
    category: str = ""


@dataclass
class Prompt:
    """Loaded prompt with content and metadata."""

    name: str
    version: str
    content: str
    description: str = ""
    input_schema: list[str] = field(default_factory=list)
    output_schema: list[str] = field(default_factory=list)
    parent: str | None = None
    modifications: dict[str, Any] = field(default_factory=dict)


class PromptLoader:
    """Loads and caches prompts from filesystem."""

    def __init__(self, prompts_dir: Path | None = None):
        settings = get_settings()
        self._prompts_dir = Path(prompts_dir or settings.prompts_dir)
        self._cache: dict[str, Prompt] = {}
        self._index: dict[str, list[PromptMeta]] = {}

    def _build_index(self) -> dict[str, list[PromptMeta]]:
        """Build index of all available prompts."""
        index: dict[str, list[PromptMeta]] = {}
        categories = ["system", "tasks", "presets", "commands"]

        for category in categories:
            category_path = self._prompts_dir / category
            index[category] = []
            if not category_path.exists():
                continue

            for yaml_file in category_path.rglob("*.yaml"):
                try:
                    data = yaml.safe_load(yaml_file.read_text())
                    if data:
                        meta = PromptMeta(
                            name=data.get("name", yaml_file.stem),
                            version=data.get("version", "1.0.0"),
                            description=data.get("description", ""),
                            category=category,
                        )
                        index[category].append(meta)
                except Exception as e:
                    logger.warning("prompt_index_error", file=str(yaml_file), error=str(e))

        return index

    def _load_yaml(self, path: Path) -> dict[str, Any] | None:
        """Load YAML file."""
        try:
            return yaml.safe_load(path.read_text(encoding="utf-8"))
        except Exception as e:
            logger.error("prompt_load_error", path=str(path), error=str(e))
            return None

    def _resolve_path(self, name: str, category: str, version: str | None) -> Path | None:
        """Find prompt file. Checks category subdir and custom/ for commands."""
        dirs_to_check = [self._prompts_dir / category]
        if category == "commands":
            dirs_to_check.append(self._prompts_dir / "commands" / "custom")

        for base_dir in dirs_to_check:
            candidate = base_dir / f"{name}.yaml"
            if candidate.exists():
                return candidate
        return None

    def get(
        self,
        name: str,
        category: str = "system",
        version: str | None = None,
        variables: dict[str, str] | None = None,
    ) -> str:
        """Load prompt and return compiled content with variables injected."""
        cache_key = f"{category}:{name}:{version or 'latest'}"
        if cache_key in self._cache:
            prompt = self._cache[cache_key]
        else:
            path = self._resolve_path(name, category, version)
            if not path:
                raise FileNotFoundError(f"Prompt not found: {category}/{name}")

            data = self._load_yaml(path)
            if not data:
                raise ValueError(f"Failed to load prompt: {path}")

            content = data.get("content", "")

            prompt = Prompt(
                name=data.get("name", name),
                version=data.get("version", "1.0.0"),
                content=content,
                description=data.get("description", ""),
                input_schema=data.get("input_schema", []),
                output_schema=data.get("output_schema", []),
                parent=data.get("parent"),
                modifications=data.get("modifications", {}),
            )
            self._cache[cache_key] = prompt

        result = prompt.content
        if variables:
            try:
                result = result.format(**variables)
            except KeyError as e:
                logger.warning("prompt_variable_missing", prompt=name, key=str(e))

        return result

    def list_prompts(self, category: str) -> list[PromptMeta]:
        """List available prompts in category."""
        if not self._index:
            self._index = self._build_index()
        return self._index.get(category, [])

    def clear_cache(self) -> None:
        """Clear prompt cache (e.g. for hot reload)."""
        self._cache.clear()
        self._index.clear()


class PromptRegistry:
    """Registry for prompt management - wraps PromptLoader with validation."""

    def __init__(self, prompts_dir: Path | None = None):
        self._loader = PromptLoader(prompts_dir)

    def get(self, name: str, category: str = "system", **kwargs: Any) -> str:
        """Get prompt content."""
        return self._loader.get(name, category, **kwargs)

    def list_prompts(self, category: str) -> list[PromptMeta]:
        """List prompts in category."""
        return self._loader.list_prompts(category)
