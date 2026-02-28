/**
 * Energy Inference Engine
 *
 * Determines energy level (1-5) with rollDice variance ±1.
 * Base energy from command (/remix energy=) or inferred from text.
 * Applies deterministic dice variance unless user explicitly sets energy.
 */

import type { Dice } from "../utils/rollDice.js";
import {
  inferEnergy as baseInfer,
  type EnergyLevel,
  type EnergyInput,
} from "./energyInference.js";

export type { EnergyLevel };

export type EnergyInferenceInput = EnergyInput & {
  dice?: Dice | null;
  /** Optional bump (e.g. whitelist privileges) applied before dice variance */
  energyBump?: number;
};

function clampEnergy(n: number): EnergyLevel {
  return Math.max(1, Math.min(5, Math.round(n))) as EnergyLevel;
}

/**
 * Infer energy with optional dice variance ±1.
 * Variance is only applied when user has NOT explicitly set energy.
 */
export function inferEnergyWithVariance(input: EnergyInferenceInput): EnergyLevel {
  let base = baseInfer(input);
  const explicitEnergy = input.explicitEnergy != null;
  const bump = input.energyBump ?? 0;
  base = clampEnergy(base + bump);

  // No variance if user explicitly set energy
  if (explicitEnergy || !input.dice) {
    return base;
  }

  // Apply ±1 variance (deterministic per dice seed)
  const delta = input.dice.chance(0.5) ? 1 : -1;
  return clampEnergy(base + delta);
}
