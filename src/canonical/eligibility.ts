import type {
  ScoreBundle,
  EligibilityResult,
  CanonicalConfig,
} from "./types.js";

export function checkEligibility(
  scores: ScoreBundle,
  config: CanonicalConfig,
): EligibilityResult {
  const { thresholds } = config;

  if (scores.relevance < thresholds.min_relevance) {
    return { eligible: false, skip_reason: "skip_low_relevance" };
  }

  if (scores.risk > thresholds.max_risk) {
    return { eligible: false, skip_reason: "skip_high_risk" };
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
