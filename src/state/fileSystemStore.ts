/**
 * FileSystem StateStore Adapter
 *
 * Default implementation using local filesystem.
 * Suitable for single-worker deployments.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { StateStore, EventTracking, CursorState } from "./stateStore.js";
import { logInfo, logError, logWarn } from "../ops/logger.js";
import { incrementCounter } from "../observability/metrics.js";
import { COUNTER_NAMES } from "../observability/metricTypes.js";

import { DATA_DIR } from "../config/dataDir.js";

const DEFAULT_DATA_DIR = DATA_DIR;

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
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

function saveJson(file: string, data: unknown, dir: string): void {
  let tmpFile = "";
  try {
    ensureDir(dir);
    
    // === ATOMIC WRITE – behebt Race Conditions & Korruption ===
    tmpFile = `${file}.tmp.${Date.now()}`;
    writeFileSync(tmpFile, JSON.stringify(data, null, 2), "utf-8");
    renameSync(tmpFile, file); // atomar auf allen OS
    
    logInfo("[FileSystemStore] Atomic write erfolgreich", { file });
  } catch (error) {
    incrementCounter(COUNTER_NAMES.STATE_STORE_ERROR_TOTAL);
    logError("[FileSystemStore] Failed to save", { file, error });
    
    // Cleanup tmp if it was created
    if (tmpFile && existsSync(tmpFile)) {
      try {
        unlinkSync(tmpFile);
      } catch (cleanupError) {
        logWarn("[FileSystemStore] Failed to cleanup tmp file", {
          tmpFile,
          cleanupError,
        });
      }
    }
  }
}

export class FileSystemStateStore implements StateStore {
  private readonly dataDir: string;
  private readonly eventCache = new Map<string, EventTracking>();
  private readonly publishedCache = new Map<string, string>();
  private budgetCache: { used: number; windowStart: number } | null = null;
  private readonly kvCache = new Map<string, { value: string; expiresAt?: number }>();

  constructor(dataDir?: string) {
    this.dataDir = dataDir ?? DEFAULT_DATA_DIR;
  }

  // ── Simple KV primitives (in-memory with TTL for filesystem mode) ─────

  async get(key: string): Promise<string | null> {
    const entry = this.kvCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.kvCache.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    const expiresAt = ttl ? Date.now() + ttl * 1000 : undefined;
    this.kvCache.set(key, { value, expiresAt });
  }

  async exists(key: string): Promise<boolean> {
    const val = await this.get(key);
    return val !== null;
  }

  async del(key: string): Promise<void> {
    this.kvCache.delete(key);
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const next = (current ? parseInt(current, 10) : 0) + 1;
    const entry = this.kvCache.get(key);
    await this.set(key, String(next));
    if (entry?.expiresAt) {
      this.kvCache.set(key, { value: String(next), expiresAt: entry.expiresAt });
    }
    return next;
  }

  async expire(key: string, seconds: number): Promise<void> {
    const entry = this.kvCache.get(key);
    if (entry) {
      entry.expiresAt = Date.now() + seconds * 1000;
    }
  }

  private get eventStateFile(): string {
    return join(this.dataDir, "event_state.json");
  }
  private get cursorFile(): string {
    return join(this.dataDir, "cursor_state.json");
  }
  private get publishedFile(): string {
    return join(this.dataDir, "published.json");
  }
  private get budgetFile(): string {
    return join(this.dataDir, "budget.json");
  }
  private lockFile(eventId: string): string {
    return join(this.dataDir, `lock_${eventId}.lock`);
  }

  async getEventState(eventId: string): Promise<EventTracking | null> {
    const cached = this.eventCache.get(eventId);
    if (cached) return cached;

    const all = loadJson<Record<string, EventTracking>>(this.eventStateFile, {});
    const state = all[eventId] || null;
    if (state) this.eventCache.set(eventId, state);
    return state;
  }

  async setEventState(eventId: string, state: EventTracking): Promise<void> {
    this.eventCache.set(eventId, state);
    const all = loadJson<Record<string, EventTracking>>(this.eventStateFile, {});
    all[eventId] = state;
    saveJson(this.eventStateFile, all, this.dataDir);
  }

  async deleteEventState(eventId: string): Promise<void> {
    this.eventCache.delete(eventId);
    const all = loadJson<Record<string, EventTracking>>(this.eventStateFile, {});
    delete all[eventId];
    saveJson(this.eventStateFile, all, this.dataDir);
  }

  async acquirePublishLock(eventId: string, ttlMs: number): Promise<boolean> {
    const lockFile = this.lockFile(eventId);
    try {
      if (existsSync(lockFile)) {
        const lock = loadJson<{ acquiredAt: number }>(lockFile, { acquiredAt: 0 });
        if (Date.now() - lock.acquiredAt < ttlMs) return false;
      }
      saveJson(lockFile, { acquiredAt: Date.now() }, this.dataDir);
      return true;
    } catch {
      return false;
    }
  }

  async releasePublishLock(eventId: string): Promise<void> {
    const lockFile = this.lockFile(eventId);
    try {
      if (existsSync(lockFile)) {
        const { unlinkSync } = await import("node:fs");
        unlinkSync(lockFile);
      }
    } catch {
      // Ignore
    }
  }

  async isPublished(eventId: string): Promise<{ published: boolean; tweetId?: string }> {
    const cachedTweetId = this.publishedCache.get(eventId);
    if (cachedTweetId) return { published: true, tweetId: cachedTweetId };
    const all = loadJson<Record<string, string>>(this.publishedFile, {});
    const tweetId = all[eventId];
    if (tweetId) {
      this.publishedCache.set(eventId, tweetId);
      return { published: true, tweetId };
    }
    return { published: false };
  }

  async markPublished(eventId: string, tweetId: string, _ttlMs: number): Promise<void> {
    this.publishedCache.set(eventId, tweetId);
    const all = loadJson<Record<string, string>>(this.publishedFile, {});
    all[eventId] = tweetId;
    saveJson(this.publishedFile, all, this.dataDir);
    logInfo("[FileSystemStore] Marked published", { eventId, tweetId });
  }

  async getBudgetUsage(windowStartMs: number): Promise<number> {
    if (this.budgetCache && this.budgetCache.windowStart === windowStartMs) {
      return this.budgetCache.used;
    }
    const data = loadJson<{ used: number; windowStart: number }>(this.budgetFile, { used: 0, windowStart: 0 });
    if (data.windowStart === windowStartMs) {
      this.budgetCache = data;
      return data.used;
    }
    return 0;
  }

  async incrementBudgetUsage(weight: number, ttlMs: number): Promise<void> {
    const windowStart = Math.floor(Date.now() / ttlMs) * ttlMs;
    const current = await this.getBudgetUsage(windowStart);
    this.budgetCache = { used: current + weight, windowStart };
    saveJson(this.budgetFile, this.budgetCache, this.dataDir);
  }

  async resetBudget(): Promise<void> {
    this.budgetCache = null;
    saveJson(this.budgetFile, { used: 0, windowStart: Date.now() }, this.dataDir);
  }

  async getCursor(): Promise<CursorState | null> {
    return loadJson<CursorState | null>(this.cursorFile, null);
  }

  async setCursor(cursor: CursorState): Promise<void> {
    saveJson(this.cursorFile, cursor, this.dataDir);
  }

  async ping(): Promise<boolean> {
    try {
      ensureDir(this.dataDir);
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    // Nothing to close for filesystem
  }
}

let defaultInstance: FileSystemStateStore | null = null;

/**
 * Get FileSystem store. With no arg returns singleton (default data dir).
 * With dataDir returns a new instance (for tests / isolated storage).
 */
export function getFileSystemStore(dataDir?: string): FileSystemStateStore {
  if (dataDir) return new FileSystemStateStore(dataDir);
  if (!defaultInstance) defaultInstance = new FileSystemStateStore();
  return defaultInstance;
}

export function resetFileSystemInstance(): void {
  defaultInstance = null;
}
