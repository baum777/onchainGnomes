"""Central orchestration - event routing and workflow triggering."""

import asyncio
from typing import Any

from src.config.constants import EventType, WorkflowType
from src.core.event_router import EventRouter
from src.models.events import Event, NormalizedEvent
from src.observability.logger import get_logger
from src.state.manager import StateManager
from src.workflows.handlers.mention_handler import create_mention_workflow_engine
from src.workflows.steps.normalize import normalize_event

logger = get_logger(__name__)


class Orchestrator:
    """Orchestrates event processing and workflow execution."""

    def __init__(self, state_manager: StateManager | None = None):
        self._router = EventRouter()
        self._state = state_manager
        self._x_client = None  # Lazy init
        self._xai_client = None  # Lazy init

    async def process_events(self, events: list[Event]) -> None:
        """Process batch of events."""
        if not events:
            return

        state = self._state or StateManager()
        if not self._state:
            await state.connect()

        try:
            for event in events:
                try:
                    if await state.is_event_processed(event.id):
                        logger.debug("event_skipped_duplicate", event_id=event.id)
                        continue

                    workflow_type = self._router.route(
                        normalize_event(event)
                    )
                    engine = create_mention_workflow_engine(state)
                    result = await engine.execute(event, workflow_type)
                    logger.info(
                        "event_processed",
                        event_id=event.id,
                        success=result.success,
                    )
                except Exception as e:
                    logger.exception(
                        "event_processing_error",
                        event_id=event.id,
                        error=str(e),
                    )
        finally:
            if not self._state:
                await state.close()

    async def tick(self) -> None:
        """Single scheduler tick - fetch events and process."""
        from src.clients.x_client import XClient

        x_client = XClient()
        try:
            result = await x_client.get_mentions()
        except Exception as e:
            logger.warning("fetch_mentions_failed", error=str(e))
            return

        tweets = result.get("data", [])
        if not tweets:
            return

        events = []
        for tweet in tweets:
            tweet_id = tweet.get("id", "")
            if isinstance(tweet_id, int):
                tweet_id = str(tweet_id)
            events.append(
                Event(
                    id=tweet_id,
                    type=EventType.MENTION,
                    source="x_api",
                    payload=tweet,
                )
            )

        await self.process_events(events)
