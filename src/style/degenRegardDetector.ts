/**
 * Degen-Regard Detector — Heuristics for chaotic meme-coin events
 */

import type { CanonicalEvent, ClassifierOutput } from "../canonical/types.js";
import type { EnergySignals } from "./energyDetector.js";

const DEGEN_KEYWORDS = [
  "moon",
  "mooning",
  "100x",
  "1000x",
  "gem",
  "lfg",
  "wagmi",
  "ngmi",
  "ape",
  "cope",
  "rug",
  "jeet",
  "cooked",
  "regarded",
  "smooth brain",
  "alpha",
  "guaranteed",
];

const HYPE_INTENTS = ["hype_claim", "performance_claim", "market_narrative"];

/** Degen keywords per word, scaled 0-5 */
export function computeKeywordDensity(event: CanonicalEvent): number {
  const text = event.text.toLowerCase();
  const words = event.text.split(/\s+/).filter(Boolean).length || 1;
  const matches = DEGEN_KEYWORDS.filter((kw) => text.includes(kw)).length;
  return Math.min(5, (matches / words) * 10);
}

/** Meme-coin event: high meme mania + hype intent, or 2+ meme keywords + cashtag */
export function isMemeCoinEvent(
  event: CanonicalEvent,
  cls: ClassifierOutput,
  signals: EnergySignals,
): boolean {
  const text = event.text.toLowerCase();
  const memeMatches = DEGEN_KEYWORDS.filter((kw) => text.includes(kw)).length;
  const highMeme = signals.memeManiaScore >= 0.5;
  const hypeIntent = HYPE_INTENTS.includes(cls.intent);
  return (
    (highMeme && hypeIntent) ||
    (memeMatches >= 2 && event.cashtags.length > 0)
  );
}
