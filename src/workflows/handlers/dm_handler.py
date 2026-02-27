"""DM workflow handler."""

from typing import Any

from src.config.constants import WorkflowType
from src.models.actions import ActionResult
from src.models.events import NormalizedEvent
from src.workflows.base_workflow import BaseWorkflow


class DMHandler(BaseWorkflow):
    """Handles direct message events."""

    @property
    def workflow_type(self) -> WorkflowType:
        return WorkflowType.DM

    async def run(
        self,
        event: NormalizedEvent,
        context: dict[str, Any],
    ) -> ActionResult:
        from src.models.actions import ActionResult
        return ActionResult(success=False, error_message="DM handler not yet implemented")
