/**
 * Distributed Poll Lock (Single-Leader Enforcement)
 *
 * Ensures only one worker polls at a time when USE_REDIS=true.
 * With FileSystem store, lock is process-local (single-worker assumed).
 */

import { getStateStore } from "../state/storeFactory.js";
import { getStoreType } from "../state/storeFactory.js";
import { incrementCounter } from "../observability/metrics.js";
import { COUNTER_NAMES } from "../observability/metricTypes.js";
import { logInfo, logWarn, logError } from "../ops/logger.js";
import { serializeError } from "../utils/errorSerialization.js";

const POLL_LOCK_KEY = "worker:poll_lock";
const POLL_LOCK_TTL_SECONDS = 120; // 2 minutes — long enough for poll + process cycle
const POLL_LOCK_RETRY_MS = 15_000; // 15s between acquire attempts when not leader

let cachedHolderId: string | null = null;

export type PollLockAcquireResult = "acquired" | "denied" | "error";

/** Stable holder ID for this process (reused for extend/release). */
export function getHolderId(): string {
  if (cachedHolderId) return cachedHolderId;
  const pid = process.pid ?? 0;
  const hostname = typeof process.env.HOSTNAME === "string" ? process.env.HOSTNAME : "node";
  cachedHolderId = `${hostname}:${pid}`;
  return cachedHolderId;
}

/**
 * Try to acquire the poll lock.
 * - acquired: we are leader
 * - denied: someone else holds the lock
 * - error: infrastructure failure (must not be treated as "just follower")
 */
export async function tryAcquirePollLock(holderId?: string): Promise<PollLockAcquireResult> {
  const store = getStateStore();
  const id = holderId ?? getHolderId();
  const useLock = process.env.POLL_LOCK_ENABLED !== "false" && getStoreType() === "redis";

  if (!useLock) {
    return "acquired";
  }

  try {
    const acquired = await store.tryAcquireLeaderLock(POLL_LOCK_KEY, id, POLL_LOCK_TTL_SECONDS);
    if (acquired) {
      incrementCounter(COUNTER_NAMES.POLL_LOCK_ACQUIRED_TOTAL);
      logInfo("[POLL_LOCK] Acquired leader lock", { holderId: id });
      return "acquired";
    }
    incrementCounter(COUNTER_NAMES.POLL_LOCK_FAILED_TOTAL);
    return "denied";
  } catch (error) {
    incrementCounter(COUNTER_NAMES.POLL_LOCK_FAILED_TOTAL);
    logError("[POLL_LOCK] Infrastructure error while acquiring lock", {
      holderId: id,
      error: serializeError(error),
    });
    return "error";
  }
}

/**
 * Extend the poll lock TTL (call after each successful poll cycle).
 * Only RedisStore supports extend; others re-acquire.
 */
export async function extendPollLock(holderId: string): Promise<boolean> {
  const store = getStateStore();
  const useLock = process.env.POLL_LOCK_ENABLED !== "false" && getStoreType() === "redis";
  if (!useLock) return true;

  const redisStore = store as { extendLeaderLock?: (k: string, v: string, t: number) => Promise<boolean> };
  if (typeof redisStore.extendLeaderLock === "function") {
    const ok = await redisStore.extendLeaderLock(POLL_LOCK_KEY, holderId, POLL_LOCK_TTL_SECONDS);
    if (!ok) logWarn("[POLL_LOCK] Failed to extend lock");
    return ok;
  }
  return store.tryAcquireLeaderLock(POLL_LOCK_KEY, holderId, POLL_LOCK_TTL_SECONDS);
}

/**
 * Release the poll lock (call on graceful shutdown).
 */
export async function releasePollLock(holderId: string): Promise<boolean> {
  const store = getStateStore();
  const useLock = process.env.POLL_LOCK_ENABLED !== "false" && getStoreType() === "redis";
  if (!useLock) return true;

  return store.releaseLeaderLock(POLL_LOCK_KEY, holderId);
}

export { POLL_LOCK_RETRY_MS };
