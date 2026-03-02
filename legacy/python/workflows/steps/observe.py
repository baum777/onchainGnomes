"""Observability step - metrics and logging."""

from src.observability.logger import get_logger
from src.observability.metrics import events_processed
from src.workflows.engine import WorkflowContext, WorkflowStep

logger = get_logger(__name__)


class ObserveStep(WorkflowStep):
    """Record metrics and final logging."""

    async def run(self, context: WorkflowContext) -> WorkflowContext:
        status = "success" if (context.result and context.result.success) else "error"
        event_type = context.event.type.value

        events_processed.labels(event_type=event_type, status=status).inc()

        logger.info(
            "workflow_completed",
            event_id=context.event.id,
            event_type=event_type,
            workflow=context.workflow_type.value if context.workflow_type else "unknown",
            success=context.result.success if context.result else False,
            action_type=context.action.type.value if context.action else "none",
        )
        return context
