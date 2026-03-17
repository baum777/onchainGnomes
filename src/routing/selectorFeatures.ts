/**
 * Selector Features — Extract features for gnome selection from event context
 *
 * Aggregates intent, aggression, absurdity, sincerity, topic tags, market energy,
 * and user familiarity for the gnome selector.
 */

import type { ClassifierOutput, ScoreBundle, CanonicalEvent } from "../canonical/types.js";
import type { MarketEnergyLevel } from "../style/energyDetector.js";

export interface SelectorFeatures {
  intent: string;
  aggressionScore: number;
  absurdityScore: number;
  sincerityScore: number;
  topicTags: string[];
  marketEnergy: MarketEnergyLevel;
  userFamiliarity: number;
  relevanceScore: number;
  confidenceScore: number;
  /** Thread ID for continuity (if known) */
  threadId?: string;
}

/**
 * Compute selector features from classifier, scores, and event.
 * Used by gnomeSelector for scoring.
 */
export function extractSelectorFeatures(
  cls: ClassifierOutput,
  scores: ScoreBundle,
  event: CanonicalEvent,
  opts?: {
    marketEnergy?: MarketEnergyLevel;
    userFamiliarity?: number;
    threadId?: string;
  },
): SelectorFeatures {
  const aggressionScore = inferAggression(cls, scores);
  const absurdityScore = inferAbsurdity(cls, scores);
  const sincerityScore = inferSincerity(cls, scores);
  const topicTags = inferTopicTags(cls);

  return {
    intent: cls.intent,
    aggressionScore,
    absurdityScore,
    sincerityScore,
    topicTags,
    marketEnergy: opts?.marketEnergy ?? "MEDIUM",
    userFamiliarity: opts?.userFamiliarity ?? 0,
    relevanceScore: scores.relevance ?? 0.5,
    confidenceScore: scores.confidence ?? 0.5,
    threadId: opts?.threadId,
  };
}

function inferAggression(cls: ClassifierOutput, _scores: ScoreBundle): number {
  if (cls.intent === "accusation" || cls.intent === "bait") return 0.8;
  if ((cls as { intent?: string }).intent === "insult") return 0.9;
  if (cls.intent === "greeting" || cls.intent === "casual_ping") return 0.1;
  return 0.3;
}

function inferAbsurdity(cls: ClassifierOutput, scores: ScoreBundle): number {
  if (cls.intent === "meme_only" || cls.intent === "hype_claim") return 0.7;
  if (cls.intent === "launch_announcement" && (scores.opportunity ?? 0) > 0.6) return 0.8;
  return 0.3;
}

function inferSincerity(cls: ClassifierOutput, scores: ScoreBundle): number {
  if (cls.intent === "question" || cls.intent === "persona_query" || cls.intent === "lore_query")
    return 0.7;
  if (cls.intent === "bait" || cls.intent === "spam") return 0.1;
  return (scores.confidence ?? 0.5);
}

function inferTopicTags(cls: ClassifierOutput): string[] {
  const tags: string[] = [];
  if (cls.intent.includes("market") || cls.intent === "market_narrative") tags.push("market");
  if (cls.intent === "persona_query" || cls.intent === "lore_query") tags.push("lore", "persona");
  if (cls.intent === "hype_claim" || cls.intent === "performance_claim") tags.push("hype");
  if (cls.intent === "ca_request") tags.push("ca");
  return tags;
}
