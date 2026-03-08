/**
 * Redis StateStore Adapter
 *
 * Production implementation using Redis.
 * Suitable for multi-worker deployments.
 */

import type { StateStore, EventTracking, CursorState } from "./stateStore.js";
import { logInfo, logError, logWarn } from "../ops/logger.js";

// Redis client type (we'll use dynamic import)
type RedisClient = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, options?: { ex?: number; nx?: boolean }) => Promise<string | null>;
  del: (key: string) => Promise<number>;
  incrby: (key: string, increment: number) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  ping: () => Promise<string>;
  quit: () => Promise<void>;
};

const KEY_PREFIX = "gorky:";
const EVENT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const PUBLISHED_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export class RedisStateStore implements StateStore {
  private client: RedisClient | null = null;
  private connected = false;

  constructor() {
    // Lazy connection
  }

  private async getClient(): Promise<RedisClient> {
    if (this.client) return this.client;
    
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("REDIS_URL not configured");
    }
    
    try {
      // Dynamic import to avoid dependency if not using Redis
      // @ts-ignore - redis is optional dependency
      const { createClient } = await import("redis");
      this.client = createClient({ url: redisUrl }) as RedisClient;
      
      // Wait for connection
      await this.client.ping();
      this.connected = true;
      
      logInfo("[RedisStore] Connected to Redis");
      return this.client;
    } catch (error) {
      logError("[RedisStore] Failed to connect", { error });
      throw error;
    }
  }

  private key(name: string): string {
    return `${KEY_PREFIX}${name}`;
  }

  async getEventState(eventId: string): Promise<EventTracking | null> {
    try {
      const client = await this.getClient();
      const data = await client.get(this.key(`event:${eventId}`));
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logError("[RedisStore] getEventState failed", { eventId, error });
      return null;
    }
  }

  async setEventState(eventId: string, state: EventTracking): Promise<void> {
    try {
      const client = await this.getClient();
      await client.set(
        this.key(`event:${eventId}`),
        JSON.stringify(state),
        { ex: EVENT_TTL_SECONDS }
      );
    } catch (error) {
      logError("[RedisStore] setEventState failed", { eventId, error });
    }
  }

  async deleteEventState(eventId: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.del(this.key(`event:${eventId}`));
    } catch (error) {
      logError("[RedisStore] deleteEventState failed", { eventId, error });
    }
  }

  async acquirePublishLock(eventId: string, ttlMs: number): Promise<boolean> {
    try {
      const client = await this.getClient();
      const key = this.key(`lock:publish:${eventId}`);
      
      // Use NX (only if not exists) for atomic lock acquisition
      const result = await client.set(key, Date.now().toString(), {
        nx: true,
        ex: Math.ceil(ttlMs / 1000),
      });
      
      return result === "OK";
    } catch (error) {
      logError("[RedisStore] acquirePublishLock failed", { eventId, error });
      return false;
    }
  }

  async releasePublishLock(eventId: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.del(this.key(`lock:publish:${eventId}`));
    } catch (error) {
      logError("[RedisStore] releasePublishLock failed", { eventId, error });
    }
  }

  async isPublished(eventId: string): Promise<{ published: boolean; tweetId?: string }> {
    try {
      const client = await this.getClient();
      const data = await client.get(this.key(`published:${eventId}`));
      
      if (data) {
        return { published: true, tweetId: data };
      }
      
      return { published: false };
    } catch (error) {
      logError("[RedisStore] isPublished failed", { eventId, error });
      return { published: false };
    }
  }

  async markPublished(eventId: string, tweetId: string, ttlMs: number): Promise<void> {
    try {
      const client = await this.getClient();
      await client.set(
        this.key(`published:${eventId}`),
        tweetId,
        { ex: Math.ceil(ttlMs / 1000) }
      );
      
      logInfo("[RedisStore] Marked published", { eventId, tweetId });
    } catch (error) {
      logError("[RedisStore] markPublished failed", { eventId, error });
    }
  }

  async getBudgetUsage(windowStartMs: number): Promise<number> {
    try {
      const client = await this.getClient();
      const key = this.key(`budget:${windowStartMs}`);
      const data = await client.get(key);
      
      return data ? parseInt(data, 10) : 0;
    } catch (error) {
      logError("[RedisStore] getBudgetUsage failed", { error });
      return 0;
    }
  }

  async incrementBudgetUsage(weight: number, ttlMs: number): Promise<void> {
    try {
      const client = await this.getClient();
      const windowStart = Math.floor(Date.now() / ttlMs) * ttlMs;
      const key = this.key(`budget:${windowStart}`);
      
      const newValue = await client.incrby(key, weight);
      
      // Set expiry on first increment
      if (newValue === weight) {
        await client.expire(key, Math.ceil(ttlMs / 1000) + 60); // +60s buffer
      }
    } catch (error) {
      logError("[RedisStore] incrementBudgetUsage failed", { error });
    }
  }

  async resetBudget(): Promise<void> {
    // Redis budget is window-based, no manual reset needed
    logInfo("[RedisStore] Budget reset (no-op for Redis)");
  }

  async getCursor(): Promise<CursorState | null> {
    try {
      const client = await this.getClient();
      const data = await client.get(this.key("cursor"));
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logError("[RedisStore] getCursor failed", { error });
      return null;
    }
  }

  async setCursor(cursor: CursorState): Promise<void> {
    try {
      const client = await this.getClient();
      await client.set(
        this.key("cursor"),
        JSON.stringify(cursor),
        { ex: 30 * 24 * 60 * 60 } // 30 days
      );
    } catch (error) {
      logError("[RedisStore] setCursor failed", { error });
    }
  }

  async ping(): Promise<boolean> {
    try {
      const client = await this.getClient();
      const result = await client.ping();
      return result === "PONG";
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.connected = false;
      logInfo("[RedisStore] Connection closed");
    }
  }
}

// Singleton instance
let instance: RedisStateStore | null = null;

export function getRedisStore(): RedisStateStore {
  if (!instance) {
    instance = new RedisStateStore();
  }
  return instance;
}
