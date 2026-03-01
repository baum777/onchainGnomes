/**
 * Phase 2 Adaptive Intelligence — Heuristic signal analysis
 */

import type { AdaptiveSignals } from "./types.js";

export interface AdaptiveInput {
  mentionText: string;
  threadText: string;
  timelineText?: string;
}

const SWEAR_WORDS = /\b(fck|shit|damn|idiot|moron|stupid)\b/gi;
const URGENCY_WORDS = /\b(now|urgent|help|asap|quick)\b/i;
const POSITIVE = /\b(good|great|thanks|love|awesome|bullish)\b/i;
const NEGATIVE = /\b(bad|rug|scam|dump|rekt|bearish)\b/i;

export function analyzeAdaptiveSignals(input: AdaptiveInput): AdaptiveSignals {
  const combined =
    `${input.mentionText} ${input.threadText} ${input.timelineText ?? ""}`.toLowerCase();

  let sentiment: AdaptiveSignals["sentiment"] = "neutral";
  if (POSITIVE.test(combined)) sentiment = "positive";
  else if (NEGATIVE.test(combined)) sentiment = "negative";

  let toxicity: AdaptiveSignals["toxicity"] = "low";
  const swearCount = (combined.match(SWEAR_WORDS) ?? []).length;
  if (swearCount >= 3) toxicity = "high";
  else if (swearCount >= 1) toxicity = "med";

  let urgency: AdaptiveSignals["urgency"] = "low";
  if (URGENCY_WORDS.test(combined)) urgency = "med";
  if (/\bhelp\s+me\b|urgent|emergency\b/i.test(combined)) urgency = "high";

  let novelty: AdaptiveSignals["novelty"] = "low";
  if (input.timelineText && input.timelineText.length > 100) novelty = "med";
  if (
    input.timelineText &&
    /alpha|cto|unlock|airdrop/i.test(input.timelineText)
  )
    novelty = "high";

  const contextLen = input.threadText.length + (input.timelineText?.length ?? 0);
  const confidence = Math.min(1, 0.3 + contextLen / 2000);

  let roast_level: AdaptiveSignals["roast_level"] = "medium";
  if (toxicity === "high") roast_level = "deescalate";
  else if (/\b(joke|joking|lol|lmao)\b/i.test(combined)) roast_level = "spicy";
  else if (/\b(please|help|how|what)\b/i.test(combined)) roast_level = "mild";

  return {
    sentiment,
    toxicity,
    urgency,
    novelty,
    confidence,
    roast_level,
  };
}
