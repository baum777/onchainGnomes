/**
 * Gnome Selector — Select the appropriate gnome per interaction
 *
 * When GNOMES_ENABLED=false or registry empty, always returns default safe gnome (gorky).
 * Phase-1: Single-gnome fallback only; Phase-2 will add scoring.
 */

import { getGnome, getAllGnomes } from "../gnomes/registry.js";
import type { SelectorFeatures } from "./selectorFeatures.js";
import type { CanonicalMode } from "../canonical/types.js";

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
}

/**
 * Select gnome for this interaction.
 * Default: gorky when disabled or no gnomes loaded.
 */
export function selectGnome(
  features: SelectorFeatures,
  responseMode: CanonicalMode,
  opts?: {
    defaultSafeGnome?: string;
    enabled?: boolean;
  },
): GnomeSelectionResult {
  const defaultGnome = opts?.defaultSafeGnome ?? "gorky";
  const enabled = opts?.enabled ?? false;

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

  const gnome = getGnome(defaultGnome) ?? all[0];
  const selectedId = gnome?.id ?? defaultGnome;

  return {
    selectedGnomeId: selectedId,
    score: 1,
    reasoning: ["phase1_single_gnome_fallback"],
    alternativeCandidates: [],
    responseMode,
  };
}
