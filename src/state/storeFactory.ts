import type { StateStore } from "./stateStore.js";
import { getFileSystemStore, FileSystemStateStore, resetFileSystemInstance } from "./fileSystemStore.js";
import { getRedisStore, maskUrl, RedisStateStore, resetRedisInstance } from "./redisStore.js";
import { logInfo } from "../ops/logger.js";

let cachedStore: StateStore | null = null;

export function getStateStore(): StateStore {
  if (cachedStore) return cachedStore;

  // Redis wird jetzt DEFAULT für Production (verhindert Race Conditions + State-Verlust)
  const useRedis = process.env.USE_REDIS !== "false" &&
                   (process.env.USE_REDIS === "true" ||
                    process.env.NODE_ENV === "production");

  const kvUrl = process.env.KV_URL?.trim();

  if (useRedis) {
    if (!kvUrl) {
      throw new Error(
        "USE_REDIS=true oder Production-Umgebung erkannt, aber KV_URL fehlt. " +
        "Setze KV_URL=redis://... für stabile Persistenz."
      );
    }

    if (!kvUrl.startsWith("redis://") && !kvUrl.startsWith("rediss://")) {
      throw new Error(
        "KV_URL muss redis:// protocol nutzen. " +
        "Erlaubt sind redis:// oder rediss://; Upstash REST URLs (https://) sind im Redis TCP-Modus nicht unterstützt. " +
        `Received: ${maskUrl(kvUrl)}`
      );
    }

    logInfo("[StateStore] ✅ Redis Backend aktiv (Production Default)", {
      prefix: process.env.REDIS_KEY_PREFIX ?? "gorkypf:",
    });
    cachedStore = getRedisStore(kvUrl);
  } else {
    const dataDir = process.env.DATA_DIR?.trim();
    logInfo("[StateStore] 📁 FileSystem Backend (nur für lokale Tests)", {
      dataDir: dataDir ?? "./data",
    });
    cachedStore = getFileSystemStore(dataDir || undefined);
  }

  return cachedStore;
}


export async function initializeStateStore(): Promise<StateStore> {
  const store = getStateStore();
  if (store instanceof RedisStateStore) {
    await store.init();
  }
  return store;
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
