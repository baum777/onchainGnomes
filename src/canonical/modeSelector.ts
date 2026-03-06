import type {
  ClassifierOutput,
  ScoreBundle,
  ThesisBundle,
  CanonicalMode,
  CanonicalConfig,
  IntentClass,
} from "./types.js";
import { getConfidenceFloor } from "./modeBudgets.js";

const SOCIAL_MODE_MAP: Partial<Record<IntentClass, CanonicalMode>> = {
  greeting: "social_banter",
  casual_ping: "conversation_hook",
  market_question_general: "market_banter",
  persona_query: "persona_reply",
  lore_query: "lore_drop",
  conversation_continue: "conversation_hook",
};

export function selectMode(
  cls: ClassifierOutput,
  scores: ScoreBundle,
  thesis: ThesisBundle,
  config: CanonicalConfig,
): CanonicalMode {
  const socialMode = SOCIAL_MODE_MAP[cls.intent];
  if (socialMode) {
    return socialMode;
  }

  const { confidence, severity, opportunity } = scores;

  if (confidence < getConfidenceFloor("soft_deflection")) {
    return "ignore";
  }

  if (confidence < getConfidenceFloor("neutral_clarification")) {
    return "soft_deflection";
  }

  if (thesis.primary === "factual_correction_only") {
    return "neutral_clarification";
  }

  if (severity >= 0.8 && confidence >= getConfidenceFloor("hard_caution")) {
    return "hard_caution";
  }

  if (severity >= 0.55 && confidence >= getConfidenceFloor("skeptical_breakdown")) {
    return "skeptical_breakdown";
  }

  const oneLineCandidates = new Set([
    "empty_hype_no_substance",
    "claim_exceeds_evidence",
    "theatrical_professionalism",
    "overpromise_underdelivery",
  ]);

  if (opportunity >= 0.75 && oneLineCandidates.has(thesis.primary)) {
    if (confidence >= getConfidenceFloor("analyst_meme_lite")) {
      return "analyst_meme_lite";
    }
    return "dry_one_liner";
  }

  if (cls.intent === "question") {
    if (confidence >= getConfidenceFloor("analyst_meme_lite")) return "analyst_meme_lite";
    return "market_banter";
  }

  if (confidence >= getConfidenceFloor("dry_one_liner")) {
    return "dry_one_liner";
  }

  return "soft_deflection";
}
