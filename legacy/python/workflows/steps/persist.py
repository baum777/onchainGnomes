"""State persistence step."""

from datetime import datetime, timedelta, timezone

from src.config.constants import CooldownType, COOLDOWN_DURATIONS
from src.observability.tracing import DecisionStep
from src.state.deduplicator import Deduplicator
from src.state.manager import StateManager
from src.state.conversation import ConversationTracker
from src.workflows.engine import WorkflowContext, WorkflowStep


class PersistStep(WorkflowStep):
    """Persist state after execution."""

    def __init__(
        self,
        state_manager: StateManager,
        deduplicator: Deduplicator,
        conversation_tracker: ConversationTracker,
    ):
        self._state = state_manager
        self._dedup = deduplicator
        self._conv = conversation_tracker

    async def run(self, context: WorkflowContext) -> WorkflowContext:
        if not context.action or not context.result:
            return context

        success = context.result.success

        await self._dedup.mark_processed(
            event_id=context.event.id,
            event_type=context.event.type.value,
            action=context.action,
            success=success,
            error_message=context.result.error_message,
        )

        if success and context.normalized_event:
            thread_id = context.normalized_event.thread_id or context.event.id
            await self._conv.record_reply(thread_id)

            author_id = context.normalized_event.author_id
            if author_id:
                duration = COOLDOWN_DURATIONS.get(CooldownType.PER_USER_REPLY, 300)
                expires = datetime.now(timezone.utc) + timedelta(seconds=duration)
                await self._state.set_cooldown(
                    CooldownType.PER_USER_REPLY.value,
                    author_id,
                    expires,
                )

        context.decision_chain.append(
            DecisionStep("persist", "completed", {"success": success})
        )
        return context
