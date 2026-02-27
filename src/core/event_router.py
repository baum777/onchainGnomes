"""Event routing and classification."""

from src.config.constants import EventType, WorkflowType
from src.models.events import NormalizedEvent
from src.observability.logger import get_logger

logger = get_logger(__name__)


def event_type_to_workflow(event_type: EventType) -> WorkflowType:
    """Map event type to workflow type."""
    return WorkflowType(event_type.value)


class EventRouter:
    """Routes normalized events to appropriate workflow handlers."""

    def __init__(self):
        self._handlers: dict[WorkflowType, str] = {
            WorkflowType.MENTION: "mention_handler",
            WorkflowType.TIMELINE: "timeline_handler",
            WorkflowType.REPLY: "reply_handler",
            WorkflowType.DM: "dm_handler",
            WorkflowType.SCHEDULED: "scheduled_handler",
            WorkflowType.COMMAND: "command_handler",
        }

    def route(self, event: NormalizedEvent) -> WorkflowType:
        """Determine which workflow should handle this event."""
        workflow = event_type_to_workflow(event.type)
        handler_name = self._handlers.get(workflow, "mention_handler")
        logger.debug(
            "event_routed",
            event_id=event.id,
            event_type=event.type.value,
            workflow=workflow.value,
            handler=handler_name,
        )
        return workflow

    def get_handler_name(self, workflow: WorkflowType) -> str:
        """Get the handler name for a workflow type."""
        return self._handlers.get(workflow, "mention_handler")
