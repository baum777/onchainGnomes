/**
 * Select Best - Candidate Scoring and Selection
 *
 * Multi-factor scoring system for reply candidates:
 * - Context relevance (timeline alignment)
 * - Persona fit (mode consistency)
 * - Topic alignment (entity overlap)
 * - Anti-repetition penalty
 * - Safety score
 *
 * Returns the highest scoring candidate with detailed scoring metadata.
 */

import type {
  ReplyCandidate,
  CandidateScore,
  PersonaMode,
  IntentCategory,
} from "../types/coreTypes.js";
import type { ThreadContext, TimelineBrief } from "../context/types.js";
import { checkPersonaConsistency } from "../persona/personaRouter.js";
import { isResponseSafe, type TruthGateContext } from "../truth/truthGate.js";

export interface SelectionDeps {
  // Optional repetition guard
  repetitionGuard?: {
    check: (text: string) => { is_repetitive: boolean; penalty_factor: number };
  };
}

/** Selection context */
export interface SelectionContext {
  thread: ThreadContext;
  timeline?: TimelineBrief | null;
  personaMode: PersonaMode;
  intent: IntentCategory;
  truthContext: TruthGateContext;
}

/**
 * Selects the best reply candidate from multiple options.
 * Main entry point for candidate selection.
 */
export function selectBest(
  candidates: ReplyCandidate[],
  context: SelectionContext,
  deps: SelectionDeps = {}
): { selected: ReplyCandidate; scores: CandidateScore[] } {
  if (candidates.length === 0) {
    throw new Error("No candidates provided for selection");
  }

  if (candidates.length === 1) {
    const score = scoreCandidate(candidates[0]!, context, deps);
    return {
      selected: candidates[0]!,
      scores: [score],
    };
  }

  // Score all candidates
  const scored = candidates.map(c => scoreCandidate(c, context, deps));

  // Sort by overall score (descending)
  scored.sort((a, b) => b.scores.overall - a.scores.overall);

  // Select highest scoring
  const best = scored[0];
  if (!best) throw new Error("No scored candidates");
  const selected = candidates.find(c => c.candidate_id === best.candidate_id) ?? candidates[0]!;

  return {
    selected,
    scores: scored,
  };
}

/**
 * Scores a single candidate across multiple factors.
 */
function scoreCandidate(
  candidate: ReplyCandidate,
  context: SelectionContext,
  deps: SelectionDeps
): CandidateScore {
  const penalties: string[] = [];

  // 1. Context Relevance (0-100)
  const contextRelevance = calculateContextRelevance(
    candidate.reply_text,
    context.thread,
    context.timeline
  );

  // 2. Persona Fit (0-100)
  const personaCheck = checkPersonaConsistency(candidate.reply_text, context.personaMode);
  const personaFit = personaCheck.consistent ? 90 : 40;
  if (!personaCheck.consistent) {
    penalties.push(`persona_drift: ${personaCheck.drift_signals.join(", ")}`);
  }

  // 3. Topic Alignment (0-100)
  const topicAlignment = calculateTopicAlignment(
    candidate.reply_text,
    context.thread.entities,
    context.thread.keywords
  );

  // 4. Anti-Repetition (0-100, penalty reduces score)
  let antiRepetition = 100;
  if (deps.repetitionGuard) {
    const check = deps.repetitionGuard.check(candidate.reply_text);
    antiRepetition = Math.round(100 * check.penalty_factor);
    if (check.is_repetitive) {
      penalties.push(`repetitive: similarity detected`);
    }
  }

  // 5. Safety Score (0-100)
  const safety = calculateSafetyScore(candidate.reply_text, context.truthContext);
  if (safety < 70) {
    penalties.push(`safety_concerns: score ${safety}`);
  }

  // Calculate weighted overall score
  const weights = {
    context_relevance: 0.25,
    persona_fit: 0.25,
    topic_alignment: 0.20,
    anti_repetition: 0.15,
    safety: 0.15,
  };

  const weightedSum =
    contextRelevance * weights.context_relevance +
    personaFit * weights.persona_fit +
    topicAlignment * weights.topic_alignment +
    antiRepetition * weights.anti_repetition +
    safety * weights.safety;

  const overall = Math.round(weightedSum);

  // Build selection reason
  const selectionReason = buildSelectionReason(
    candidate,
    { contextRelevance, personaFit, topicAlignment, antiRepetition, safety },
    penalties
  );

  return {
    candidate_id: candidate.candidate_id,
    scores: {
      context_relevance: contextRelevance,
      persona_fit: personaFit,
      topic_alignment: topicAlignment,
      anti_repetition: antiRepetition,
      safety,
      overall,
    },
    penalties,
    selection_reason: selectionReason,
  };
}

/**
 * Calculates context relevance score.
 */
function calculateContextRelevance(
  reply: string,
  thread: ThreadContext,
  timeline?: TimelineBrief | null
): number {
  let score = 50; // Base score
  const replyLower = reply.toLowerCase();

  // Check entity overlap with thread
  for (const entity of thread.entities) {
    if (replyLower.includes(entity.toLowerCase())) {
      score += 10;
    }
  }

  // Check keyword overlap
  for (const keyword of thread.keywords) {
    if (replyLower.includes(keyword.toLowerCase())) {
      score += 5;
    }
  }

  // Check timeline relevance
  if (timeline) {
    for (const phrase of timeline.hot_phrases) {
      if (replyLower.includes(phrase.toLowerCase())) {
        score += 8;
      }
    }

    for (const bullet of timeline.bullets) {
      const words = bullet.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 4 && replyLower.includes(word)) {
          score += 3;
          break;
        }
      }
    }
  }

  // Check intent alignment
  if (thread.intent) {
    const intentPatterns: Record<string, string[]> = {
      question: ["data", "shows", "indicates", "suggests", "unclear", "need", "verification"],
      insult: ["data", "metrics", "numbers", "doesn't", "care"],
      market_request: ["liquidity", "volume", "price", "mcap", "holders"],
      meme_play: ["probably", "maybe", "ser", "rekt", "bags"],
    };

    const patterns = intentPatterns[thread.intent] || [];
    for (const pattern of patterns) {
      if (replyLower.includes(pattern)) {
        score += 5;
      }
    }
  }

  return Math.min(100, score);
}

/**
 * Calculates topic alignment score.
 */
function calculateTopicAlignment(
  reply: string,
  entities: string[],
  keywords: string[]
): number {
  let score = 50;
  const replyLower = reply.toLowerCase();

  // Entity matches are high value
  for (const entity of entities) {
    if (replyLower.includes(entity.toLowerCase())) {
      score += 15;
    }
  }

  // Keyword matches
  for (const keyword of keywords) {
    if (replyLower.includes(keyword.toLowerCase())) {
      score += 8;
    }
  }

  // Crypto-native terms boost alignment
  const cryptoTerms = [
    "liquidity", "bags", "rekt", "dyor", "nfa", "holders",
    "contract", "token", "on-chain", "verified", "rpc"
  ];

  for (const term of cryptoTerms) {
    if (replyLower.includes(term)) {
      score += 3;
    }
  }

  return Math.min(100, score);
}

/**
 * Calculates safety score.
 */
function calculateSafetyScore(
  reply: string,
  truthContext: TruthGateContext
): number {
  let score = 100;

  // Check for safety issues
  const safety = isResponseSafe(reply, truthContext);
  if (!safety.safe) {
    score -= 30;
  }

  // Check for meta leak patterns
  const metaPatterns = [
    /system prompt/i,
    /core instructions/i,
    /my instructions/i,
    /as an ai/i,
    /language model/i,
  ];

  for (const pattern of metaPatterns) {
    if (pattern.test(reply)) {
      score -= 50;
    }
  }

  // Check for financial advice
  const financialPatterns = [
    /\b(buy|sell|hold|enter|exit|ape)\s+(now|immediately|today|this)/i,
    /\bshould\s+(buy|sell|hold)\b/i,
    /\brecommend\s+(buying|selling)\b/i,
  ];

  for (const pattern of financialPatterns) {
    if (pattern.test(reply)) {
      score -= 40;
    }
  }

  // Check for unverified claims
  if (truthContext.containsContractAddress && !truthContext.contractValidationResult?.valid) {
    if (/\b(verified|legitimate|safe|authentic)\b/i.test(reply)) {
      score -= 25;
    }
  }

  return Math.max(0, score);
}

/**
 * Builds the selection reason string.
 */
function buildSelectionReason(
  candidate: ReplyCandidate,
  scores: {
    contextRelevance: number;
    personaFit: number;
    topicAlignment: number;
    antiRepetition: number;
    safety: number;
  },
  penalties: string[]
): string {
  const parts: string[] = [];

  // Identify strongest factor
  const factorNames: Record<string, number> = {
    "context relevance": scores.contextRelevance,
    "persona fit": scores.personaFit,
    "topic alignment": scores.topicAlignment,
    "anti-repetition": scores.antiRepetition,
    safety: scores.safety,
  };

  const strongest = Object.entries(factorNames)
    .sort((a, b) => b[1] - a[1])[0];
  if (strongest) {
    parts.push(`Strong ${strongest[0]} (${strongest[1]})`);
  }

  // Note risk level
  parts.push(`${candidate.risk} risk`);

  // Note any penalties
  if (penalties.length > 0) {
    parts.push(`penalties: ${penalties.length}`);
  }

  // Note truth category
  parts.push(candidate.truth_category);

  return parts.join(" | ");
}

/**
 * Batch selects best candidates for multiple contexts.
 */
export function batchSelectBest(
  candidateGroups: ReplyCandidate[][],
  contexts: SelectionContext[],
  deps: SelectionDeps = {}
): Array<{ selected: ReplyCandidate; scores: CandidateScore[] }> {
  const results: Array<{ selected: ReplyCandidate; scores: CandidateScore[] }> = [];

  for (let i = 0; i < candidateGroups.length; i++) {
    const group = candidateGroups[i] ?? [];
    const context = contexts[i];
    if (!context) continue;
    const result = selectBest(group, context, deps);
    results.push(result);
  }

  return results;
}

/**
 * Filters candidates by minimum score threshold.
 */
export function filterByMinimumScore(
  candidates: ReplyCandidate[],
  context: SelectionContext,
  minScore: number,
  deps: SelectionDeps = {}
): ReplyCandidate[] {
  const scored = candidates.map(c => scoreCandidate(c, context, deps));
  const passed = scored.filter(s => s.scores.overall >= minScore);

  return candidates.filter(c =>
    passed.some(p => p.candidate_id === c.candidate_id)
  );
}

/**
 * Gets the top N candidates by score.
 */
export function getTopCandidates(
  candidates: ReplyCandidate[],
  context: SelectionContext,
  n: number,
  deps: SelectionDeps = {}
): Array<{ candidate: ReplyCandidate; score: CandidateScore }> {
  const scored = candidates.map(c => ({
    candidate: c,
    score: scoreCandidate(c, context, deps),
  }));

  scored.sort((a, b) => b.score.scores.overall - a.score.scores.overall);

  return scored.slice(0, n);
}

