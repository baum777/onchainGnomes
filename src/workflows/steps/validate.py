"""Pre-execution validation step."""

from datetime import datetime, timedelta, timezone

from src.config.constants import CooldownType, COOLDOWN_DURATIONS
from src.state.conversation import ConversationTracker
from src.state.deduplicator import Deduplicator
from src.state.manager import StateManager
from src.workflows.engine import WorkflowContext, WorkflowStep


class ValidateStep(WorkflowStep):
    """Validate action before execution - rate limits, duplicates, cooldowns."""

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
        if not context.action or not context.normalized_event:
            context.should_abort = True
            return context

        # Check duplicate
        if await self._dedup.is_processed(context.event.id):
            context.should_abort = True
            context.metadata["validation_failure"] = "duplicate"
            return context

        # Check thread reply limit
        thread_id = context.normalized_event.thread_id or context.event.id
        if not await self._conv.can_reply_to_thread(thread_id):
            context.should_abort = True
            context.metadata["validation_failure"] = "thread_limit"
            return context

        # Check per-user cooldown
        author_id = context.normalized_event.author_id
        if author_id:
            cooldown_type = CooldownType.PER_USER_REPLY.value
            expires = await self._state.get_cooldown(cooldown_type, author_id)
            if expires and expires > datetime.now(timezone.utc):
                context.should_abort = True
                context.metadata["validation_failure"] = "user_cooldown"
                return context

        from src.observability.tracing import DecisionStep
        context.decision_chain.append(
            DecisionStep("validate", "passed", {"checks": ["duplicate", "thread_limit", "cooldown"]})
        )
        return context
