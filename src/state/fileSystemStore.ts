/**
 * FileSystem StateStore Adapter
 *
 * Default implementation using local filesystem.
 * Suitable for single-worker deployments.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { StateStore, EventTracking, CursorState } from "./stateStore.js";
import { logInfo, logError } from "../ops/logger.js";

const DATA_DIR = join(process.cwd(), "data");
const EVENT_STATE_FILE = join(DATA_DIR, "event_state.json");
const CURSOR_FILE = join(DATA_DIR, "cursor_state.json");
const PUBLISHED_FILE = join(DATA_DIR, "published.json");
const BUDGET_FILE = join(DATA_DIR, "budget.json");

// In-memory cache for performance
const eventCache = new Map<string, EventTracking>();
const publishedCache = new Map<string, string>(); // eventId -> tweetId
let budgetCache: { used: number; windowStart: number } | null = null;

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadJson<T>(file: string, defaultValue: T): T {
  try {
    if (!existsSync(file)) return defaultValue;
    return JSON.parse(readFileSync(file, "utf-8"));
  } catch {
    return defaultValue;
  }
}

function saveJson(file: string, data: unknown): void {
  try {
    ensureDir();
    writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    logError("[FileSystemStore] Failed to save", { file, error });
  }
}

export class FileSystemStateStore implements StateStore {
  async getEventState(eventId: string): Promise<EventTracking | null> {
    // Check cache first
    const cached = eventCache.get(eventId);
    if (cached) return cached;
    
    // Load from file
    const all = loadJson<Record<string, EventTracking>>(EVENT_STATE_FILE, {});
    const state = all[eventId] || null;
    
    if (state) {
      eventCache.set(eventId, state);
    }
    
    return state;
  }

  async setEventState(eventId: string, state: EventTracking): Promise<void> {
    // Update cache
    eventCache.set(eventId, state);
    
    // Persist to file
    const all = loadJson<Record<string, EventTracking>>(EVENT_STATE_FILE, {});
    all[eventId] = state;
    saveJson(EVENT_STATE_FILE, all);
  }

  async deleteEventState(eventId: string): Promise<void> {
    eventCache.delete(eventId);
    const all = loadJson<Record<string, EventTracking>>(EVENT_STATE_FILE, {});
    delete all[eventId];
    saveJson(EVENT_STATE_FILE, all);
  }

  async acquirePublishLock(eventId: string, ttlMs: number): Promise<boolean> {
    // FileSystem implementation: use a simple lock file
    const lockFile = join(DATA_DIR, `lock_${eventId}.lock`);
    
    try {
      if (existsSync(lockFile)) {
        const lock = loadJson<{ acquiredAt: number }>(lockFile, { acquiredAt: 0 });
        if (Date.now() - lock.acquiredAt < ttlMs) {
          return false; // Lock still valid
        }
      }
      
      saveJson(lockFile, { acquiredAt: Date.now() });
      return true;
    } catch {
      return false;
    }
  }

  async releasePublishLock(eventId: string): Promise<void> {
    const lockFile = join(DATA_DIR, `lock_${eventId}.lock`);
    try {
      if (existsSync(lockFile)) {
        const { unlinkSync } = await import("node:fs");
        unlinkSync(lockFile);
      }
    } catch {
      // Ignore errors
    }
  }

  async isPublished(eventId: string): Promise<{ published: boolean; tweetId?: string }> {
    // Check cache
    const cachedTweetId = publishedCache.get(eventId);
    if (cachedTweetId) {
      return { published: true, tweetId: cachedTweetId };
    }
    
    // Check file
    const all = loadJson<Record<string, string>>(PUBLISHED_FILE, {});
    const tweetId = all[eventId];
    
    if (tweetId) {
      publishedCache.set(eventId, tweetId);
      return { published: true, tweetId };
    }
    
    return { published: false };
  }

  async markPublished(eventId: string, tweetId: string, ttlMs: number): Promise<void> {
    // Update cache
    publishedCache.set(eventId, tweetId);
    
    // Persist
    const all = loadJson<Record<string, string>>(PUBLISHED_FILE, {});
    all[eventId] = tweetId;
    saveJson(PUBLISHED_FILE, all);
    
    logInfo("[FileSystemStore] Marked published", { eventId, tweetId });
  }

  async getBudgetUsage(windowStartMs: number): Promise<number> {
    // Check if cache is still valid
    if (budgetCache && budgetCache.windowStart === windowStartMs) {
      return budgetCache.used;
    }
    
    // Load from file
    const data = loadJson<{ used: number; windowStart: number }>(BUDGET_FILE, { used: 0, windowStart: 0 });
    
    if (data.windowStart === windowStartMs) {
      budgetCache = data;
      return data.used;
    }
    
    // Window expired, reset
    return 0;
  }

  async incrementBudgetUsage(weight: number, ttlMs: number): Promise<void> {
    const windowStart = Math.floor(Date.now() / ttlMs) * ttlMs;
    const current = await this.getBudgetUsage(windowStart);
    
    budgetCache = { used: current + weight, windowStart };
    saveJson(BUDGET_FILE, budgetCache);
  }

  async resetBudget(): Promise<void> {
    budgetCache = null;
    const windowStart = Date.now();
    saveJson(BUDGET_FILE, { used: 0, windowStart });
  }

  async getCursor(): Promise<CursorState | null> {
    return loadJson<CursorState | null>(CURSOR_FILE, null);
  }

  async setCursor(cursor: CursorState): Promise<void> {
    saveJson(CURSOR_FILE, cursor);
  }

  async ping(): Promise<boolean> {
    try {
      ensureDir();
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    // Nothing to close for filesystem
  }
}

// Singleton instance
let instance: FileSystemStateStore | null = null;

export function getFileSystemStore(): FileSystemStateStore {
  if (!instance) {
    instance = new FileSystemStateStore();
  }
  return instance;
}
