"""Duplicate prevention for events."""

from src.models.actions import Action
from src.state.manager import StateManager


class Deduplicator:
    """Prevents duplicate processing of events."""

    def __init__(self, state_manager: StateManager):
        self._state = state_manager

    async def is_processed(self, event_id: str) -> bool:
        """Check if event has already been processed."""
        return await self._state.is_event_processed(event_id)

    async def mark_processed(
        self,
        event_id: str,
        event_type: str,
        action: Action,
        success: bool,
        error_message: str | None = None,
    ) -> None:
        """Mark event as processed to prevent reprocessing."""
        await self._state.mark_event_processed(
            event_id=event_id,
            event_type=event_type,
            action_type=action.type.value,
            success=success,
            error_message=error_message,
        )
