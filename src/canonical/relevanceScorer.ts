/**
 * Relevance Scorer — Gorky spec formula for response-worthiness.
 * relevance_score = w1*mention_signal + w2*narrative_relevance + w3*roastability
 *   + w4*analytical_opportunity + w5*sentiment_intensity - w6*risk_penalty
 */

import type { CanonicalEvent, ClassifierOutput, ScoreBundle, ThesisBundle } from "./types.js";
import type { NarrativeResult } from "../narrative/narrativeMapper.js";

const W1 = 0.2;
const W2 = 0.25;
const W3 = 0.25;
const W4 = 0.15;
const W5 = 0.05;
const W6 = 0.1;

export interface RelevanceInput {
  event: CanonicalEvent;
  cls: ClassifierOutput;
  scores: ScoreBundle;
  thesis: ThesisBundle | null;
  narrative: NarrativeResult | null;
}

export interface RelevanceResult {
  score: number;
  components: {
    mention_signal: number;
    narrative_relevance: number;
    roastability: number;
    analytical_opportunity: number;
    sentiment_intensity: number;
    risk_penalty: number;
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function computeRelevanceScore(input: RelevanceInput): RelevanceResult {
  const { event, cls, scores, thesis, narrative } = input;

  const mention_signal = event.trigger_type === "mention" ? 1 : 0.5;

  const narrative_relevance = narrative?.confidence ?? 0.5;

  const roastability = thesis
    ? cls.evidence_class === "self_contained_strong"
      ? 0.8
      : cls.evidence_class === "contextual_medium"
        ? 0.6
        : cls.evidence_class === "weak_speculative"
          ? 0.4
          : 0.2
    : 0;

  const analytical_opportunity = ["hype_claim", "performance_claim", "accusation", "market_narrative"].includes(
    cls.intent,
  )
    ? 0.8
    : ["question", "launch_announcement"].includes(cls.intent)
      ? 0.6
      : 0.3;

  const sentiment_intensity = cls.risk_flags.includes("aggressive_input") ? 0.6 : 0.3;

  const risk_penalty =
    cls.bait_probability * 0.4 + cls.spam_probability * 0.4 + (cls.risk_flags.includes("aggressive_input") ? 0.2 : 0);

  const score = clamp01(
    W1 * mention_signal +
      W2 * narrative_relevance +
      W3 * roastability +
      W4 * analytical_opportunity +
      W5 * sentiment_intensity -
      W6 * risk_penalty,
  );

  return {
    score,
    components: {
      mention_signal,
      narrative_relevance,
      roastability,
      analytical_opportunity,
      sentiment_intensity,
      risk_penalty,
    },
  };
}
