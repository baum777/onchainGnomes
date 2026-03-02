"""Command registry - maps commands to handlers."""

from typing import Any, Callable

from src.agents.prompt_loader import PromptLoader
from src.commands.parser import ParsedCommand
from src.observability.logger import get_logger

logger = get_logger(__name__)


class CommandRegistry:
    """Registry of commands and their handlers."""

    def __init__(self):
        self._commands: dict[str, Callable[..., str]] = {}
        self._prompts = PromptLoader()

    def register(self, name: str, handler: Callable[..., str] | None = None) -> None:
        """Register command. If no handler, uses prompt from commands/{name}.yaml."""
        if handler:
            self._commands[name] = handler
        else:
            self._commands[name] = self._prompt_handler(name)

    def _prompt_handler(self, name: str) -> Callable[..., str]:
        """Create handler that loads prompt for command."""
        def handler(cmd: ParsedCommand, **kwargs: Any) -> str:
            try:
                return self._prompts.get(
                    name,
                    category="commands",
                    variables={"message": cmd.raw, **kwargs},
                )
            except FileNotFoundError:
                return f"Unknown command: {name}"

        return handler

    def get_handler(self, name: str) -> Callable[..., str] | None:
        """Get handler for command name."""
        return self._commands.get(name.lower())

    def execute(self, cmd: ParsedCommand, **kwargs: Any) -> str:
        """Execute command and return response."""
        handler = self.get_handler(cmd.name)
        if not handler:
            try:
                return self._prompts.get(
                    cmd.name,
                    category="commands",
                    variables={
                        "message": cmd.raw,
                        "available_commands": ", ".join(self.list_commands() or ["help", "status"]),
                        **kwargs,
                    },
                )
            except FileNotFoundError:
                return f"Unknown command: /{cmd.name}"

        return handler(cmd, **kwargs)

    def list_commands(self) -> list[str]:
        """List registered command names."""
        return list(self._commands.keys())


def create_default_registry() -> CommandRegistry:
    """Create registry with default commands."""
    registry = CommandRegistry()
    registry.register("help")
    registry.register("status")
    return registry
