import type { StateStore } from "../state/stateStore.js";
import { getStateStore } from "../state/storeFactory.js";
import { logInfo } from "./logger.js";

export type DedupeDecision =
  | { ok: true }
  | { ok: false; reason: "already_processed" };

const DEFAULT_TTL_SECONDS = 86400; // 24h

export async function isDuplicate(
  store: StateStore,
  eventId: string,
): Promise<boolean> {
  const key = `event:${eventId}`;
  if (await store.exists(key)) {
    return true;
  }
  await store.set(key, "processed", DEFAULT_TTL_SECONDS);
  return false;
}

export async function dedupeCheckAndMark(
  tweetId: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
  store?: StateStore,
): Promise<DedupeDecision> {
  const kv = store ?? getStateStore();
  const key = `dedupe:mention:${tweetId}`;

  if (await kv.exists(key)) {
    return { ok: false, reason: "already_processed" };
  }

  await kv.set(key, "1", ttlSeconds);
  logInfo("[DEDUPE] Marked new event", { tweetId });
  return { ok: true };
}
