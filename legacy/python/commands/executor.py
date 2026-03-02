"""
Command DSL Executor

Führt ActionPlans aus und koordiniert mit Workflow Engine.
Verbindet Command DSL mit bestehender Workflow-Infrastruktur.

Architektur:
ActionPlan → Executor → Workflow Steps → Result
"""

from typing import Optional, Dict, Any
from dataclasses import dataclass

from ..workflows.engine import WorkflowEngine
from ..state.manager import StateManager
from ..clients.x_client import XClient
from ..clients.xai_client import XAIClient
from ..brand_matrix.classifier import MatrixClassifier
from ..brand_matrix.contract import BrandMatrixContract
from ..prompts.image_presets import ImagePresetLoader

from .schemas import ActionPlan, ActionType, CommandResult, CommandContext
from .errors import CommandValidationError, ErrorCatalog


@dataclass
class ExecutionResult:
    """Ergebnis der Command-Ausführung."""
    success: bool
    result: Optional[CommandResult] = None
    error: Optional[str] = None


class CommandExecutor:
    """
    Führt ActionPlans aus und integriert mit Workflow Engine.

    Koordiniert:
    - State Management
    - X API Calls
    - xAI Generation
    - Brand Matrix Klassifizierung

    Usage:
        executor = CommandExecutor(state_manager, x_client, xai_client)
        result = executor.execute(action_plan, context)
    """

    def __init__(
        self,
        state_manager: StateManager,
        x_client: XClient,
        xai_client: XAIClient,
        workflow_engine: Optional[WorkflowEngine] = None,
    ):
        """
        Initialisiert den Executor.

        Args:
            state_manager: Für State-Persistierung
            x_client: Für X API Calls
            xai_client: Für xAI Generation
            workflow_engine: Optional - Workflow Engine
        """
        self.state_manager = state_manager
        self.x_client = x_client
        self.xai_client = xai_client
        self.workflow_engine = workflow_engine

        # Brand Matrix Integration
        self.matrix_contract = BrandMatrixContract()
        self.matrix_classifier = MatrixClassifier(self.matrix_contract)

        # Image Presets
        self.image_presets = ImagePresetLoader()

    async def execute(
        self,
        action_plan: ActionPlan,
        context: Optional[CommandContext] = None,
        dry_run: bool = False
    ) -> ExecutionResult:
        """
        Führt einen ActionPlan aus.

        Args:
            action_plan: Der auszuführende Plan
            context: Optionaler Command-Kontext
            dry_run: Wenn True, keine echten API Calls

        Returns:
            ExecutionResult mit CommandResult oder Fehler
        """
        try:
            # Command-Historie speichern
            await self._persist_command(action_plan)

            # ActionType-spezifische Ausführung
            executors = {
                ActionType.TEXT_GENERATION: self._execute_text,
                ActionType.IMAGE_GENERATION: self._execute_image,
                ActionType.REMIX_GENERATION: self._execute_remix,
                ActionType.BADGE_STATUS: self._execute_badge,
                ActionType.HELP: self._execute_help,
            }

            executor = executors.get(action_plan.action_type)
            if not executor:
                return ExecutionResult(
                    success=False,
                    error=f"Unbekannter ActionType: {action_plan.action_type}"
                )

            result = await executor(action_plan, context, dry_run)
            return ExecutionResult(success=True, result=result)

        except Exception as e:
            return ExecutionResult(
                success=False,
                error=f"Ausführungsfehler: {str(e)}"
            )

    async def _persist_command(self, action_plan: ActionPlan) -> None:
        """Speichert Command in Historie."""
        if action_plan.parsed_command:
            await self.state_manager.record_command(
                user_id=action_plan.parsed_command.user_id,
                command_type=action_plan.action_type.value,
                metadata={
                    "command_name": action_plan.parsed_command.name.value,
                    "args": action_plan.parsed_command.args,
                    "action_plan": {
                        "template_key": action_plan.template_key,
                        "energy": action_plan.energy,
                        "flavor": action_plan.flavor.value,
                    }
                }
            )

    async def _execute_text(
        self,
        action_plan: ActionPlan,
        context: Optional[CommandContext],
        dry_run: bool
    ) -> CommandResult:
        """Führt Text-Generation aus (/ask)."""
        # Brand Matrix Payload erstellen
        classification = self.matrix_classifier.classify(action_plan)

        if not classification.success:
            return CommandResult(
                success=False,
                error_message=classification.error
            )

        payload = classification.payload

        if dry_run:
            return CommandResult(
                success=True,
                content=f"[DRY RUN] Text generation with prompt: {payload.user_prompt[:50]}...",
                metadata={"payload": payload.to_dict()}
            )

        # Text generieren über xAI
        try:
            response = await self.xai_client.complete(
                prompt=payload.user_prompt,
                system_prompt=f"Generate response with energy={payload.energy}, flavor={payload.flavor}"
            )

            return CommandResult(
                success=True,
                content=response,
                metadata={
                    "payload": payload.to_dict(),
                    "tokens_used": len(response) // 4,  # Approximation
                }
            )

        except Exception as e:
            return CommandResult(
                success=False,
                error_message=f"Text generation failed: {str(e)}"
            )

    async def _execute_image(
        self,
        action_plan: ActionPlan,
        context: Optional[CommandContext],
        dry_run: bool
    ) -> CommandResult:
        """Führt Image-Generation aus (/img)."""
        # Preset laden wenn vorhanden
        preset = None
        if action_plan.preset_key:
            preset = self.image_presets.get(action_plan.preset_key)

        # Prompt mit Preset kombinieren
        user_prompt = action_plan.prompt_text
        if preset:
            full_prompt = preset.build_full_prompt(user_prompt)
        else:
            full_prompt = user_prompt

        if dry_run:
            return CommandResult(
                success=True,
                content=f"[DRY RUN] Image generation with prompt: {full_prompt[:50]}...",
                metadata={
                    "preset_used": action_plan.preset_key,
                    "full_prompt": full_prompt,
                }
            )

        # TODO: Image generation über xAI oder Brand Matrix
        # Für jetzt: Placeholder
        return CommandResult(
            success=True,
            content=f"Image generation with: {full_prompt[:100]}...",
            metadata={
                "preset_used": action_plan.preset_key,
                "full_prompt": full_prompt,
            }
        )

    async def _execute_remix(
        self,
        action_plan: ActionPlan,
        context: Optional[CommandContext],
        dry_run: bool
    ) -> CommandResult:
        """Führt Remix-Generation aus (/remix)."""
        # Remix-Chain laden
        original_tweet_id = action_plan.parsed_command.remix_of if action_plan.parsed_command else None

        if not original_tweet_id:
            return CommandResult(
                success=False,
                error_message="No remix source provided"
            )

        # Original-Content laden
        original_content = await self.state_manager.get_original_for_remix(original_tweet_id)

        if not original_content:
            return CommandResult(
                success=False,
                error_message=f"Could not find original content for remix: {original_tweet_id}"
            )

        # Brand Matrix Payload für Remix
        classification = self.matrix_classifier.classify(action_plan)

        if not classification.success:
            return CommandResult(
                success=False,
                error_message=classification.error
            )

        if dry_run:
            return CommandResult(
                success=True,
                content=f"[DRY RUN] Remix of {original_tweet_id} with flavor={action_plan.flavor.value}",
                metadata={
                    "original_tweet_id": original_tweet_id,
                    "flavor": action_plan.flavor.value,
                    "energy": action_plan.energy,
                }
            )

        # Remix ausführen
        return CommandResult(
            success=True,
            content=f"Remix of {original_tweet_id} with {action_plan.flavor.value} flavor",
            metadata={
                "original_tweet_id": original_tweet_id,
                "remix_chain": True,
            }
        )

    async def _execute_badge(
        self,
        action_plan: ActionPlan,
        context: Optional[CommandContext],
        dry_run: bool
    ) -> CommandResult:
        """Führt Badge-Status aus (/badge me)."""
        user_id = action_plan.parsed_command.user_id if action_plan.parsed_command else None

        if not user_id:
            return CommandResult(
                success=False,
                error_message="No user ID for badge lookup"
            )

        # User-Stats laden
        stats = await self.state_manager.get_user_stats(user_id)

        if dry_run:
            return CommandResult(
                success=True,
                content="[DRY RUN] Badge status",
                metadata={"user_id": user_id}
            )

        # Badge-Status generieren
        badges = stats.get("badges", [])
        interactions = stats.get("interactions", 0)
        level = stats.get("level", 1)

        content = self._format_badge_status(badges, interactions, level)

        return CommandResult(
            success=True,
            content=content,
            metadata={
                "user_id": user_id,
                "badges": badges,
                "interactions": interactions,
                "level": level,
            }
        )

    async def _execute_help(
        self,
        action_plan: ActionPlan,
        context: Optional[CommandContext],
        dry_run: bool
    ) -> CommandResult:
        """Führt Help-Command aus (/help)."""
        topic = action_plan.prompt_text

        content = self._generate_help(topic)

        return CommandResult(
            success=True,
            content=content,
            metadata={"topic": topic}
        )

    def _format_badge_status(self, badges: list, interactions: int, level: int) -> str:
        """Formatiert Badge-Status für Ausgabe."""
        if not badges:
            return f"🏅 Level {level} | {interactions} Interaktionen | Noch keine Badges freigeschaltet. Bleib aktiv!"

        badge_emojis = {
            "early_adopter": "🚀",
            "power_user": "⚡",
            "remix_master": "🎨",
            "conversation_starter": "💬",
            "daily_active": "📅",
        }

        badge_str = " ".join([badge_emojis.get(b, "🏅") for b in badges])

        return f"🏅 Level {level} | {interactions} Interaktionen | Badges: {badge_str}"

    def _generate_help(self, topic: str) -> str:
        """Generiert Hilfetext."""
        general_help = """🤖 Verfügbare Commands:

/ask <text> - Frage beantworten
/img preset=<key> prompt="<text>" - Bild generieren
/remix energy=1..5 flavor=<enum> - Content remixen
/badge me - Dein Status
/help - Diese Hilfe

Presets: cyberpunk, vaporwave, abstract, glitch, photorealistic
Flavors: chaos, zen, glitch, ether, neon, vapor"""

        topic_help = {
            "img": "/img preset=<name> prompt=\"text\" - Bilder mit Presets: cyberpunk, vaporwave, abstract, glitch, photorealistic",
            "remix": "/remix energy=1..5 flavor=<name> - Remix mit: chaos, zen, glitch, ether, neon, vapor",
            "ask": "/ask <deine Frage> - Einfache Text-Fragen beantworten",
        }

        if topic and topic != "general":
            return topic_help.get(topic, f"Unbekanntes Thema: {topic}. " + general_help)

        return general_help
