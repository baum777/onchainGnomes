import Redis from "ioredis";
import type { StateStore, EventTracking, CursorState } from "./stateStore.js";
import { logInfo, logError, logWarn } from "../ops/logger.js";
import { incrementCounter } from "../observability/metrics.js";
import { COUNTER_NAMES } from "../observability/metricTypes.js";
import { serializeError } from "../utils/errorSerialization.js";

const EVENT_TTL_SECONDS = 7 * 24 * 60 * 60;

function normalizeRedisUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed.startsWith("redis://") && !trimmed.startsWith("rediss://")) {
    throw new Error(
      `Redis URL must use redis:// or rediss:// protocol. ` +
      `Use Upstash "Node.js/ioredis" connection string. ` +
      `Got: ${maskUrl(trimmed)}`
    );
  }
  return trimmed;
}

export class RedisStateStore implements StateStore {
  private redis: Redis;
  private keyPrefix: string;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(url: string) {
    const normalizedUrl = normalizeRedisUrl(url);
    const parsed = new URL(normalizedUrl);
    this.keyPrefix = process.env.REDIS_KEY_PREFIX ?? "gorkypf:";

    this.redis = new Redis(normalizedUrl, {
      // Keep requests from failing quickly during transient managed-redis reconnects.
      maxRetriesPerRequest: null,
      retryStrategy(times: number) {
        return Math.min(times * 250, 5_000);
      },
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 15_000,
      ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
    });

    this.redis.on("error", (err) => {
      logError("[RedisStore] Connection error", {
        status: this.redis.status,
        error: serializeError(err),
      });
    });

    this.redis.on("connect", () => {
      logInfo("[RedisStore] Connected", { status: this.redis.status });
    });

    this.redis.on("ready", () => {
      logInfo("[RedisStore] Ready", { status: this.redis.status });
    });

    this.redis.on("reconnecting", (delay: number) => {
      logWarn("[RedisStore] Reconnecting", { status: this.redis.status, delayMs: delay });
    });

    this.redis.on("end", () => {
      this.initialized = false;
      logWarn("[RedisStore] Connection ended", { status: this.redis.status });
    });
  }

  async init(): Promise<void> {
    if (this.initialized && this.redis.status === "ready") return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        if (this.redis.status === "wait") {
          await this.redis.connect();
        }
        const pong = await this.redis.ping();
        if (pong !== "PONG") {
          throw new Error(`Unexpected redis ping response: ${pong}`);
        }
        this.initialized = true;
        logInfo("[RedisStore] Initialization complete", { status: this.redis.status });
      } catch (error) {
        this.initialized = false;
        logError("[RedisStore] Initialization failed", {
          status: this.redis.status,
          error: serializeError(error),
        });
        throw error;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  private async ensureReady(operation: string): Promise<void> {
    try {
      await this.init();
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError(`[RedisStore] ${operation} blocked: redis not ready`, {
        status: this.redis.status,
        error: serializeError(error),
      });
      throw error;
    }
  }

  private key(name: string): string {
    return `${this.keyPrefix}${name}`;
  }

  async get(key: string): Promise<string | null> {
    try {
      await this.ensureReady("get");
      return await this.redis.get(this.key(key));
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] get failed", { key, error: serializeError(error) });
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      await this.ensureReady("set");
      if (ttl) {
        await this.redis.set(this.key(key), value, "EX", ttl);
      } else {
        await this.redis.set(this.key(key), value);
      }
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] set failed", { key, error: serializeError(error) });
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.ensureReady("exists");
      return (await this.redis.exists(this.key(key))) === 1;
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] exists failed", { key, error: serializeError(error) });
      return false;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.ensureReady("del");
      await this.redis.del(this.key(key));
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] del failed", { key, error: serializeError(error) });
    }
  }

  async incr(key: string): Promise<number> {
    try {
      await this.ensureReady("incr");
      return await this.redis.incr(this.key(key));
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] incr failed", { key, error: serializeError(error) });
      return 0;
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.ensureReady("expire");
      await this.redis.expire(this.key(key), seconds);
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] expire failed", { key, error: serializeError(error) });
    }
  }

  async lpush(key: string, ...values: string[]): Promise<number> {
    try {
      await this.ensureReady("lpush");
      return await this.redis.lpush(this.key(key), ...values);
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] lpush failed", { key, error: serializeError(error) });
      return 0;
    }
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    try {
      await this.ensureReady("ltrim");
      await this.redis.ltrim(this.key(key), start, stop);
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] ltrim failed", { key, error: serializeError(error) });
    }
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      await this.ensureReady("lrange");
      return await this.redis.lrange(this.key(key), start, stop);
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] lrange failed", { key, error: serializeError(error) });
      return [];
    }
  }

  async getEventState(eventId: string): Promise<EventTracking | null> {
    try {
      await this.ensureReady("getEventState");
      const data = await this.redis.get(this.key(`event:${eventId}`));
      return data ? JSON.parse(data) : null;
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] getEventState failed", { eventId, error: serializeError(error) });
      return null;
    }
  }

  async setEventState(eventId: string, state: EventTracking): Promise<void> {
    try {
      await this.ensureReady("setEventState");
      await this.redis.set(this.key(`event:${eventId}`), JSON.stringify(state), "EX", EVENT_TTL_SECONDS);
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] setEventState failed", { eventId, error: serializeError(error) });
    }
  }

  async deleteEventState(eventId: string): Promise<void> {
    try {
      await this.ensureReady("deleteEventState");
      await this.redis.del(this.key(`event:${eventId}`));
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] deleteEventState failed", { eventId, error: serializeError(error) });
    }
  }

  async acquirePublishLock(eventId: string, ttlMs: number): Promise<boolean> {
    try {
      await this.ensureReady("acquirePublishLock");
      const key = this.key(`lock:publish:${eventId}`);
      const result = await this.redis.set(key, Date.now().toString(), "PX", ttlMs, "NX");
      return result === "OK";
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] acquirePublishLock failed", { eventId, error: serializeError(error) });
      return false;
    }
  }

  async releasePublishLock(eventId: string): Promise<void> {
    try {
      await this.ensureReady("releasePublishLock");
      await this.redis.del(this.key(`lock:publish:${eventId}`));
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] releasePublishLock failed", { eventId, error: serializeError(error) });
    }
  }

  async isPublished(eventId: string): Promise<{ published: boolean; tweetId?: string }> {
    try {
      await this.ensureReady("isPublished");
      const data = await this.redis.get(this.key(`published:${eventId}`));
      if (data) return { published: true, tweetId: data };
      return { published: false };
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] isPublished failed", { eventId, error: serializeError(error) });
      return { published: false };
    }
  }

  async markPublished(eventId: string, tweetId: string, ttlMs: number): Promise<void> {
    try {
      await this.ensureReady("markPublished");
      await this.redis.set(this.key(`published:${eventId}`), tweetId, "EX", Math.ceil(ttlMs / 1000));
      logInfo("[RedisStore] Marked published", { eventId, tweetId });
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] markPublished failed", { eventId, error: serializeError(error) });
    }
  }

  async getBudgetUsage(windowStartMs: number): Promise<number> {
    try {
      await this.ensureReady("getBudgetUsage");
      const data = await this.redis.get(this.key(`budget:${windowStartMs}`));
      return data ? parseInt(data, 10) : 0;
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] getBudgetUsage failed", { error: serializeError(error) });
      return 0;
    }
  }

  async incrementBudgetUsage(weight: number, ttlMs: number): Promise<void> {
    try {
      await this.ensureReady("incrementBudgetUsage");
      const windowStart = Math.floor(Date.now() / ttlMs) * ttlMs;
      const key = this.key(`budget:${windowStart}`);
      const newValue = await this.redis.incrby(key, weight);
      if (newValue === weight) {
        await this.redis.expire(key, Math.ceil(ttlMs / 1000) + 60);
      }
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] incrementBudgetUsage failed", { error: serializeError(error) });
    }
  }

  async resetBudget(ttlMs: number = 60000): Promise<void> {
    try {
      await this.ensureReady("resetBudget");
      const windowStart = Math.floor(Date.now() / ttlMs) * ttlMs;
      const key = this.key(`budget:${windowStart}`);
      await this.redis.del(key);
      logInfo("[RedisStore] Budget reset", { windowStart });
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] resetBudget failed", { error: serializeError(error) });
      throw error;
    }
  }

  async getCursor(): Promise<CursorState | null> {
    try {
      await this.ensureReady("getCursor");
      const data = await this.redis.get(this.key("cursor"));
      return data ? JSON.parse(data) : null;
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] getCursor failed", { error: serializeError(error) });
      return null;
    }
  }

  async setCursor(cursor: CursorState): Promise<void> {
    try {
      await this.ensureReady("setCursor");
      await this.redis.set(this.key("cursor"), JSON.stringify(cursor), "EX", 30 * 24 * 60 * 60);
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] setCursor failed", { error: serializeError(error) });
    }
  }

  async tryAcquireLeaderLock(lockKey: string, holderId: string, ttlSeconds: number): Promise<boolean> {
    try {
      await this.ensureReady("tryAcquireLeaderLock");
      const key = this.key(lockKey);
      const result = await this.redis.set(key, holderId, "EX", ttlSeconds, "NX");
      return result === "OK";
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] tryAcquireLeaderLock failed", {
        lockKey,
        error: serializeError(error),
      });
      throw error;
    }
  }

  async releaseLeaderLock(lockKey: string, holderId: string): Promise<boolean> {
    try {
      await this.ensureReady("releaseLeaderLock");
      const key = this.key(lockKey);
      const script = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
      const result = await this.redis.eval(script, 1, key, holderId);
      return result === 1;
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] releaseLeaderLock failed", { lockKey, error: serializeError(error) });
      return false;
    }
  }

  async extendLeaderLock(lockKey: string, holderId: string, ttlSeconds: number): Promise<boolean> {
    try {
      await this.ensureReady("extendLeaderLock");
      const key = this.key(lockKey);
      const script = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("expire", KEYS[1], ARGV[2]) else return 0 end`;
      const result = await this.redis.eval(script, 1, key, holderId, String(ttlSeconds));
      return result === 1;
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] extendLeaderLock failed", { lockKey, error: serializeError(error) });
      return false;
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.ensureReady("ping");
      const result = await this.redis.ping();
      return result === "PONG";
    } catch (error) {
      logWarn("[RedisStore] ping failed", { error: serializeError(error) });
      return false;
    }
  }

  async close(): Promise<void> {
    try {
      await this.redis.quit();
      this.initialized = false;
      logInfo("[RedisStore] Connection closed");
    } catch (error) {
      logWarn("[RedisStore] Error closing connection", { error: serializeError(error) });
    }
  }
}

let instance: RedisStateStore | null = null;

export function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    if (u.username) u.username = "***";
    return u.toString();
  } catch {
    return "[invalid-url]";
  }
}

export function getRedisStore(url?: string): RedisStateStore {
  if (!instance) {
    const redisUrl = url ?? process.env.KV_URL ?? process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("KV_URL (or REDIS_URL) not configured");
    }
    logInfo("[RedisStore] Creating RedisStateStore", {
      host: maskUrl(redisUrl),
      prefix: process.env.REDIS_KEY_PREFIX ?? "gorkypf:",
    });
    instance = new RedisStateStore(redisUrl);
  }
  return instance;
}

export function resetRedisInstance(): void {
  instance = null;
}
