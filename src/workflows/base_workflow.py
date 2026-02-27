"""Base workflow interface."""

from abc import ABC, abstractmethod
from typing import Any

from src.config.constants import WorkflowType
from src.models.actions import Action, ActionResult
from src.models.events import NormalizedEvent


class BaseWorkflow(ABC):
    """Abstract base for workflow handlers."""

    @property
    @abstractmethod
    def workflow_type(self) -> WorkflowType:
        """Workflow type this handler processes."""
        pass

    @abstractmethod
    async def run(
        self,
        event: NormalizedEvent,
        context: dict[str, Any],
    ) -> ActionResult:
        """Execute workflow for the given event."""
        pass
