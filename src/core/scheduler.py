"""Scheduler - time-based tick loop."""

import asyncio
import time
from typing import TYPE_CHECKING

from src.observability.logger import get_logger

if TYPE_CHECKING:
    from src.core.orchestrator import Orchestrator

logger = get_logger(__name__)


class Scheduler:
    """Runs orchestrator tick at configurable intervals."""

    def __init__(self, orchestrator: "Orchestrator", interval: int = 60):
        self._orchestrator = orchestrator
        self._interval = interval
        self._running = False
        self._task: asyncio.Task | None = None

    def stop(self) -> None:
        """Signal scheduler to stop."""
        self._running = False

    async def start(self) -> None:
        """Start scheduler loop."""
        self._running = True
        logger.info("scheduler_started", interval_seconds=self._interval)

        while self._running:
            start = time.monotonic()
            try:
                await self._orchestrator.tick()
            except Exception as e:
                logger.exception("scheduler_tick_error", error=str(e))

            elapsed = time.monotonic() - start
            sleep_for = max(0, self._interval - elapsed)
            if sleep_for and self._running:
                await asyncio.sleep(sleep_for)

        logger.info("scheduler_stopped")
