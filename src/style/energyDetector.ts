/**
 * Energy Detector — Market Energy Level Calculation
 */

import type { CanonicalEvent, ClassifierOutput, ScoreBundle } from "../canonical/types.js";

export type MarketEnergyLevel = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";

export interface EnergySignals {
  priceMovementPercent: number;
  ctEngagementScore: number;
  viralNarrativeScore: number;
  memeManiaScore: number;
  breakoutDetected: boolean;
  intent?: string;
  opportunityScore?: number;
}

const THRESHOLDS = {
  MEDIUM: 0.35,
  HIGH: 0.65,
  EXTREME: 0.85,
};

const WEIGHTS = {
  priceMovement: 0.25,
  ctEngagement: 0.20,
  viralNarrative: 0.25,
  memeMania: 0.20,
  breakout: 0.10,
};

function calculateRawEnergy(signals: EnergySignals): number {
  const normalizedPrice = Math.min(signals.priceMovementPercent / 0.50, 1);
  const breakoutBonus = signals.breakoutDetected ? 1 : 0;
  const rawScore =
    normalizedPrice * WEIGHTS.priceMovement +
    signals.ctEngagementScore * WEIGHTS.ctEngagement +
    signals.viralNarrativeScore * WEIGHTS.viralNarrative +
    signals.memeManiaScore * WEIGHTS.memeMania +
    breakoutBonus * WEIGHTS.breakout;
  return Math.min(rawScore, 1);
}

function scoreToLevel(score: number): MarketEnergyLevel {
  if (score >= THRESHOLDS.EXTREME) return "EXTREME";
  if (score >= THRESHOLDS.HIGH) return "HIGH";
  if (score >= THRESHOLDS.MEDIUM) return "MEDIUM";
  return "LOW";
}

export function calculateMarketEnergy(signals: EnergySignals): MarketEnergyLevel {
  return scoreToLevel(calculateRawEnergy(signals));
}

export function shouldActivateHornySlang(level: MarketEnergyLevel): boolean {
  return level === "HIGH" || level === "EXTREME";
}

export function extractEnergySignals(
  event: CanonicalEvent,
  cls: ClassifierOutput,
  scores: ScoreBundle,
): EnergySignals {
  const text = event.text.toLowerCase();
  const memeKeywords = ["moon", "mooning", "100x", "1000x", "gem", "alpha", "lfg", "wagmi", "guaranteed"];
  const memeMatches = memeKeywords.filter((kw) => text.includes(kw)).length;
  const memeManiaScore = Math.min(memeMatches / 3, 1);
  const tagDensity = (event.hashtags.length + event.cashtags.length) / 10;
  const viralNarrativeScore = Math.min(tagDensity, 1);
  const hypeIntents = ["hype_claim", "performance_claim", "market_narrative"];
  const intentBoost = hypeIntents.includes(cls.intent) ? 0.3 : 0;
  const ctEngagementScore = Math.min(scores.opportunity + intentBoost, 1);
  const priceMovementPercent = hypeIntents.includes(cls.intent) ? 0.15 : 0.05;
  const breakoutPatterns = [/breakout/i, /resistance/i, /pump/i, /surge/i, /rally/i];
  const breakoutDetected = breakoutPatterns.some((p) => p.test(text));
  return {
    priceMovementPercent,
    ctEngagementScore,
    viralNarrativeScore,
    memeManiaScore,
    breakoutDetected,
    intent: cls.intent,
    opportunityScore: scores.opportunity,
  };
}

export function getEnergyStyleHints(level: MarketEnergyLevel): string[] {
  switch (level) {
    case "LOW":
      return ["dry observation tone", "minimal emotion", "factual focus"];
    case "MEDIUM":
      return ["sarcastic roast tone", "subtle wit", "measured skepticism"];
    case "HIGH":
      return [
        "playful slang mode",
        "heat metaphors: hot, spicy, cooking",
        "flirt metaphors: chart flirting, teasing levels",
        "crowd reaction: ct gonna clap, timeline erupt",
        "thirsty liquidity: buyers hungry, capital chasing",
      ];
    case "EXTREME":
      return [
        "max meme energy",
        "unhinged mode: ct absolutely unhinged",
        "timeline going feral",
        "market acting wild",
        "chaos energy",
      ];
    default:
      return [];
  }
}
