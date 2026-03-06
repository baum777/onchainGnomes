import type {
  CanonicalEvent,
  ClassifierOutput,
  ScoreBundle,
} from "./types.js";

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function computeRelevance(event: CanonicalEvent, cls: ClassifierOutput): number {
  let score = 0.3;

  if (cls.intent === "hype_claim" || cls.intent === "performance_claim") score += 0.25;
  if (cls.intent === "accusation") score += 0.3;
  if (cls.intent === "launch_announcement") score += 0.2;
  if (cls.intent === "market_narrative") score += 0.15;
  if (cls.intent === "question") score += 0.15;
  if (cls.intent === "bait") score += 0.05;
  if (cls.intent === "spam" || cls.intent === "irrelevant") score -= 0.25;
  if (cls.intent === "meme_only") score -= 0.1;

  if (event.cashtags.length > 0) score += 0.15;
  if (event.parent_text) score += 0.1;
  if (event.conversation_context.length > 0) score += 0.05;

  return clamp01(score);
}

function computeConfidence(event: CanonicalEvent, cls: ClassifierOutput): number {
  let score = 0.3;

  if (cls.evidence_class === "self_contained_strong") score += 0.4;
  else if (cls.evidence_class === "contextual_medium") score += 0.25;
  else if (cls.evidence_class === "weak_speculative") score += 0.1;
  else score -= 0.1;

  if (cls.evidence_bullets.length >= 3) score += 0.1;
  else if (cls.evidence_bullets.length >= 2) score += 0.05;

  if (event.parent_text) score += 0.1;
  if (event.conversation_context.length >= 2) score += 0.05;

  if (cls.bait_probability > 0.5) score -= 0.15;
  if (cls.spam_probability > 0.3) score -= 0.1;

  return clamp01(score);
}

function computeSeverity(cls: ClassifierOutput): number {
  let score = 0.2;

  if (cls.intent === "accusation") score += 0.4;
  if (cls.intent === "hype_claim") score += 0.2;
  if (cls.intent === "performance_claim") score += 0.25;
  if (cls.intent === "launch_announcement") score += 0.15;

  if (cls.risk_flags.includes("suspicious_behavior_signals")) score += 0.2;
  if (cls.risk_flags.includes("aggressive_input")) score += 0.1;

  if (cls.evidence_class === "self_contained_strong") score += 0.1;

  return clamp01(score);
}

function computeOpportunity(event: CanonicalEvent, cls: ClassifierOutput): number {
  let score = 0.35;

  if (cls.intent === "hype_claim" || cls.intent === "performance_claim") score += 0.25;
  if (cls.intent === "accusation") score += 0.15;
  if (cls.intent === "question") score += 0.2;
  if (cls.intent === "launch_announcement") score += 0.15;
  if (cls.intent === "bait") score -= 0.1;
  if (cls.intent === "spam") score -= 0.3;

  if (event.cashtags.length > 0) score += 0.1;

  const textLen = event.text.length;
  if (textLen > 50 && textLen < 500) score += 0.1;

  return clamp01(score);
}

function computeRisk(cls: ClassifierOutput): number {
  let score = 0.1;

  if (cls.risk_flags.includes("aggressive_input")) score += 0.15;
  if (cls.risk_flags.includes("bait_detected")) score += 0.2;
  if (cls.risk_flags.includes("spam_detected")) score += 0.15;
  if (cls.risk_flags.includes("contains_urls")) score += 0.05;
  if (cls.risk_flags.includes("suspicious_behavior_signals")) score += 0.1;

  if (cls.bait_probability > 0.6) score += 0.15;
  if (cls.spam_probability > 0.5) score += 0.15;

  if (cls.evidence_class === "absent") score += 0.15;
  else if (cls.evidence_class === "weak_speculative") score += 0.1;

  return clamp01(score);
}

function computeNovelty(_event: CanonicalEvent, _cls: ClassifierOutput): number {
  return 0.7;
}

export function scoreEvent(event: CanonicalEvent, cls: ClassifierOutput): ScoreBundle {
  return {
    relevance: computeRelevance(event, cls),
    confidence: computeConfidence(event, cls),
    severity: computeSeverity(cls),
    opportunity: computeOpportunity(event, cls),
    risk: computeRisk(cls),
    novelty: computeNovelty(event, cls),
  };
}
