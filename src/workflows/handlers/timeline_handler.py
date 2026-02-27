"""Timeline workflow handler - autonomous posting."""

from typing import Any

from src.config.constants import WorkflowType
from src.models.actions import ActionResult
from src.models.events import NormalizedEvent
from src.workflows.base_workflow import BaseWorkflow


class TimelineHandler(BaseWorkflow):
    """Handles timeline events for autonomous posting."""

    @property
    def workflow_type(self) -> WorkflowType:
        return WorkflowType.TIMELINE

    async def run(
        self,
        event: NormalizedEvent,
        context: dict[str, Any],
    ) -> ActionResult:
        return ActionResult(
            success=False,
            error_message="Timeline handler not yet implemented",
        )
