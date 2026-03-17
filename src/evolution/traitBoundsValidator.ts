/**
 * Trait Bounds Validator — Enforce trait limits
 *
 * Phase-3: Ensures proposed trait adjustments stay within configured bounds.
 */

export interface TraitBounds {
  min: number;
  max: number;
  driftLimitPer100: number;
}

const DEFAULT_DRIFT = 0.25;

/** Validate proposed trait value against profile bounds. */
export function validateTraitBounds(
  proposed: number,
  current: number,
  bounds: TraitBounds,
  opts?: { driftLimit?: number },
): { valid: boolean; clamped?: number; reason?: string } {
  const limit = opts?.driftLimit ?? bounds.driftLimitPer100 ?? DEFAULT_DRIFT;
  if (proposed < bounds.min) return { valid: false, clamped: bounds.min, reason: "below_min" };
  if (proposed > bounds.max) return { valid: false, clamped: bounds.max, reason: "above_max" };
  const drift = Math.abs(proposed - current);
  if (drift > limit) {
    const clamped = current + (proposed > current ? limit : -limit);
    return { valid: false, clamped, reason: "drift_exceeded" };
  }
  return { valid: true };
}
