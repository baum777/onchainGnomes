"""
Brand Matrix Classifier

Klassifiziert Commands und ActionPlans zu Brand Matrix Payloads.
Zentrale Integration zwischen Command DSL und Brand Matrix.

Architektur:
ActionPlan → MatrixClassifier → MatrixPayload → Brand Matrix API
"""

import time
from typing import Optional, Dict, Any
from dataclasses import dataclass

from ..commands.schemas import ActionPlan, ActionType
from .contract import BrandMatrixContract, MatrixPayload, MatrixVersion


@dataclass
class ClassificationResult:
    """Ergebnis der Klassifizierung."""
    success: bool
    payload: Optional[MatrixPayload] = None
    error: Optional[str] = None


class MatrixClassifier:
    """
    Klassifiziert ActionPlans zu MatrixPayloads.

    Usage:
        classifier = MatrixClassifier()
        result = classifier.classify(action_plan)
        if result.success:
            payload = result.payload
    """

    # Template-Mapping für verschiedene ActionTypes
    TEMPLATE_MAP = {
        ActionType.TEXT_GENERATION: "text_default",
        ActionType.IMAGE_GENERATION: "image_generation",
        ActionType.REMIX_GENERATION: "remix_dynamic",
        ActionType.BADGE_STATUS: "badge_status",
        ActionType.HELP: "help_system",
    }

    # Energy-Multiplikatoren für verschiedene Flavors
    ENERGY_MULTIPLIERS = {
        "chaos": 1.2,
        "glitch": 1.1,
        "neon": 1.0,
        "ether": 0.9,
        "zen": 0.8,
        "vapor": 0.9,
    }

    def __init__(self, contract: Optional[BrandMatrixContract] = None):
        self.contract = contract or BrandMatrixContract()

    def classify(self, action_plan: ActionPlan) -> ClassificationResult:
        """Klassifiziert einen ActionPlan zu einem MatrixPayload."""
        try:
            template_key = self._resolve_template(action_plan)
            user_prompt = self._build_prompt(action_plan)
            energy = self._calculate_energy(action_plan)
            remix_of = self._extract_remix_of(action_plan)
            metadata = self._enrich_metadata(action_plan)

            payload = self.contract.build_payload(
                user_prompt=user_prompt,
                template_key=template_key,
                energy=energy,
                flavor=action_plan.flavor.value,
                remix_of=remix_of,
                preview_request_id=action_plan.metadata.get("preview_request_id"),
                metadata=metadata,
            )

            if not self.contract.validate(payload):
                errors = self.contract.get_validation_errors(payload.to_dict())
                return ClassificationResult(
                    success=False,
                    error=f"Validierungsfehler: {', '.join(errors)}"
                )

            return ClassificationResult(success=True, payload=payload)

        except Exception as e:
            return ClassificationResult(
                success=False,
                error=f"Klassifizierungsfehler: {str(e)}"
            )

    def _resolve_template(self, action_plan: ActionPlan) -> str:
        """Bestimmt den Template-Key für einen ActionPlan."""
        if action_plan.template_key:
            if action_plan.action_type == ActionType.REMIX_GENERATION:
                return f"{action_plan.template_key}_{action_plan.flavor.value}"
            return action_plan.template_key

        return self.TEMPLATE_MAP.get(action_plan.action_type, "default")

    def _build_prompt(self, action_plan: ActionPlan) -> str:
        """Baut den User-Prompt aus dem ActionPlan."""
        return (action_plan.prompt_text or "").strip()

    def _calculate_energy(self, action_plan: ActionPlan) -> int:
        """Berechnet das effektive Energy-Level."""
        base_energy = action_plan.energy
        flavor = action_plan.flavor.value
        multiplier = self.ENERGY_MULTIPLIERS.get(flavor, 1.0)
        adjusted = int(base_energy * multiplier)
        return max(1, min(5, adjusted))

    def _extract_remix_of(self, action_plan: ActionPlan) -> Optional[str]:
        """Extrahiert die Remix-Referenz aus dem ActionPlan."""
        if action_plan.parsed_command:
            if action_plan.parsed_command.remix_of:
                return action_plan.parsed_command.remix_of
        return action_plan.metadata.get("original_tweet_id")

    def _enrich_metadata(self, action_plan: ActionPlan) -> Dict[str, Any]:
        """Anreicherung der Metadaten für das Payload."""
        metadata = dict(action_plan.metadata)

        if action_plan.parsed_command:
            metadata["command_name"] = action_plan.parsed_command.name.value
            metadata["raw_args"] = action_plan.parsed_command.args

        metadata["action_type"] = action_plan.action_type.value

        if action_plan.preset_key:
            metadata["preset_key"] = action_plan.preset_key

        metadata["classified_at"] = int(time.time())

        # GORKY humor mode (internal only, never exposed to user)
        from .humor_mode_selector import HumorModeSelector

        energy = self._calculate_energy(action_plan)
        aggression_flag = metadata.get("aggression_flag", False)
        flavor = action_plan.flavor.value
        metadata["humor_mode"] = HumorModeSelector.select_mode(
            energy=energy,
            aggression_flag=aggression_flag,
            flavor=flavor,
        )

        return metadata
