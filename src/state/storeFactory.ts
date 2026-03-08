import type { StateStore } from "./stateStore.js";
import { getFileSystemStore } from "./fileSystemStore.js";
import { getRedisStore } from "./redisStore.js";
import { logInfo } from "../ops/logger.js";

let cachedStore: StateStore | null = null;

export function getStateStore(): StateStore {
  if (cachedStore) return cachedStore;

  const kvUrl = process.env.KV_URL ?? process.env.REDIS_URL;

  if (kvUrl) {
    logInfo("[StateStore] Using Redis store (KV_URL detected)");
    cachedStore = getRedisStore(kvUrl);
  } else {
    logInfo("[StateStore] Using FileSystem store (no KV_URL)");
    cachedStore = getFileSystemStore();
  }

  return cachedStore;
}

export function resetStoreCache(): void {
  cachedStore = null;
}

export async function isRedisAvailable(): Promise<boolean> {
  const kvUrl = process.env.KV_URL ?? process.env.REDIS_URL;
  if (!kvUrl) return false;

  try {
    const store = getRedisStore(kvUrl);
    return await store.ping();
  } catch {
    return false;
  }
}
