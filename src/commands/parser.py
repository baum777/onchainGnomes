"""Command parsing from mention/reply content."""

import re
from dataclasses import dataclass
from typing import Any


@dataclass
class ParsedCommand:
    """Parsed command from content."""

    name: str
    args: list[str]
    raw: str
    preset: str | None = None


# Command prefix patterns
COMMAND_PREFIXES = ["/", "!", "."]
COMMAND_PATTERN = re.compile(
    r"^[" + "".join(re.escape(p) for p in COMMAND_PREFIXES) + r"](\w+)(?:\s+(.+))?$",
    re.IGNORECASE,
)

# Preset pattern: /preset witty
PRESET_PATTERN = re.compile(
    r"^preset\s+(\w+)$",
    re.IGNORECASE,
)


def parse_command(content: str | None) -> ParsedCommand | None:
    """Parse command from mention/reply content.

    Returns ParsedCommand if content matches command format, else None.
    """
    if not content or not content.strip():
        return None

    text = content.strip()
    match = COMMAND_PATTERN.match(text)
    if not match:
        return None

    name = match.group(1).lower()
    args_str = match.group(2) or ""
    args = args_str.split() if args_str else []

    # Check for preset command
    if name == "preset" and args:
        return ParsedCommand(
            name="preset",
            args=args,
            raw=text,
            preset=args[0].lower() if args else None,
        )

    return ParsedCommand(name=name, args=args, raw=text)


def is_command(content: str | None) -> bool:
    """Check if content looks like a command."""
    return parse_command(content) is not None
