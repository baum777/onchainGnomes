/**
 * Persona Integrity Guard — Prevent identity drift
 *
 * Phase-3: Detects excessive personality drift, rejects unsafe evolution.
 */

export interface IntegrityCheckResult {
  allowed: boolean;
  reason?: string;
}

/** Reject evolution signals that would violate persona integrity. */
export function checkPersonaIntegrity(
  signals: Array<{ trait_key: string; direction: string; magnitude: number }>,
  _gnomeId: string,
): IntegrityCheckResult {
  for (const s of signals) {
    if (s.magnitude > 0.5) return { allowed: false, reason: "magnitude_too_high" };
    if (["aggression", "hostility"].includes(s.trait_key))
      return { allowed: false, reason: "taboo_trait" };
  }
  return { allowed: true };
}
