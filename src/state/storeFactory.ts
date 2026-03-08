/**
 * StateStore Factory
 *
 * Creates the appropriate StateStore based on environment configuration.
 */

import type { StateStore } from "./stateStore.js";
import { getFileSystemStore } from "./fileSystemStore.js";
import { getRedisStore } from "./redisStore.js";
import { logInfo } from "../ops/logger.js";

let cachedStore: StateStore | null = null;

/**
 * Get the configured StateStore instance
 */
export function getStateStore(): StateStore {
  if (cachedStore) return cachedStore;
  
  const useRedis = process.env.USE_REDIS === "true";
  
  if (useRedis) {
    logInfo("[StateStore] Using Redis store");
    cachedStore = getRedisStore();
  } else {
    logInfo("[StateStore] Using FileSystem store");
    cachedStore = getFileSystemStore();
  }
  
  return cachedStore;
}

/**
 * Reset the store cache (useful for testing)
 */
export function resetStoreCache(): void {
  cachedStore = null;
}

/**
 * Check if Redis is available
 */
export async function isRedisAvailable(): Promise<boolean> {
  if (!process.env.REDIS_URL) return false;
  
  try {
    const store = getRedisStore();
    return await store.ping();
  } catch {
    return false;
  }
}
