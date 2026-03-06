import type {
  ClassifierOutput,
  ScoreBundle,
  ThesisBundle,
  CanonicalMode,
  CanonicalConfig,
} from "./types.js";
import { MODE_BUDGETS } from "./modeBudgets.js";

export function selectMode(
  cls: ClassifierOutput,
  scores: ScoreBundle,
  thesis: ThesisBundle,
  config: CanonicalConfig,
): CanonicalMode {
  const { confidence, severity, opportunity } = scores;
  const floors = Object.fromEntries(
    Object.entries(MODE_BUDGETS).map(([k, v]) => [k, v.confidence_floor]),
  ) as Record<string, number>;

  if (confidence < floors.soft_deflection) {
    return "ignore";
  }

  if (confidence < floors.neutral_clarification) {
    return "soft_deflection";
  }

  if (thesis.primary === "factual_correction_only") {
    return "neutral_clarification";
  }

  if (severity >= 0.8 && confidence >= floors.hard_caution) {
    return "hard_caution";
  }

  if (severity >= 0.55 && confidence >= floors.skeptical_breakdown) {
    return "skeptical_breakdown";
  }

  const oneLineCandidates = new Set([
    "empty_hype_no_substance",
    "claim_exceeds_evidence",
    "theatrical_professionalism",
    "overpromise_underdelivery",
  ]);

  if (opportunity >= 0.75 && oneLineCandidates.has(thesis.primary)) {
    if (confidence >= floors.analyst_meme_lite) {
      return "analyst_meme_lite";
    }
    return "dry_one_liner";
  }

  if (confidence >= floors.dry_one_liner) {
    return "dry_one_liner";
  }

  return "soft_deflection";
}
