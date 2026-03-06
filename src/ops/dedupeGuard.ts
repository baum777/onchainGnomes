/**
 * Duplicate Mention Guard — TTL-based deduplication
 *
 * Prevents double-reply on repeated poll, race conditions, or API jitter.
 * For multi-worker: replace kvLite with Redis for cross-instance dedupe.
 */

import { kvGet, kvSet } from "./kvLite.js";

export type DedupeDecision =
  | { ok: true }
  | { ok: false; reason: "already_processed" };

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function keyFor(tweetId: string): string {
  return `dedupe:mention:${tweetId}`;
}

/**
 * Returns ok=false if this mention was already processed (within TTL).
 * Marks the mention as processed when ok=true.
 * Atomic enough for a single worker.
 */
export async function dedupeCheckAndMark(
  tweetId: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<DedupeDecision> {
  const key = keyFor(tweetId);
  const existing = await kvGet(key);
  if (existing) return { ok: false, reason: "already_processed" };

  await kvSet(key, "1", ttlSeconds);
  return { ok: true };
}
