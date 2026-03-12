import Redis from "ioredis";
import type { StateStore, EventTracking, CursorState } from "./stateStore.js";
import { logInfo, logError, logWarn } from "../ops/logger.js";
import { incrementCounter } from "../observability/metrics.js";
import { COUNTER_NAMES } from "../observability/metricTypes.js";

const EVENT_TTL_SECONDS = 7 * 24 * 60 * 60;
const PUBLISHED_TTL_SECONDS = 30 * 24 * 60 * 60;

function normalizeRedisUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed.startsWith("redis://")) {
    throw new Error(
      `Redis URL must use redis:// protocol. ` +
      `Use Upstash "Node.js/ioredis" connection string. ` +
      `Got: ${maskUrl(trimmed)}`
    );
  }
  return trimmed;
}

export class RedisStateStore implements StateStore {
  private redis: Redis;
  private keyPrefix: string;

  constructor(url: string) {
    const normalizedUrl = normalizeRedisUrl(url);
    this.keyPrefix = process.env.REDIS_KEY_PREFIX ?? "gorkypf:";

    this.redis = new Redis(normalizedUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    this.redis.on("error", (err) => {
      logError("[RedisStore] Connection error", { error: err.message });
    });

    this.redis.on("connect", () => {
      logInfo("[RedisStore] Connected successfully");
    });

    this.redis.on("reconnecting", () => {
      logWarn("[RedisStore] Reconnecting...");
    });
  }

  private key(name: string): string {
    return `${this.keyPrefix}${name}`;
  }

  // ── Simple KV primitives ──────────────────────────────────────────────

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(this.key(key));
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] get failed", { key, error });
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.redis.set(this.key(key), value, "EX", ttl);
      } else {
        await this.redis.set(this.key(key), value);
      }
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] set failed", { key, error });
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      return (await this.redis.exists(this.key(key))) === 1;
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] exists failed", { key, error });
      return false;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(this.key(key));
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] del failed", { key, error });
    }
  }

  async incr(key: string): Promise<number> {
    try {
      return await this.redis.incr(this.key(key));
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] incr failed", { key, error });
      return 0;
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.redis.expire(this.key(key), seconds);
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] expire failed", { key, error });
    }
  }

  /** Redis list: LPUSH (für audit tail) */
  async lpush(key: string, ...values: string[]): Promise<number> {
    try {
      return await this.redis.lpush(this.key(key), ...values);
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] lpush failed", { key, error });
      return 0;
    }
  }

  /** Redis list: LTRIM (Tail-Cleanup, behalte letzten Bereich) */
  async ltrim(key: string, start: number, stop: number): Promise<void> {
    try {
      await this.redis.ltrim(this.key(key), start, stop);
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] ltrim failed", { key, error });
    }
  }

  /** Redis list: LRANGE */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.redis.lrange(this.key(key), start, stop);
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] lrange failed", { key, error });
      return [];
    }
  }

  // ── Event State ───────────────────────────────────────────────────────

  async getEventState(eventId: string): Promise<EventTracking | null> {
    try {
      const data = await this.redis.get(this.key(`event:${eventId}`));
      return data ? JSON.parse(data) : null;
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] getEventState failed", { eventId, error });
      return null;
    }
  }

  async setEventState(eventId: string, state: EventTracking): Promise<void> {
    try {
      await this.redis.set(
        this.key(`event:${eventId}`),
        JSON.stringify(state),
        "EX",
        EVENT_TTL_SECONDS,
      );
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] setEventState failed", { eventId, error });
    }
  }

  async deleteEventState(eventId: string): Promise<void> {
    try {
      await this.redis.del(this.key(`event:${eventId}`));
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] deleteEventState failed", { eventId, error });
    }
  }

  // ── Publish Lock ──────────────────────────────────────────────────────

  async acquirePublishLock(eventId: string, ttlMs: number): Promise<boolean> {
    try {
      const key = this.key(`lock:publish:${eventId}`);
      const result = await this.redis.set(
        key,
        Date.now().toString(),
        "PX",
        ttlMs,
        "NX",
      );
      return result === "OK";
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] acquirePublishLock failed", { eventId, error });
      return false;
    }
  }

  async releasePublishLock(eventId: string): Promise<void> {
    try {
      await this.redis.del(this.key(`lock:publish:${eventId}`));
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] releasePublishLock failed", { eventId, error });
    }
  }

  async isPublished(eventId: string): Promise<{ published: boolean; tweetId?: string }> {
    try {
      const data = await this.redis.get(this.key(`published:${eventId}`));
      if (data) return { published: true, tweetId: data };
      return { published: false };
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] isPublished failed", { eventId, error });
      return { published: false };
    }
  }

  async markPublished(eventId: string, tweetId: string, ttlMs: number): Promise<void> {
    try {
      await this.redis.set(
        this.key(`published:${eventId}`),
        tweetId,
        "EX",
        Math.ceil(ttlMs / 1000),
      );
      logInfo("[RedisStore] Marked published", { eventId, tweetId });
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] markPublished failed", { eventId, error });
    }
  }

  // ── Budget ────────────────────────────────────────────────────────────

  async getBudgetUsage(windowStartMs: number): Promise<number> {
    try {
      const data = await this.redis.get(this.key(`budget:${windowStartMs}`));
      return data ? parseInt(data, 10) : 0;
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] getBudgetUsage failed", { error });
      return 0;
    }
  }

  async incrementBudgetUsage(weight: number, ttlMs: number): Promise<void> {
    try {
      const windowStart = Math.floor(Date.now() / ttlMs) * ttlMs;
      const key = this.key(`budget:${windowStart}`);
      const newValue = await this.redis.incrby(key, weight);
      if (newValue === weight) {
        await this.redis.expire(key, Math.ceil(ttlMs / 1000) + 60);
      }
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] incrementBudgetUsage failed", { error });
    }
  }

  async resetBudget(ttlMs: number = 60000): Promise<void> {
    try {
      const windowStart = Math.floor(Date.now() / ttlMs) * ttlMs;
      const key = this.key(`budget:${windowStart}`);
      await this.redis.del(key);
      logInfo("[RedisStore] Budget reset", { windowStart });
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] resetBudget failed", { error });
      throw error;
    }
  }

  // ── Cursor ────────────────────────────────────────────────────────────

  async getCursor(): Promise<CursorState | null> {
    try {
      const data = await this.redis.get(this.key("cursor"));
      return data ? JSON.parse(data) : null;
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] getCursor failed", { error });
      return null;
    }
  }

  async setCursor(cursor: CursorState): Promise<void> {
    try {
      await this.redis.set(
        this.key("cursor"),
        JSON.stringify(cursor),
        "EX",
        30 * 24 * 60 * 60,
      );
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] setCursor failed", { error });
    }
  }

  // ── Leader Lock (Single-Worker / Poll Lock) ──────────────────────────────

  async tryAcquireLeaderLock(lockKey: string, holderId: string, ttlSeconds: number): Promise<boolean> {
    try {
      const key = this.key(lockKey);
      const result = await this.redis.set(key, holderId, "EX", ttlSeconds, "NX");
      return result === "OK";
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] tryAcquireLeaderLock failed", { lockKey, error });
      return false;
    }
  }

  async releaseLeaderLock(lockKey: string, holderId: string): Promise<boolean> {
    try {
      const key = this.key(lockKey);
      const script = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
      const result = await this.redis.eval(script, 1, key, holderId);
      return result === 1;
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] releaseLeaderLock failed", { lockKey, error });
      return false;
    }
  }

  /** Extend lock TTL if we still hold it (for leader heartbeat). */
  async extendLeaderLock(lockKey: string, holderId: string, ttlSeconds: number): Promise<boolean> {
    try {
      const key = this.key(lockKey);
      const script = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("expire", KEYS[1], ARGV[2]) else return 0 end`;
      const result = await this.redis.eval(script, 1, key, holderId, String(ttlSeconds));
      return result === 1;
    } catch (error) {
      incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
      logError("[RedisStore] extendLeaderLock failed", { lockKey, error });
      return false;
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  async ping(): Promise<boolean> {
    try {
      if (this.redis.status !== "ready") {
        await this.redis.connect();
      }
      const result = await this.redis.ping();
      return result === "PONG";
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    try {
      await this.redis.quit();
      logInfo("[RedisStore] Connection closed");
    } catch (error) {
      logWarn("[RedisStore] Error closing connection", { error });
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
