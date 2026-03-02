"""Mention workflow handler."""

from typing import Any

from src.config.constants import EventType, WorkflowType
from src.models.actions import ActionResult
from src.models.events import NormalizedEvent
from src.workflows.base_workflow import BaseWorkflow
from src.workflows.engine import WorkflowEngine, WorkflowContext
from src.workflows.steps.normalize import NormalizeStep
from src.workflows.steps.classify import ClassifyStep
from src.workflows.steps.build_context import BuildContextStep
from src.workflows.steps.decide import DecideStep
from src.workflows.steps.validate import ValidateStep
from src.workflows.steps.execute import ExecuteStep
from src.workflows.steps.persist import PersistStep
from src.workflows.steps.observe import ObserveStep
from src.agents.prompt_loader import PromptLoader
from src.agents.context_builder import ContextBuilder
from src.clients.x_client import XClient
from src.clients.xai_client import XAIClient
from src.state.manager import StateManager
from src.state.deduplicator import Deduplicator
from src.state.conversation import ConversationTracker


def create_mention_workflow_engine(
    state_manager: StateManager,
    x_client: XClient | None = None,
    xai_client: XAIClient | None = None,
    dry_run: bool | None = None,
) -> WorkflowEngine:
    """Factory to create workflow engine for mention handling."""
    state = state_manager
    dedup = Deduplicator(state)
    conv = ConversationTracker(state)
    prompt_loader = PromptLoader()
    context_builder = ContextBuilder(state)
    xai = xai_client or XAIClient()

    return WorkflowEngine(
        normalize_step=NormalizeStep(),
        classify_step=ClassifyStep(),
        build_context_step=BuildContextStep(),
        decide_step=DecideStep(
            xai_client=xai,
            prompt_loader=prompt_loader,
            context_builder=context_builder,
        ),
        validate_step=ValidateStep(
            state_manager=state,
            deduplicator=dedup,
            conversation_tracker=conv,
        ),
        execute_step=ExecuteStep(x_client=x_client or XClient(), dry_run=dry_run),
        persist_step=PersistStep(
            state_manager=state,
            deduplicator=dedup,
            conversation_tracker=conv,
        ),
        observe_step=ObserveStep(),
    )


class MentionHandler(BaseWorkflow):
    """Handles mention events."""

    def __init__(
        self,
        state_manager: StateManager,
        x_client: XClient | None = None,
        xai_client: XAIClient | None = None,
    ):
        self._engine = create_mention_workflow_engine(
            state_manager, x_client, xai_client
        )

    @property
    def workflow_type(self) -> WorkflowType:
        return WorkflowType.MENTION

    async def run(
        self,
        event: NormalizedEvent,
        context: dict[str, Any],
    ) -> ActionResult:
        from src.models.events import Event

        raw_event = Event(
            id=event.id,
            type=EventType.MENTION,
            source=context.get("source", "handler"),
            payload={
                "id": event.tweet_id or event.id,
                "text": event.content,
                "author_id": event.author_id,
                "conversation_id": event.thread_id,
                "referenced_tweets": [
                    {"type": "replied_to", "id": event.in_reply_to_id}
                ]
                if event.in_reply_to_id
                else [],
            },
        )
        return await self._engine.execute(raw_event, WorkflowType.MENTION)
