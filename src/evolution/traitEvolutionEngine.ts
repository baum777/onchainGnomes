/**
 * Trait Evolution Engine — Bounded trait adjustments
 *
 * Phase-3: Proposes small incremental trait changes based on signals.
 */

import type { EvolutionSignal } from "./evolutionSignals.js";
import { validateTraitBounds, type TraitBounds } from "./traitBoundsValidator.js";

export interface EvolvedTrait {
  gnome_id: string;
  trait_key: string;
  old_value: number;
  new_value: number;
  applied: boolean;
}

/** Apply evolution signals within bounds. Returns proposed adjustments. */
export function applyEvolutionSignals(
  signals: EvolutionSignal[],
  currentTraits: Record<string, number>,
  bounds: Record<string, TraitBounds>,
  opts?: { enabled?: boolean },
): EvolvedTrait[] {
  if (!opts?.enabled || !signals.length) return [];
  const results: EvolvedTrait[] = [];
  for (const s of signals) {
    const current = currentTraits[s.trait_key] ?? 0.5;
    const b = bounds[s.trait_key] ?? { min: 0, max: 1, driftLimitPer100: 0.25 };
    const delta = s.direction === "up" ? s.magnitude * 0.1 : -s.magnitude * 0.1;
    const proposed = Math.max(0, Math.min(1, current + delta));
    const validation = validateTraitBounds(proposed, current, b);
    const newVal = validation.valid ? proposed : (validation.clamped ?? current);
    results.push({
      gnome_id: s.gnome_id,
      trait_key: s.trait_key,
      old_value: current,
      new_value: newVal,
      applied: validation.valid,
    });
  }
  return results;
}
