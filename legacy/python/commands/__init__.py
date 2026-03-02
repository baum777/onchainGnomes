"""
Command DSL Module

Mini Command DSL für deterministische Bot-Interaktionen.

Exports:
    CommandParser: Deterministisches Command-Parsing
    CommandRouter: Routing zu ActionPlans
    CommandExecutor: Workflow-Ausführung
    ParsedCommand, ActionPlan: Datenmodelle
    CommandValidationError, ErrorCatalog: Fehlerhandling
"""

from .parser import CommandParser, ParseResult
from .router import CommandRouter, RouteResult
from .executor import CommandExecutor, ExecutionResult
from .schemas import (
    ParsedCommand,
    ActionPlan,
    CommandResult,
    CommandContext,
    CommandName,
    ActionType,
    Flavor,
)
from .errors import CommandValidationError, ErrorCatalog, ErrorResponseBuilder

__all__ = [
    "CommandParser",
    "ParseResult",
    "CommandRouter",
    "RouteResult",
    "CommandExecutor",
    "ExecutionResult",
    "ParsedCommand",
    "ActionPlan",
    "CommandResult",
    "CommandContext",
    "CommandName",
    "ActionType",
    "Flavor",
    "CommandValidationError",
    "ErrorCatalog",
    "ErrorResponseBuilder",
]
