/**
 * Gorky Roast Pattern Library
 * Pattern definitions with trigger conditions, sample framing, and safe sarcasm boundaries.
 */

import type { ThesisType } from "../canonical/types.js";

export type NarrativeLabel =
  | "this_cycle_different"
  | "utility_revolution"
  | "meme_viral_launch"
  | "healthy_correction"
  | "ai_defi_rwa_meta"
  | "liquidity_volume_spike"
  | "hopium_wagmi_diamond_hands"
  | "rug_scam_fear"
  | "post_hype_silence"
  | "chain_superiority"
  | "influencer_pump"
  | "recycled_macro_thesis"
  | "unclassified";

export interface RoastPattern {
  id: string;
  useCase: string;
  triggerThesis: ThesisType[];
  triggerNarratives: NarrativeLabel[];
  sampleFraming: string;
  sentimentRange: "positive" | "negative" | "neutral" | "any";
  failureCases: string[];
}

export const ROAST_PATTERNS: RoastPattern[] = [
  {
    id: "narrative_vs_reality",
    useCase: "Claim vs evidence gap",
    triggerThesis: ["narrative_stronger_than_product", "claim_exceeds_evidence"],
    triggerNarratives: ["utility_revolution", "ai_defi_rwa_meta"],
    sampleFraming: "The narrative ran ahead of the product. Again.",
    sentimentRange: "any",
    failureCases: ["strong product proof present"],
  },
  {
    id: "hype_detection",
    useCase: "Empty hype",
    triggerThesis: ["empty_hype_no_substance"],
    triggerNarratives: ["hopium_wagmi_diamond_hands", "meme_viral_launch"],
    sampleFraming: "Hype without substance. A classic.",
    sentimentRange: "positive",
    failureCases: ["evidence of product traction"],
  },
  {
    id: "liquidity_illusion",
    useCase: "Fake volume",
    triggerThesis: ["suspicious_behavior_pattern"],
    triggerNarratives: ["liquidity_volume_spike"],
    sampleFraming: "Volume that doesn't stick. Curious.",
    sentimentRange: "any",
    failureCases: ["verified on-chain volume"],
  },
  {
    id: "cycle_fatigue",
    useCase: "Recycled thesis",
    triggerThesis: ["narrative_stronger_than_product", "overpromise_underdelivery"],
    triggerNarratives: ["recycled_macro_thesis"],
    sampleFraming: "Seen this movie before.",
    sentimentRange: "any",
    failureCases: ["novel thesis with evidence"],
  },
  {
    id: "meme_to_reality_gap",
    useCase: "Meme vs fundamentals",
    triggerThesis: ["empty_hype_no_substance", "claim_exceeds_evidence"],
    triggerNarratives: ["meme_viral_launch"],
    sampleFraming: "The meme was strong. The product, less so.",
    sentimentRange: "positive",
    failureCases: ["sustained product metrics"],
  },
  {
    id: "post_hype_silence",
    useCase: "Post-announcement decay",
    triggerThesis: ["overpromise_underdelivery", "claim_exceeds_evidence"],
    triggerNarratives: ["post_hype_silence"],
    sampleFraming: "The silence after the pump. Always telling.",
    sentimentRange: "negative",
    failureCases: ["ongoing engagement"],
  },
  {
    id: "maxima_vs_reality",
    useCase: "ATH claims",
    triggerThesis: ["claim_exceeds_evidence"],
    triggerNarratives: ["liquidity_volume_spike", "hopium_wagmi_diamond_hands"],
    sampleFraming: "ATH without proof. Standard.",
    sentimentRange: "positive",
    failureCases: ["verified on-chain data"],
  },
  {
    id: "hopium_overdose",
    useCase: "WAGMI/diamond hands",
    triggerThesis: ["empty_hype_no_substance", "claim_exceeds_evidence"],
    triggerNarratives: ["hopium_wagmi_diamond_hands"],
    sampleFraming: "Hopium levels: elevated.",
    sentimentRange: "positive",
    failureCases: ["measured optimism with data"],
  },
  {
    id: "this_time_different",
    useCase: "Cycle narrative",
    triggerThesis: ["narrative_stronger_than_product"],
    triggerNarratives: ["this_cycle_different"],
    sampleFraming: "This time is different. Said every cycle.",
    sentimentRange: "positive",
    failureCases: ["structural evidence of change"],
  },
  {
    id: "narrative_decay_timeline",
    useCase: "Fading narrative",
    triggerThesis: ["narrative_stronger_than_product", "overpromise_underdelivery"],
    triggerNarratives: ["post_hype_silence"],
    sampleFraming: "Narrative half-life: shorter than expected.",
    sentimentRange: "negative",
    failureCases: ["narrative still active"],
  },
  {
    id: "copium_scale",
    useCase: "Copium behavior",
    triggerThesis: ["claim_exceeds_evidence", "unclear_or_unverifiable"],
    triggerNarratives: ["healthy_correction", "rug_scam_fear"],
    sampleFraming: "Copium calibration: ongoing.",
    sentimentRange: "negative",
    failureCases: ["legitimate correction context"],
  },
  {
    id: "self_fulfilling_prophecy",
    useCase: "Circular logic",
    triggerThesis: ["theatrical_professionalism", "suspicious_behavior_pattern"],
    triggerNarratives: ["influencer_pump"],
    sampleFraming: "The prophecy fulfills itself. Until it doesn't.",
    sentimentRange: "any",
    failureCases: ["organic adoption signals"],
  },
];

export const FALLBACK_PATTERN_ID = "narrative_vs_reality";

export interface PatternSelectionResult {
  pattern_id: string;
  framing: string;
  fallback_used: boolean;
}

export function triggerConditionsMatch(
  pattern: RoastPattern,
  thesis: { primary: ThesisType },
  narrative: { label: string },
): boolean {
  const thesisMatch = pattern.triggerThesis.includes(thesis.primary);
  const narrativeMatch =
    pattern.triggerNarratives.length === 0 ||
    narrative.label === "unclassified" ||
    pattern.triggerNarratives.includes(narrative.label as RoastPattern["triggerNarratives"][number]);
  return thesisMatch && narrativeMatch;
}

export function getFallbackPattern(): RoastPattern {
  const fallback = ROAST_PATTERNS.find((p) => p.id === FALLBACK_PATTERN_ID);
  if (!fallback) {
    throw new Error(`Fallback pattern ${FALLBACK_PATTERN_ID} not found`);
  }
  return fallback;
}

export function getPatternById(id: string): RoastPattern | undefined {
  return ROAST_PATTERNS.find((p) => p.id === id);
}
