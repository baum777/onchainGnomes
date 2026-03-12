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
import { logInfo, logWarn } from "../ops/logger.js";

const POLL_LOCK_KEY = "worker:poll_lock";
const POLL_LOCK_TTL_SECONDS = 120; // 2 minutes — long enough for poll + process cycle
const POLL_LOCK_RETRY_MS = 15_000; // 15s between acquire attempts when not leader

let cachedHolderId: string | null = null;

/** Stable holder ID for this process (reused for extend/release). */
export function getHolderId(): string {
  if (cachedHolderId) return cachedHolderId;
  const pid = process.pid ?? 0;
  const hostname = typeof process.env.HOSTNAME === "string" ? process.env.HOSTNAME : "node";
  cachedHolderId = `${hostname}:${pid}`;
  return cachedHolderId;
}

/**
 * Try to acquire the poll lock. Returns true if this process is now the leader.
 * When Redis: uses distributed SET NX. When FileSystem: process-local (always succeeds if no race).
 */
export async function tryAcquirePollLock(holderId?: string): Promise<boolean> {
  const store = getStateStore();
  const id = holderId ?? getHolderId();
  const useLock = process.env.POLL_LOCK_ENABLED !== "false" && getStoreType() === "redis";

  if (!useLock) {
    return true; // No distributed lock — single worker mode
  }

  try {
    const acquired = await store.tryAcquireLeaderLock(POLL_LOCK_KEY, id, POLL_LOCK_TTL_SECONDS);
    if (acquired) {
      incrementCounter(COUNTER_NAMES.POLL_LOCK_ACQUIRED_TOTAL);
      logInfo("[POLL_LOCK] Acquired leader lock", { holderId: id });
      return true;
    }
    incrementCounter(COUNTER_NAMES.POLL_LOCK_FAILED_TOTAL);
    return false;
  } catch (error) {
    incrementCounter(COUNTER_NAMES.POLL_LOCK_FAILED_TOTAL);
    logWarn("[POLL_LOCK] Failed to acquire lock", { error: (error as Error).message });
    return false;
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
  // Fallback: re-acquire (will fail if someone else has it)
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
