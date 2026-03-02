"""
GORKY Prompt Composer

Merges persona, composer rules, voice matrix, and humor mode into final prompt.
Deterministic, no private data leakage.
"""

from pathlib import Path
from typing import Any, Dict, Optional

from .humor_mode_selector import HumorModeSelector

# Forbidden tokens - never appear in composed prompt output
_FORBIDDEN_OUTPUT = (
    "score", "xp", "threshold", "cooldown", "trace",
    "risk", "telemetry", "flag", "level", "energy",
)


def _load_file(path: Path) -> str:
    """Load text file. Returns empty string if not found."""
    try:
        return path.read_text(encoding="utf-8")
    except (FileNotFoundError, OSError):
        return ""


def _sanitize_output(text: str) -> str:
    """Remove forbidden tokens from text. Internal safety."""
    lower = text.lower()
    for token in _FORBIDDEN_OUTPUT:
        if token in lower:
            # Replace with placeholder to avoid leak
            text = text.replace(token, "[omitted]")
    return text


class GorkyPromptComposer:
    """
    Composes final prompts for GORKY persona.

    Merges:
    - Persona definition
    - Composer rules
    - Humor mode instructions
    - User input
    """

    def __init__(self, prompts_dir: Optional[Path] = None):
        self._prompts_dir = Path(prompts_dir or "prompts")
        self._persona_content: Optional[str] = None
        self._composer_content: Optional[str] = None
        self._cache: Dict[str, str] = {}

    def _get_persona(self) -> str:
        """Load persona file."""
        if self._persona_content is None:
            path = self._prompts_dir / "system" / "gorky_persona.md"
            self._persona_content = _load_file(path)
        return self._persona_content

    def _get_composer_rules(self) -> str:
        """Load composer rules file."""
        if self._composer_content is None:
            path = self._prompts_dir / "system" / "gorky_prompt_composer.md"
            self._composer_content = _load_file(path)
        return self._composer_content

    def _get_mode_instructions(self, mode: str) -> str:
        """Get mode-specific instruction block."""
        blocks = {
            "rhyme_override": (
                "MODE: Rhyme override (aggressive user detected). "
                "Use short rhyme couplets to de-escalate. Calm, redirecting. Never match aggression."
            ),
            "goblin": (
                "MODE: Chaos Goblin. Maximum entropy. Short fragments. Caps. Unhinged but readable."
            ),
            "therapist": (
                "MODE: Fake Therapist. Gentle redirect. Acknowledge tension. Playful, not patronizing."
            ),
            "authority": (
                "MODE: Fake Authority. Mock official tone. VERDICT/SENTENCE structure. Courtroom energy."
            ),
            "scientist": (
                "MODE: Chaos Scientist. Absurd technical. OBSERVATION/CAUSE/CONCLUSION. Pseudoscientific."
            ),
            "reality": (
                "MODE: Reality Check. Brutal honesty. Short punchline. Situations not individuals."
            ),
        }
        return blocks.get(mode, blocks["authority"])

    def compose(
        self,
        user_input: str,
        mode: str = "authority",
        user_handle: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Compose final prompt.

        Args:
            user_input: Cleaned user text
            mode: Humor mode from HumorModeSelector
            user_handle: Optional handle for personalization
            context: Optional additional context (not included in output)

        Returns:
            Composed prompt string. Sanitized. No private data.
        """
        cache_key = f"{mode}:{user_input}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        persona = self._get_persona()
        composer_rules = self._get_composer_rules()
        mode_instructions = self._get_mode_instructions(mode)

        parts = [
            persona,
            "---",
            composer_rules,
            "---",
            mode_instructions,
            "---",
            "USER INPUT:",
            user_input or "(no input)",
        ]

        if user_handle:
            parts.insert(-1, f"CONTEXT: replying to @{user_handle}")
            parts.insert(-1, "")

        composed = "\n\n".join(parts)
        composed = _sanitize_output(composed)
        self._cache[cache_key] = composed
        return composed

    def compose_for_mention(
        self,
        user_input: str,
        energy: int = 3,
        aggression_flag: bool = False,
        flavor: str = "chaos",
        user_handle: Optional[str] = None,
    ) -> str:
        """
        Convenience: select mode and compose for mention workflow.
        """
        mode = HumorModeSelector.get_mode_for_mention(
            energy=energy,
            aggression_flag=aggression_flag,
            flavor=flavor,
        )
        return self.compose(
            user_input=user_input,
            mode=mode,
            user_handle=user_handle,
        )
