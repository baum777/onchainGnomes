"""Reply workflow handler - conversation replies."""

from typing import Any

from src.config.constants import WorkflowType
from src.models.actions import ActionResult
from src.models.events import NormalizedEvent
from src.workflows.base_workflow import BaseWorkflow
from src.workflows.handlers.mention_handler import (
    MentionHandler,
    create_mention_workflow_engine,
)
from src.state.manager import StateManager
from src.clients.x_client import XClient
from src.clients.xai_client import XAIClient


class ReplyHandler(BaseWorkflow):
    """Handles reply events - delegates to mention-like workflow."""

    def __init__(
        self,
        state_manager: StateManager,
        x_client: XClient | None = None,
        xai_client: XAIClient | None = None,
    ):
        self._mention_handler = MentionHandler(
            state_manager, x_client, xai_client
        )

    @property
    def workflow_type(self) -> WorkflowType:
        return WorkflowType.REPLY

    async def run(
        self,
        event: NormalizedEvent,
        context: dict[str, Any],
    ) -> ActionResult:
        context["source"] = "reply"
        return await self._mention_handler.run(event, context)
