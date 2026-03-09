"""Dry run script - test workflow with sample event without posting."""

import asyncio
import json
import os
import sys
from pathlib import Path

# Force dry run mode
os.environ.setdefault("DRY_RUN", "true")
sys.path.insert(0, str(Path(__file__).parent.parent))


async def run_dry_run(event_path: str | None = None) -> None:
    """Run workflow in dry-run mode with sample or provided event."""
    from src.config import get_settings
    from src.observability.logger import setup_logging, get_logger

    setup_logging()
    logger = get_logger(__name__)

    if event_path:
        event_data = json.loads(Path(event_path).read_text())
    else:
        event_data = {
            "id": "1234567890",
            "text": " @testbot What's the weather?",
            "author_id": "111",
            "conversation_id": "1234567890",
            "referenced_tweets": [],
        }

    from src.models.events import Event
    from src.config.constants import EventType
    from src.state.manager import StateManager
    from src.workflows.handlers.mention_handler import create_mention_workflow_engine

    event = Event(
        id=str(event_data.get("id", "test")),
        type=EventType.MENTION,
        source="dry_run",
        payload=event_data,
    )

    from src.config.constants import WorkflowType

    logger.info("dry_run_start", event_id=event.id)

    async with StateManager() as state:
        engine = create_mention_workflow_engine(state, dry_run=True)
        result = await engine.execute(event, WorkflowType.MENTION)

    logger.info("dry_run_complete", success=result.success, result=str(result))
    print(f"Result: success={result.success}, response_id={result.response_id}")


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--event", help="Path to JSON event file")
    args = parser.parse_args()
    asyncio.run(run_dry_run(args.event))


if __name__ == "__main__":
    main()
