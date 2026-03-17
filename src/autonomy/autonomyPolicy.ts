/**
 * Autonomy Policy — Bounded autonomous character response
 *
 * Phase-4: Determines if autonomy triggers should activate.
 */

import type { AutonomySignals } from "./autonomySignals.js";

export interface AutonomyDecision {
  allow: boolean;
  reason?: string;
}

/** Policy: allow autonomy only when signals strong and bounded. */
export function evaluateAutonomy(
  signals: AutonomySignals,
  opts?: { enabled?: boolean; maxAutonomyPerHour?: number },
): AutonomyDecision {
  if (opts?.enabled !== true) return { allow: false, reason: "autonomy_disabled" };
  const triggered =
    signals.extremeAbsurdity ||
    signals.viralThread ||
    (signals.recurringUser && signals.narrativeArcContinuation);
  if (!triggered) return { allow: false, reason: "no_trigger" };
  return { allow: true };
}
