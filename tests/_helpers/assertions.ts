import { expect } from "vitest";

/**
 * Forbidden internal terms that should never appear in public replies.
 * Extend as needed.
 */
export const FORBIDDEN_INTERNAL_TERMS = [
  "score",
  "xp",
  "threshold",
  "flag",
  "level",
  "energy",
  "mode",
  "selector",
  "safety",
  "truth gate",
  "intent",
  "prompt",
  "system prompt",
  "policy",
  "zod",
  "json schema",
];

export function assertWithin280(text: string) {
  expect(text.length).toBeLessThanOrEqual(280);
}

export function assertNoForbiddenTerms(text: string) {
  const lower = text.toLowerCase();
  const hit = FORBIDDEN_INTERNAL_TERMS.find((t) => lower.includes(t));
  expect(hit, `Reply contains forbidden internal term: "${hit}"`).toBeUndefined();
}

/**
 * Very light "humanish" check: avoid empty, avoid pure JSON, avoid tool-y format.
 * Keep it permissive; safety + schemas do the real work.
 */
export function assertLooksLikeReply(text: string) {
  expect(text.trim().length).toBeGreaterThan(3);
  expect(text.trim().startsWith("{")).toBe(false);
  expect(text.trim().endsWith("}")).toBe(false);
}
