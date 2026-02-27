"""Action execution step."""

from src.clients.x_client import XClient
from src.config import get_settings
from src.models.actions import Action, ActionResult
from src.observability.metrics import actions_executed
from src.workflows.engine import WorkflowContext, WorkflowStep


class ExecuteStep(WorkflowStep):
    """Execute the action via X Client."""

    def __init__(self, x_client: XClient | None = None, dry_run: bool | None = None):
        self._x_client = x_client or XClient()
        settings = get_settings()
        self._dry_run = dry_run if dry_run is not None else settings.dry_run

    async def run(self, context: WorkflowContext) -> WorkflowContext:
        if not context.action:
            context.should_abort = True
            return context

        action = context.action
        payload = action.payload

        if self._dry_run:
            context.result = ActionResult(
                success=True,
                response_id="dry-run-123",
                metadata={"dry_run": True},
            )
            actions_executed.labels(action_type=action.type.value, success="true").inc()
            return context

        try:
            if action.type.value == "reply":
                result = await self._x_client.post_tweet(
                    text=payload.get("text", ""),
                    in_reply_to_id=payload.get("in_reply_to_id"),
                )
                tweet_id = result.get("data", {}).get("id", "")
                context.result = ActionResult(
                    success=True,
                    response_id=tweet_id,
                    metadata=result,
                )
                actions_executed.labels(action_type="reply", success="true").inc()
            elif action.type.value == "post":
                result = await self._x_client.post_tweet(text=payload.get("text", ""))
                tweet_id = result.get("data", {}).get("id", "")
                context.result = ActionResult(
                    success=True,
                    response_id=tweet_id,
                    metadata=result,
                )
                actions_executed.labels(action_type="post", success="true").inc()
            else:
                context.result = ActionResult(success=False, error_message=f"Unsupported action: {action.type}")
                actions_executed.labels(action_type=action.type.value, success="false").inc()
        except Exception as e:
            context.result = ActionResult(success=False, error_message=str(e))
            actions_executed.labels(action_type=action.type.value, success="false").inc()

        return context
