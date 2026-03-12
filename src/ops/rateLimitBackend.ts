/**
 * Rate Limit Backend — abstraction for rate limit state storage.
 *
 * - memory: in-process only (single worker, dev)
 * - store: StateStore (Redis/FileSystem) — shared across workers, production
 *
 * Env: RATE_LIMIT_BACKEND=memory|store
 * Default: store when USE_REDIS=true, else memory
 */

import { cacheGet, cacheSet } from "./memoryCache.js";
import { getStateStore } from "../state/storeFactory.js";

export type RateLimitBackend = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
};

const memoryBackend: RateLimitBackend = {
  async get(key: string) {
    return cacheGet(key);
  },
  async set(key: string, value: string, ttlSeconds: number) {
    await cacheSet(key, value, ttlSeconds);
  },
};

function createStoreBackend(): RateLimitBackend {
  return {
    async get(key: string) {
      const store = getStateStore();
      return store.get(key);
    },
    async set(key: string, value: string, ttlSeconds: number) {
      const store = getStateStore();
      await store.set(key, value, ttlSeconds);
    },
  };
}

let cachedStoreBackend: RateLimitBackend | null = null;

function getBackend(): RateLimitBackend {
  const explicit = process.env.RATE_LIMIT_BACKEND?.toLowerCase();
  const useRedis = process.env.USE_REDIS === "true" || process.env.NODE_ENV === "production";

  if (explicit === "memory") return memoryBackend;
  if (explicit === "store") {
    if (!cachedStoreBackend) cachedStoreBackend = createStoreBackend();
    return cachedStoreBackend;
  }

  if (useRedis) {
    if (!cachedStoreBackend) cachedStoreBackend = createStoreBackend();
    return cachedStoreBackend;
  }
  return memoryBackend;
}

/** Get the active rate limit backend. Used by rateLimiter. */
export function getRateLimitBackend(): RateLimitBackend {
  return getBackend();
}
