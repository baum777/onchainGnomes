"""Intent classification step."""

from src.agents.action_classifier import ActionClassifier
from src.observability.tracing import DecisionStep
from src.workflows.engine import WorkflowContext, WorkflowStep


class ClassifyStep(WorkflowStep):
    """Classify event to determine action type."""

    def __init__(self):
        self._classifier = ActionClassifier()

    async def run(self, context: WorkflowContext) -> WorkflowContext:
        if not context.normalized_event:
            context.should_abort = True
            return context

        result = self._classifier.classify(context.normalized_event)
        context.decision_chain.append(
            DecisionStep("classify", result.action_type.value, {"confidence": result.confidence})
        )
        context.metadata["classification"] = result
        return context
