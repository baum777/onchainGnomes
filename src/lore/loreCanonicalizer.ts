/**
 * Lore Canonicalizer — Validate and canonicalize lore candidates
 *
 * Phase-5: Ensures lore meets safety and format rules.
 */

export interface CanonicalizeResult {
  valid: boolean;
  canonical?: string;
  reason?: string;
}

/** Validate lore content for canonical inclusion. */
export function canonicalizeLore(candidate: string): CanonicalizeResult {
  const trimmed = candidate.trim();
  if (!trimmed || trimmed.length < 10) return { valid: false, reason: "too_short" };
  if (trimmed.length > 200) return { valid: false, reason: "too_long" };
  return { valid: true, canonical: trimmed };
}
