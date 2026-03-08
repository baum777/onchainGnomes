/**
 * Cursor Persistence Manager (StateStore-backed)
 *
 * Ensures no mention gaps and no double-processing.
 */

import { logInfo, logError, logWarn } from "../ops/logger.js";
import { getStateStore } from "./storeFactory.js";
import type { CursorState } from "./stateStore.js";

const CURRENT_VERSION = 1;

// In-memory cursor cache
let cachedCursor: string | null = null;
let lastPersistedAt = 0;
const PERSISTENCE_INTERVAL_MS = 60_000; // Persist at most every minute

/**
 * Load cursor state from store
 */
export async function loadCursorState(): Promise<CursorState> {
  try {
    const store = getStateStore();
    const state = await store.getCursor();
    
    if (!state) {
      logInfo("[CURSOR] No persisted cursor found, starting fresh");
      return {
        since_id: null,
        last_fetch_at: new Date(0).toISOString(),
        fetched_count: 0,
        version: CURRENT_VERSION,
      };
    }
    
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
    
    logInfo("[CURSOR] Loaded cursor state", {
      since_id: state.since_id,
      last_fetch_at: state.last_fetch_at,
    });
    
    return state;
  } catch (error) {
    logError("[CURSOR] Failed to load cursor state", {
      error: error instanceof Error ? error.message : String(error),
    });
    
    return {
      since_id: null,
      last_fetch_at: new Date(0).toISOString(),
      fetched_count: 0,
      version: CURRENT_VERSION,
    };
  }
}

/**
 * Save cursor state to store
 */
export async function saveCursorState(state: CursorState): Promise<void> {
  try {
    const store = getStateStore();
    await store.setCursor(state);
    
    // Update cache
    cachedCursor = state.since_id;
    lastPersistedAt = Date.now();
    
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
export async function updateCursor(
  sinceId: string | null,
  fetchedCount: number
): Promise<void> {
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
  
  await saveCursorState(state);
}

/**
 * Get cached cursor (fast, no store read)
 */
export function getCachedCursor(): string | null {
  return cachedCursor;
}

/**
 * Force immediate cursor persistence
 */
export async function forcePersistCursor(): Promise<void> {
  const state = await loadCursorState();
  await saveCursorState(state);
}

/**
 * Validate cursor to prevent out-of-order ingestion
 */
export function isValidCursor(newCursor: string, oldCursor: string | null): boolean {
  if (!oldCursor) return true;
  
  try {
    const newId = BigInt(newCursor);
    const oldId = BigInt(oldCursor);
    return newId > oldId;
  } catch {
    return newCursor > oldCursor;
  }
}

/**
 * Cursor manager for poll loop integration
 */
export class CursorManager {
  private state: CursorState;
  private pendingSinceId: string | null = null;

  constructor(state: CursorState) {
    this.state = state;
    cachedCursor = state.since_id;
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
  async onFetchSuccess(sinceId: string | null, fetchedCount: number): Promise<void> {
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
    
    await updateCursor(sinceId, fetchedCount);
  }

  /**
   * Force immediate persistence
   */
  async flush(): Promise<void> {
    if (this.pendingSinceId) {
      await saveCursorState(this.state);
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
