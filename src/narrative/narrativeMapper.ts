/**
 * Narrative Mapper — Classifies events into narrative labels using rules/keywords.
 * Hybrid approach: rules first, optional embedding fallback later.
 */

import type { CanonicalEvent, ClassifierOutput } from "../canonical/types.js";
import {
  type NarrativeLabel,
  type SentimentLabel,
  NARRATIVE_KEYWORDS,
} from "./narrativeLabels.js";

export interface NarrativeResult {
  label: NarrativeLabel;
  confidence: number;
  sentiment: SentimentLabel;
}

const SENTIMENT_POSITIVE = /\b(wagmi|moon|bull|pump|win|alpha|gem|lfg)\b/i;
const SENTIMENT_NEGATIVE = /\b(rug|scam|dump|bear|rekt|ngmi|dead)\b/i;

function classifySentiment(text: string): SentimentLabel {
  const combined = text.toLowerCase();
  const posCount = (combined.match(SENTIMENT_POSITIVE) ?? []).length;
  const negCount = (combined.match(SENTIMENT_NEGATIVE) ?? []).length;
  if (posCount > negCount) return "positive";
  if (negCount > posCount) return "negative";
  return "neutral";
}

function matchNarrative(text: string): { label: NarrativeLabel; confidence: number } {
  const combined = text;
  for (const { label, keywords, boosters } of NARRATIVE_KEYWORDS) {
    const matches = keywords.filter((k) => k.test(combined)).length;
    if (matches === 0) continue;

    let confidence = 0.4 + matches * 0.2;
    if (boosters?.some((b) => b.test(combined))) {
      confidence = Math.min(1, confidence + 0.15);
    }
    return { label, confidence: Math.min(1, confidence) };
  }
  return { label: "unclassified", confidence: 0.2 };
}

/**
 * Maps an event to a narrative label with confidence and sentiment.
 */
export function mapNarrative(
  event: CanonicalEvent,
  _cls?: ClassifierOutput,
): NarrativeResult {
  const text = event.parent_text ? `${event.text} ${event.parent_text}` : event.text;
  const { label, confidence } = matchNarrative(text);
  const sentiment = classifySentiment(text);
  return { label, confidence, sentiment };
}
