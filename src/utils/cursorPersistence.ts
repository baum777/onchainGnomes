/**
 * Cursor Persistence Manager
 *
 * Ensures no mention gaps and no double-processing by:
 * - Persisting since_id after each successful fetch
 * - Atomic cursor updates
 * - Recovery on worker restart
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { logInfo, logError, logWarn } from "../ops/logger.js";
import { setGauge } from "../observability/metrics.js";
import { GAUGE_NAMES } from "../observability/metricTypes.js";

import { DATA_DIR } from "../config/dataDir.js";

const CURSOR_FILE = join(DATA_DIR, "cursor_state.json");
const CURSOR_BACKUP_FILE = join(DATA_DIR, "cursor_state.json.bak");

interface CursorState {
  since_id: string | null;
  last_fetch_at: string;
  fetched_count: number;
  version: number;
}

const CURRENT_VERSION = 1;

// In-memory cursor cache
let cachedCursor: string | null = null;
let lastPersistedAt = 0;
const PERSISTENCE_INTERVAL_MS = 60_000; // Persist at most every minute

/**
 * Ensure data directory exists
 */
function ensureDataDir(): void {
  const dir = dirname(CURSOR_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Load cursor state from disk
 */
export function loadCursorState(): CursorState {
  try {
    ensureDataDir();
    
    if (!existsSync(CURSOR_FILE)) {
      logInfo("[CURSOR] No persisted cursor found, starting fresh");
      return {
        since_id: null,
        last_fetch_at: new Date(0).toISOString(),
        fetched_count: 0,
        version: CURRENT_VERSION,
      };
    }
    
    const raw = readFileSync(CURSOR_FILE, "utf-8");
    const state = JSON.parse(raw) as CursorState;
    
    // Validate version
    if (state.version !== CURRENT_VERSION) {
      logWarn("[CURSOR] Cursor version mismatch, migrating", {
        oldVersion: state.version,
        newVersion: CURRENT_VERSION,
      });
      state.version = CURRENT_VERSION;
    }
    
    // Update cache
    cachedCursor = state.since_id;
    
    const ageSeconds = (Date.now() - new Date(state.last_fetch_at).getTime()) / 1000;
    setGauge(GAUGE_NAMES.LAST_CURSOR_AGE_SECONDS, Math.max(0, ageSeconds));
    logInfo("[CURSOR] Loaded cursor state", {
      since_id: state.since_id,
      last_fetch_at: state.last_fetch_at,
    });
    return state;
  } catch (error) {
    logError("[CURSOR] Failed to load cursor state", {
      error: error instanceof Error ? error.message : String(error),
    });
    
    // Try backup
    if (existsSync(CURSOR_BACKUP_FILE)) {
      try {
        const raw = readFileSync(CURSOR_BACKUP_FILE, "utf-8");
        const state = JSON.parse(raw) as CursorState;
        logInfo("[CURSOR] Recovered from backup");
        return state;
      } catch {
        // Ignore backup error
      }
    }
    
    return {
      since_id: null,
      last_fetch_at: new Date(0).toISOString(),
      fetched_count: 0,
      version: CURRENT_VERSION,
    };
  }
}

/**
 * Save cursor state to disk atomically
 */
export function saveCursorState(state: CursorState): void {
  try {
    ensureDataDir();
    
    // Write to temp file first
    const tempFile = `${CURSOR_FILE}.tmp`;
    writeFileSync(tempFile, JSON.stringify(state, null, 2), "utf-8");
    
    // Backup current file if exists
    if (existsSync(CURSOR_FILE)) {
      try {
        const current = readFileSync(CURSOR_FILE, "utf-8");
        writeFileSync(CURSOR_BACKUP_FILE, current, "utf-8");
      } catch {
        // Ignore backup write errors
      }
    }
    
    // Atomic rename
    const { renameSync } = require("node:fs");
    renameSync(tempFile, CURSOR_FILE);
    
    cachedCursor = state.since_id;
    lastPersistedAt = Date.now();
    setGauge(GAUGE_NAMES.LAST_CURSOR_AGE_SECONDS, 0);
    logInfo("[CURSOR] Persisted cursor state", {
      since_id: state.since_id,
      fetched_count: state.fetched_count,
    });
  } catch (error) {
    logError("[CURSOR] Failed to save cursor state", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Update cursor after successful fetch
 */
export function updateCursor(
  sinceId: string | null,
  fetchedCount: number
): void {
  // Only update if we have a new cursor
  if (!sinceId) return;
  
  // Check if cursor actually changed
  if (cachedCursor === sinceId) return;
  
  const state: CursorState = {
    since_id: sinceId,
    last_fetch_at: new Date().toISOString(),
    fetched_count: fetchedCount,
    version: CURRENT_VERSION,
  };
  
  // Throttle persistence
  const now = Date.now();
  if (now - lastPersistedAt < PERSISTENCE_INTERVAL_MS) {
    // Just update cache, don't persist yet
    cachedCursor = sinceId;
    return;
  }
  
  saveCursorState(state);
}

/**
 * Get cached cursor (fast, no disk read)
 */
export function getCachedCursor(): string | null {
  return cachedCursor;
}

/**
 * Force immediate cursor persistence
 */
export function forcePersistCursor(): void {
  const state = loadCursorState();
  saveCursorState(state);
}

/**
 * Validate cursor to prevent out-of-order ingestion
 */
export function isValidCursor(newCursor: string, oldCursor: string | null): boolean {
  if (!oldCursor) return true; // Any cursor is valid if we don't have one
  
  // Twitter IDs are snowflakes (roughly chronological)
  // A valid new cursor should be > old cursor
  try {
    const newId = BigInt(newCursor);
    const oldId = BigInt(oldCursor);
    return newId > oldId;
  } catch {
    // If we can't parse as BigInt, fall back to string comparison
    return newCursor > oldCursor;
  }
}

/**
 * Cursor manager for poll loop integration
 */
export class CursorManager {
  private state: CursorState;
  private pendingSinceId: string | null = null;

  constructor() {
    this.state = loadCursorState();
    cachedCursor = this.state.since_id;
  }

  /**
   * Get current since_id for fetching
   */
  getSinceId(): string | null {
    return this.state.since_id;
  }

  /**
   * Queue cursor update (throttled persistence)
   */
  onFetchSuccess(sinceId: string | null, fetchedCount: number): void {
    if (!sinceId) return;
    
    // Validate cursor order
    if (!isValidCursor(sinceId, this.state.since_id)) {
      logWarn("[CURSOR] Ignoring out-of-order cursor", {
        newCursor: sinceId,
        oldCursor: this.state.since_id,
      });
      return;
    }
    
    this.pendingSinceId = sinceId;
    this.state.since_id = sinceId;
    this.state.fetched_count = fetchedCount;
    
    updateCursor(sinceId, fetchedCount);
  }

  /**
   * Force immediate persistence
   */
  flush(): void {
    if (this.pendingSinceId) {
      saveCursorState(this.state);
      this.pendingSinceId = null;
    }
  }

  /**
   * Get stats for monitoring
   */
  getStats(): { since_id: string | null; last_fetch_at: string; fetched_count: number } {
    return {
      since_id: this.state.since_id,
      last_fetch_at: this.state.last_fetch_at,
      fetched_count: this.state.fetched_count,
    };
  }
}
