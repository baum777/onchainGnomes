/**
 * Gnome Selector — Select the appropriate gnome per interaction
 *
 * Phase-2: Scores gnomes by intent match, aggression range, affinity.
 * Safe fallback order: gorky -> grit -> moss.
 * Deterministic for identical inputs.
 */

import { getGnome, getAllGnomes, getFallbackChain } from "../gnomes/registry.js";
import type { GnomeProfile } from "../gnomes/types.js";
import type { SelectorFeatures } from "./selectorFeatures.js";
import type { CanonicalMode } from "../canonical/types.js";
import { selectCameos } from "../swarm/cameoSelector.js";

export interface GnomeSelectionCandidate {
  gnomeId: string;
  score: number;
}

export interface GnomeSelectionResult {
  selectedGnomeId: string;
  score: number;
  reasoning: string[];
  alternativeCandidates: GnomeSelectionCandidate[];
  responseMode: CanonicalMode;
  continuitySource?: string;
  /** Phase-2: optional cameo candidates for future swarm */
  cameoCandidates?: string[];
}

const CONFIDENCE_THRESHOLD = 0.5;

/**
 * Score a gnome for this interaction (deterministic).
 */
function scoreGnome(profile: GnomeProfile, features: SelectorFeatures, affinity: number): number {
  let score = 0.5;

  // Intent match (routing_hints.preferred_intents)
  const preferred = profile.routing_hints?.preferred_intents ?? [];
  if (preferred.length && preferred.includes(features.intent)) score += 0.25;
  else if (profile.archetype === "chaos_roaster" && ["hype_claim", "launch_announcement", "meme_only"].includes(features.intent)) score += 0.2;
  else if (profile.archetype === "dry_observer" && ["question", "persona_query", "lore_query"].includes(features.intent)) score += 0.2;

  // Aggression range
  const aggrRange = profile.routing_hints?.aggression_range;
  if (aggrRange) {
    const [lo, hi] = aggrRange;
    if (features.aggressionScore >= lo && features.aggressionScore <= hi) score += 0.15;
  }

  // User affinity (prefer gnomes user has interacted with positively)
  score += Math.min(affinity * 0.2, 0.2);

  // Absurdity: chaos_roaster/chaotic_reactor thrive on high absurdity
  if (features.absurdityScore > 0.6 && ["chaos_roaster", "chaotic_reactor"].includes(profile.archetype)) score += 0.1;

  return Math.min(score, 1);
}

/**
 * Select gnome for this interaction.
 * Phase-2: Scoring with affinity; safe fallback when confidence low.
 */
export function selectGnome(
  features: SelectorFeatures,
  responseMode: CanonicalMode,
  opts?: {
    defaultSafeGnome?: string;
    enabled?: boolean;
    userAffinityByGnome?: Record<string, number>;
    swarmEnabled?: boolean;
    maxCameos?: number;
  },
): GnomeSelectionResult {
  const defaultGnome = opts?.defaultSafeGnome ?? "gorky";
  const enabled = opts?.enabled ?? false;
  const affinityMap = opts?.userAffinityByGnome ?? {};

  const all = getAllGnomes();
  if (!enabled || all.length === 0) {
    return {
      selectedGnomeId: defaultGnome,
      score: 1,
      reasoning: ["gnomes_disabled_or_empty"],
      alternativeCandidates: [],
      responseMode,
    };
  }

  const fallbackChain = getFallbackChain();

  // Score each gnome (deterministic: stable sort by id then by score)
  const scored: GnomeSelectionCandidate[] = all
    .map((p) => ({
      gnomeId: p.id,
      score: scoreGnome(p, features, affinityMap[p.id] ?? 0),
    }))
    .sort((a, b) => {
      if (Math.abs(a.score - b.score) < 0.01) return a.gnomeId.localeCompare(b.gnomeId);
      return b.score - a.score;
    });

  const best = scored[0];
  const confidenceLow = features.confidenceScore < CONFIDENCE_THRESHOLD;

  let selectedId: string;
  const reasoning: string[] = [];

  if (confidenceLow && fallbackChain.length > 0) {
    selectedId = fallbackChain[0] ?? defaultGnome;
    reasoning.push("low_confidence_safe_fallback");
  } else if (best && best.score >= 0.5) {
    selectedId = best.gnomeId;
    reasoning.push(`scored_${best.score.toFixed(2)}`);
  } else {
    selectedId = fallbackChain[0] ?? defaultGnome;
    reasoning.push("fallback_chain");
  }

  if (["hard_caution", "neutral_clarification"].includes(responseMode) && selectedId === "nebelspieler") {
    const override = getGnome("stillhalter") ?? getGnome("wurzelwaechter");
    if (override) {
      selectedId = override.id;
      reasoning.push("dominance_override_nebelspieler_caution_mode");
    }
  }

  const alternatives = scored.filter((c) => c.gnomeId !== selectedId).slice(0, 3);

  // Phase-3: Add cameoCandidates when swarm enabled and energy/absurdity thresholds met
  let cameoCandidates: string[] | undefined;
  if (opts?.swarmEnabled && opts?.maxCameos && opts.maxCameos > 0) {
    const conversationEnergy = features.relevanceScore * (features.absurdityScore > 0.5 ? 1.2 : 1);
    cameoCandidates = selectCameos(
      {
        primaryGnomeId: selectedId,
        conversationEnergy: Math.min(1, conversationEnergy),
        absurdityScore: features.absurdityScore,
        availableGnomes: all.map((p) => p.id),
      },
      { maxCameos: opts.maxCameos, energyThreshold: 0.65 },
    );
    if (cameoCandidates.length > 0) reasoning.push("swarm_cameos");
  }

  return {
    selectedGnomeId: selectedId,
    score: best?.score ?? 1,
    reasoning,
    alternativeCandidates: alternatives,
    responseMode,
    cameoCandidates,
  };
}
