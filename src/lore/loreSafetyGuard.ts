/**
 * Lore Safety Guard — Reject unsafe lore
 *
 * Phase-5: No defamation, no personal claims, no politics.
 */

export interface SafetyCheckResult {
  allowed: boolean;
  reason?: string;
}

const BLOCKED_PATTERNS = [
  /real\s+name/i,
  /doxx/i,
  /defamat/i,
  /accus(e|ation)/i,
  /political\s+stance/i,
];

/** Reject lore that violates safety rules. */
export function checkLoreSafety(content: string): SafetyCheckResult {
  for (const p of BLOCKED_PATTERNS) {
    if (p.test(content)) return { allowed: false, reason: "blocked_pattern" };
  }
  return { allowed: true };
}
