import type { StateStore } from "./stateStore.js";
import { getFileSystemStore, FileSystemStateStore, resetFileSystemInstance } from "./fileSystemStore.js";
import { getRedisStore, maskUrl, RedisStateStore, resetRedisInstance } from "./redisStore.js";
import { logInfo } from "../ops/logger.js";

let cachedStore: StateStore | null = null;

export function getStateStore(): StateStore {
  if (cachedStore) return cachedStore;

  const useRedis = process.env.USE_REDIS === "true";
  const kvUrl = process.env.KV_URL?.trim();

  if (useRedis) {
    if (!kvUrl) {
      throw new Error(
        "USE_REDIS=true but KV_URL is not configured. " +
        "Set KV_URL=redis://... or disable Redis."
      );
    }

    if (!kvUrl.startsWith("redis://")) {
      throw new Error(
        "KV_URL must use redis:// protocol. " +
        "Upstash REST URLs (https://) are not supported with ioredis. " +
        `Got: ${maskUrl(kvUrl)}`
      );
    }

    logInfo("[StateStore] Using Redis store", {
      prefix: process.env.REDIS_KEY_PREFIX ?? "gorkypf:",
    });
    cachedStore = getRedisStore(kvUrl);
  } else {
    logInfo("[StateStore] Using FileSystem store", {
      dataDir: process.env.DATA_DIR ?? "./data",
    });
    cachedStore = getFileSystemStore();
  }

  return cachedStore;
}

export function resetStoreCache(): void {
  cachedStore = null;
  resetFileSystemInstance();
  resetRedisInstance();
}

export async function isRedisAvailable(): Promise<boolean> {
  const useRedis = process.env.USE_REDIS === "true";
  const kvUrl = process.env.KV_URL?.trim();

  if (!useRedis || !kvUrl) return false;

  try {
    const store = getRedisStore(kvUrl);
    return await store.ping();
  } catch {
    return false;
  }
}

export function getStoreType(): "redis" | "filesystem" | "unknown" {
  if (!cachedStore) return "unknown";
  if (cachedStore instanceof RedisStateStore) return "redis";
  if (cachedStore instanceof FileSystemStateStore) return "filesystem";
  return "unknown";
}
