/**
 * Format Decision Engine — Decides response format: skip | short_reply | expanded_reply | short_thread
 * Deterministic rules per Gorky spec.
 */

import type { CanonicalEvent } from "../canonical/types.js";
import type { ClassifierOutput } from "../canonical/types.js";
import type { NarrativeResult } from "../narrative/narrativeMapper.js";

export type ResponseFormat = "skip" | "short_reply" | "expanded_reply" | "short_thread";

export interface FormatDecision {
  format: ResponseFormat;
  reason: string;
}

const EXPLAIN_REQUEST_PATTERNS = [
  /\bwhy\b/i,
  /\bexplain\b/i,
  /\banalysis\b/i,
  /\bdeep\s+dive\b/i,
  /\bbreak\s+it\s+down\b/i,
  /\bwalk\s+me\s+through\b/i,
  /\bhow\s+does\s+this\s+work\b/i,
];

const PANIC_INDICATORS = [
  /\burgent\b/i,
  /\bemergency\b/i,
  /\bcrash\b/i,
  /\bdump\b/i,
  /\brug\b/i,
  /\bscam\b/i,
  /!{2,}/,
  /\bsell\s+now\b/i,
  /\bget\s+out\b/i,
  /\bgoing\s+to\s+zero\b/i,
];

export interface FormatDecisionInput {
  event: CanonicalEvent;
  cls: ClassifierOutput;
  narrative: NarrativeResult | null;
  relevanceScore: number;
  minRelevanceThreshold: number;
  /** Whether thread format is allowed (feature flag) */
  threadEnabled?: boolean;
}

/**
 * Decides response format based on event, classifier, narrative, and relevance.
 * Default: short_reply. Thread only when justified.
 */
export function formatDecision(input: FormatDecisionInput): FormatDecision {
  const {
    event,
    cls,
    narrative,
    relevanceScore,
    minRelevanceThreshold,
    threadEnabled = false,
  } = input;

  if (relevanceScore < minRelevanceThreshold) {
    return { format: "skip", reason: "relevance_below_threshold" };
  }

  const text = event.text;
  const combined = event.parent_text ? `${text} ${event.parent_text}` : text;
  const hasExplainRequest = EXPLAIN_REQUEST_PATTERNS.some((p) => p.test(combined));
  const hasPanicIndicators = PANIC_INDICATORS.filter((p) => p.test(combined)).length >= 2;
  const conversationLength = event.conversation_context?.length ?? 0;
  const isThreadRoot = conversationLength >= 3;

  if (hasPanicIndicators) {
    return {
      format: "expanded_reply",
      reason: "sentiment_extreme_panic_calm_structure",
    };
  }

  if (hasExplainRequest && threadEnabled) {
    const multipleSignals =
      (cls.evidence_bullets?.length ?? 0) >= 2 || (narrative?.confidence ?? 0) >= 0.7;
    if (multipleSignals && isThreadRoot) {
      return { format: "short_thread", reason: "explain_request_multiple_signals_thread_context" };
    }
    return { format: "expanded_reply", reason: "explain_request" };
  }

  if (hasExplainRequest) {
    return { format: "expanded_reply", reason: "explain_request" };
  }

  if (threadEnabled && isThreadRoot && (cls.evidence_bullets?.length ?? 0) >= 2) {
    return { format: "short_thread", reason: "thread_context_multiple_signals" };
  }

  const contextAmbiguous =
    !event.parent_text && event.conversation_context.length === 0 && text.length < 30;
  if (contextAmbiguous) {
    return { format: "expanded_reply", reason: "context_materially_ambiguous" };
  }

  return { format: "short_reply", reason: "default" };
}
