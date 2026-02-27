"""AI decision step - generates action from context."""

from src.agents.context_builder import ContextBuilder
from src.agents.prompt_loader import PromptLoader
from src.clients.xai_client import XAIClient
from src.config.constants import ActionType
from src.models.actions import Action
from src.observability.tracing import DecisionStep
from src.workflows.engine import WorkflowContext, WorkflowStep


class DecideStep(WorkflowStep):
    """Use AI to decide on action."""

    def __init__(
        self,
        xai_client: XAIClient,
        prompt_loader: PromptLoader,
        context_builder: ContextBuilder,
    ):
        self._xai = xai_client
        self._prompts = prompt_loader
        self._context_builder = context_builder

    async def run(self, context: WorkflowContext) -> WorkflowContext:
        classification = context.metadata.get("classification")
        if not classification or classification.action_type == ActionType.IGNORE:
            context.should_abort = True
            return context

        if not context.normalized_event:
            context.should_abort = True
            return context

        agent_context = await self._context_builder.build(
            event=context.normalized_event,
            conversation_history=[],
            active_preset="base",
        )
        formatted_context = self._context_builder.format_for_prompt(agent_context)

        prompt_name = "mentions" if (
            context.workflow_type
            and context.workflow_type.value in ("mention", "reply")
        ) else "base"
        prompt = self._prompts.get(
            prompt_name,
            category="system",
            variables={
                "context": formatted_context,
                "message": context.normalized_event.content or "",
            },
        )

        response = await self._xai.complete_with_prompt(
            system_prompt=prompt,
            user_message=context.normalized_event.content or "",
            max_tokens=280,
        )

        context.decision_chain.append(
            DecisionStep("ai_decide", "reply", {"prompt_version": "1.0.0"})
        )

        context.action = Action(
            type=classification.action_type,
            payload={
                "text": response.strip()[:280],
                "in_reply_to_id": context.normalized_event.tweet_id,
            },
        )
        return context
