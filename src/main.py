"""Entry point for the X AI Agent system."""

import asyncio
import sys
from pathlib import Path

# Ensure project root in path
_sys_path = Path(__file__).parent.parent
if str(_sys_path) not in sys.path:
    sys.path.insert(0, str(_sys_path))

from src.config import get_settings
from src.observability.logger import setup_logging, get_logger
from src.core.scheduler import Scheduler
from src.core.orchestrator import Orchestrator


def main() -> None:
    """Run the agent."""
    settings = get_settings()
    setup_logging()
    logger = get_logger(__name__)

    logger.info("xai_bot_starting", debug=settings.debug, dry_run=settings.dry_run)

    async def run():
        orchestrator = Orchestrator()
        scheduler = Scheduler(orchestrator, interval=settings.scheduler_interval_seconds)
        await scheduler.start()

    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        logger.info("keyboard_interrupt")
    finally:
        logger.info("xai_bot_stopped")


if __name__ == "__main__":
    main()
