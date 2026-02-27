"""Build context step - loads conversation history etc."""

from src.workflows.engine import WorkflowContext, WorkflowStep


class BuildContextStep(WorkflowStep):
    """Build context for AI decision. Context builder is used in DecideStep."""

    async def run(self, context: WorkflowContext) -> WorkflowContext:
        # Context building is done in DecideStep when we have the full pipeline
        # This step can pre-load conversation from DB if needed
        return context
