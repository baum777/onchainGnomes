import type {
  ScoreBundle,
  EligibilityResult,
  CanonicalConfig,
  ClassifierOutput,
  IntentClass,
} from "./types.js";

const SOCIAL_INTENTS: IntentClass[] = [
  "greeting",
  "casual_ping",
  "question",
  "market_question_general",
  "persona_query",
  "lore_query",
  "conversation_continue",
];

function isHardPolicyBlock(classifier: ClassifierOutput): boolean {
  if (classifier.policy_severity) {
    return classifier.policy_severity === "hard";
  }
  return classifier.policy_blocked === true;
}

export function checkEligibility(
  scores: ScoreBundle,
  classifier: ClassifierOutput,
  config: CanonicalConfig,
): EligibilityResult {
  const { thresholds } = config;
  const isSocial = SOCIAL_INTENTS.includes(classifier.intent);

  if (isHardPolicyBlock(classifier)) {
    return { eligible: false, skip_reason: "skip_policy" };
  }

  if (scores.risk > thresholds.max_risk) {
    return { eligible: false, skip_reason: "skip_high_risk" };
  }

  if (classifier.intent === "greeting" || classifier.intent === "casual_ping") {
    return { eligible: true, skip_reason: null };
  }

  if (isSocial) {
    const social = thresholds.social ?? {
      min_relevance: 0.15,
      max_risk: thresholds.max_risk,
      min_opportunity: 0.05,
      min_novelty: 0.00,
      min_confidence: 0.05,
    };

    if (scores.relevance < social.min_relevance) {
      return { eligible: false, skip_reason: "skip_low_relevance" };
    }

    if (scores.confidence < social.min_confidence) {
      return { eligible: false, skip_reason: "skip_low_confidence" };
    }

    return { eligible: true, skip_reason: null };
  }

  if (scores.relevance < thresholds.min_relevance) {
    return { eligible: false, skip_reason: "skip_low_relevance" };
  }

  if (scores.opportunity < thresholds.min_opportunity) {
    return { eligible: false, skip_reason: "skip_low_relevance" };
  }

  if (scores.novelty < thresholds.min_novelty) {
    return { eligible: false, skip_reason: "skip_low_relevance" };
  }

  if (scores.confidence < 0.25) {
    return { eligible: false, skip_reason: "skip_low_confidence" };
  }

  return { eligible: true, skip_reason: null };
}
