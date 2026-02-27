"""Action dataclasses for execution."""

from dataclasses import dataclass
from typing import Any

from src.config.constants import ActionType


@dataclass
class Action:
    """Action to be executed by the agent."""

    type: ActionType
    payload: dict[str, Any]
    metadata: dict[str, Any] | None = None


@dataclass
class ActionResult:
    """Result of action execution."""

    success: bool
    response_id: str | None = None
    error_message: str | None = None
    metadata: dict[str, Any] | None = None
