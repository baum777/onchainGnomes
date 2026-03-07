/**
 * Roast Pattern Selection Engine
 * Selects roast pattern from library based on thesis, narrative, scores.
 * Implements anti-repetition via recent-pattern penalty.
 */

import type { ThesisBundle, ThesisType, ScoreBundle } from "../canonical/types.js";
import type { NarrativeResult } from "../narrative/narrativeMapper.js";
import {
  ROAST_PATTERNS,
  FALLBACK_PATTERN_ID,
  triggerConditionsMatch,
  type RoastPattern,
  type PatternSelectionResult,
} from "./patternLibrary.js";

/** In-memory store for recent pattern usage (author_id -> pattern_ids in last 24h) */
const recentPatternStore = new Map<string, string[]>();
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const RECENT_PATTERN_PENALTY = 0.2;
const MAX_RECENT_PER_USER = 20;

function getRecentPatterns(authorId: string): string[] {
  const entries = recentPatternStore.get(authorId) ?? [];
  return entries;
}

function recordPatternUsage(authorId: string, patternId: string): void {
  const entries = recentPatternStore.get(authorId) ?? [];
  entries.push(patternId);
  const trimmed = entries.slice(-MAX_RECENT_PER_USER);
  recentPatternStore.set(authorId, trimmed);
}

function computeRecentPenalty(authorId: string, patternId: string): number {
  const recent = getRecentPatterns(authorId);
  const count = recent.filter((id) => id === patternId).length;
  return Math.min(count * RECENT_PATTERN_PENALTY, 0.8);
}

function computeRoastability(thesis: ThesisBundle, scores: ScoreBundle): number {
  const thesisRoastable = new Set<ThesisType>([
    "empty_hype_no_substance",
    "claim_exceeds_evidence",
    "narrative_stronger_than_product",
    "suspicious_behavior_pattern",
    "overpromise_underdelivery",
    "theatrical_professionalism",
    "obvious_bait",
  ]);
  const base = thesisRoastable.has(thesis.primary) ? 0.7 : 0.3;
  const evidenceBoost = thesis.evidence_bullets.length > 0 ? 0.15 : 0;
  const opportunityBoost = scores.opportunity * 0.15;
  return Math.min(base + evidenceBoost + opportunityBoost, 1);
}

/**
 * Select the best roast pattern for the given context.
 */
export function selectPattern(
  thesis: ThesisBundle,
  narrative: NarrativeResult,
  scores: ScoreBundle,
  authorId: string,
): PatternSelectionResult {
  const roastability = computeRoastability(thesis, scores);
  const narrativeConfidence = narrative.confidence;

  const candidates = ROAST_PATTERNS.filter((p) =>
    triggerConditionsMatch(p, thesis, narrative),
  );

  if (candidates.length === 0) {
    const fallback = ROAST_PATTERNS.find((p) => p.id === FALLBACK_PATTERN_ID)!;
    return {
      pattern_id: fallback.id,
      framing: fallback.sampleFraming,
      fallback_used: true,
    };
  }

  let best: RoastPattern | null = null;
  let bestWeight = -1;

  for (const c of candidates) {
    const recentPenalty = computeRecentPenalty(authorId, c.id);
    const weight =
      roastability * narrativeConfidence * (1 - recentPenalty);
    if (weight > bestWeight) {
      bestWeight = weight;
      best = c;
    }
  }

  const selected = best ?? ROAST_PATTERNS.find((p) => p.id === FALLBACK_PATTERN_ID)!;
  recordPatternUsage(authorId, selected.id);

  return {
    pattern_id: selected.id,
    framing: selected.sampleFraming,
    fallback_used: false,
  };
}

/** Reset recent pattern store (for tests) */
export function resetRecentPatternStore(): void {
  recentPatternStore.clear();
}
