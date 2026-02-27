"""Default preset definitions."""

PRESETS = {
    "witty": {
        "name": "witty",
        "description": "Witty, playful responses",
        "prompt_modifier": "Respond with wit and occasional humor.",
    },
    "technical": {
        "name": "technical",
        "description": "Technical, precise responses",
        "prompt_modifier": "Be technical and precise. Use industry terminology.",
    },
    "casual": {
        "name": "casual",
        "description": "Friendly, casual tone",
        "prompt_modifier": "Keep it friendly and casual.",
    },
}


def get_preset(name: str) -> dict | None:
    """Get preset by name."""
    return PRESETS.get(name.lower())


def list_presets() -> list[str]:
    """List available preset names."""
    return list(PRESETS.keys())
