"""Workflow engine - executes step chains."""

from dataclasses import dataclass, field
from typing import Any

from src.config.constants import EventType, WorkflowType
from src.models.actions import Action, ActionResult
from src.models.events import Event, NormalizedEvent
from src.observability.logger import get_logger
from src.observability.metrics import workflow_duration
from src.observability.tracing import DecisionStep, log_decision_chain

logger = get_logger(__name__)


@dataclass
class WorkflowContext:
    """Context passed through workflow steps."""

    event: Event
    normalized_event: NormalizedEvent | None = None
    workflow_type: WorkflowType | None = None
    action: Action | None = None
    result: ActionResult | None = None
    should_abort: bool = False
    decision_chain: list[DecisionStep] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


class WorkflowStep:
    """Base class for workflow steps."""

    async def run(self, context: WorkflowContext) -> WorkflowContext:
        """Execute step. Override in subclasses."""
        return context


class WorkflowEngine:
    """Executes workflow step chains."""

    def __init__(
        self,
        normalize_step: WorkflowStep,
        classify_step: WorkflowStep,
        build_context_step: WorkflowStep,
        decide_step: WorkflowStep,
        validate_step: WorkflowStep,
        execute_step: WorkflowStep,
        persist_step: WorkflowStep,
        observe_step: WorkflowStep,
    ):
        self._steps = [
            normalize_step,
            classify_step,
            build_context_step,
            decide_step,
            validate_step,
            execute_step,
            persist_step,
            observe_step,
        ]

    async def execute(self, event: Event, workflow_type: WorkflowType) -> ActionResult:
        """Execute full workflow for event."""
        context = WorkflowContext(event=event, workflow_type=workflow_type)

        with workflow_duration.labels(workflow_type=workflow_type.value).time():
            for step in self._steps:
                context = await step.run(context)
                if context.should_abort:
                    logger.info("workflow_aborted", event_id=event.id, step=step.__class__.__name__)
                    break

        if context.result:
            log_decision_chain(
                event_id=event.id,
                decision_chain=context.decision_chain,
                final_action=str(context.action.type) if context.action else None,
                success=context.result.success,
            )

        return context.result or ActionResult(success=False, error_message="Workflow aborted")
