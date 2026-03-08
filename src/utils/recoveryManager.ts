/**
 * Worker Recovery Manager
 *
 * Handles worker restart and state recovery:
 * - Rehydrates last poll state
 * - Detects and handles out-of-order ingestion
 * - Prevents signal loss on restart
 */

import { logInfo, logWarn, logError } from "../ops/logger.js";
import { loadCursorState } from "./cursorPersistence.js";

interface RecoveryState {
  lastSinceId: string | null;
  lastPollTime: Date;
  wasGracefulShutdown: boolean;
  missedPolls: number;
}

const RECOVERY_FILE = ".recovery_state.json";
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 30_000;

/**
 * Check if previous shutdown was graceful
 */
export function checkPreviousShutdown(): {
  wasGraceful: boolean;
  recoveryNeeded: boolean;
} {
  try {
    const cursorState = loadCursorState();
    const lastFetchTime = new Date(cursorState.last_fetch_at);
    const now = new Date();
    const timeSinceLastFetch = now.getTime() - lastFetchTime.getTime();
    
    // If last fetch was recent, assume graceful shutdown
    const wasGraceful = timeSinceLastFetch < GRACEFUL_SHUTDOWN_TIMEOUT_MS * 2;
    
    // Recovery needed if:
    // 1. Last fetch was > 2x poll interval ago
    // 2. We have a cursor but it's potentially stale
    const recoveryNeeded = timeSinceLastFetch > GRACEFUL_SHUTDOWN_TIMEOUT_MS;
    
    logInfo("[RECOVERY] Shutdown analysis", {
      wasGraceful,
      recoveryNeeded,
      timeSinceLastFetchMs: timeSinceLastFetch,
      lastFetchAt: cursorState.last_fetch_at,
    });
    
    return { wasGraceful, recoveryNeeded };
  } catch (error) {
    logError("[RECOVERY] Failed to check shutdown state", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { wasGraceful: false, recoveryNeeded: true };
  }
}

/**
 * Calculate recovery window
 */
export function calculateRecoveryWindow(
  lastPollTime: Date,
  maxLookbackMinutes: number = 60
): { sinceId: string | null; lookbackMinutes: number } {
  const now = new Date();
  const timeDiffMs = now.getTime() - lastPollTime.getTime();
  const timeDiffMinutes = Math.floor(timeDiffMs / 60000);
  
  // Cap lookback to prevent excessive API calls
  const lookbackMinutes = Math.min(timeDiffMinutes, maxLookbackMinutes);
  
  logInfo("[RECOVERY] Calculated recovery window", {
    timeDiffMinutes,
    lookbackMinutes,
    maxLookbackMinutes,
  });
  
  // For Twitter API, we use since_id which is more reliable than time-based lookback
  // The cursor persistence handles since_id
  return { sinceId: null, lookbackMinutes };
}

/**
 * Detect out-of-order mentions
 */
export function detectOutOfOrder(
  mentions: Array<{ id: string; created_at: string }>,
  lastProcessedId: string | null
): { outOfOrder: Array<{ id: string; created_at: string }>; inOrder: Array<{ id: string; created_at: string }> } {
  if (!lastProcessedId) {
    return { outOfOrder: [], inOrder: mentions };
  }
  
  const lastId = BigInt(lastProcessedId);
  
  const outOfOrder: Array<{ id: string; created_at: string }> = [];
  const inOrder: Array<{ id: string; created_at: string }> = [];
  
  for (const mention of mentions) {
    try {
      const mentionId = BigInt(mention.id);
      
      // Twitter IDs are roughly chronological (snowflake)
      if (mentionId <= lastId) {
        outOfOrder.push(mention);
      } else {
        inOrder.push(mention);
      }
    } catch {
      // If we can't parse as BigInt, assume in order
      inOrder.push(mention);
    }
  }
  
  if (outOfOrder.length > 0) {
    logWarn("[RECOVERY] Detected out-of-order mentions", {
      outOfOrderCount: outOfOrder.length,
      lastProcessedId,
    });
  }
  
  return { outOfOrder, inOrder };
}

/**
 * Recovery manager for worker restart
 */
export class RecoveryManager {
  private state: RecoveryState;
  private recoveryMode: boolean;

  constructor() {
    const cursorState = loadCursorState();
    const { wasGraceful, recoveryNeeded } = checkPreviousShutdown();
    
    this.state = {
      lastSinceId: cursorState.since_id,
      lastPollTime: new Date(cursorState.last_fetch_at),
      wasGracefulShutdown: wasGraceful,
      missedPolls: recoveryNeeded 
        ? Math.floor((Date.now() - new Date(cursorState.last_fetch_at).getTime()) / 30000)
        : 0,
    };
    
    this.recoveryMode = recoveryNeeded;
  }

  /**
   * Check if we're in recovery mode
   */
  isInRecoveryMode(): boolean {
    return this.recoveryMode;
  }

  /**
   * Get recovery state
   */
  getState(): RecoveryState {
    return { ...this.state };
  }

  /**
   * Get recovery recommendations
   */
  getRecommendations(): {
    shouldUseSearch: boolean;
    lookbackMinutes: number;
    aggressivePolling: boolean;
  } {
    const { lookbackMinutes } = calculateRecoveryWindow(this.state.lastPollTime);
    
    // Use search API for recovery if:
    // 1. We missed more than 10 polls (5 minutes at 30s interval)
    // 2. Last fetch was more than 10 minutes ago
    const shouldUseSearch = this.state.missedPolls > 10 || lookbackMinutes > 10;
    
    // Use aggressive polling (shorter intervals) during recovery
    const aggressivePolling = this.recoveryMode;
    
    return {
      shouldUseSearch,
      lookbackMinutes,
      aggressivePolling,
    };
  }

  /**
   * Mark recovery complete
   */
  markRecovered(): void {
    if (this.recoveryMode) {
      logInfo("[RECOVERY] Recovery mode completed");
      this.recoveryMode = false;
    }
  }

  /**
   * Validate mention order and filter
   */
  filterMentions<T extends { id: string; created_at: string }>(mentions: T[]): T[] {
    const { outOfOrder, inOrder } = detectOutOfOrder(
      mentions,
      this.state.lastSinceId
    );
    
    if (outOfOrder.length > 0) {
      logWarn("[RECOVERY] Filtering out-of-order mentions", {
        filtered: outOfOrder.length,
        kept: inOrder.length,
      });
    }
    
    return inOrder as T[];
  }

  /**
   * Log recovery summary
   */
  logSummary(): void {
    const recommendations = this.getRecommendations();
    
    logInfo("[RECOVERY] Worker restart summary", {
      wasGracefulShutdown: this.state.wasGracefulShutdown,
      recoveryMode: this.recoveryMode,
      missedPolls: this.state.missedPolls,
      lastSinceId: this.state.lastSinceId,
      recommendations,
    });
  }
}

/**
 * Graceful shutdown handler
 */
export async function performGracefulShutdown(
  cursorManager: { flush: () => void },
  timeoutMs: number = GRACEFUL_SHUTDOWN_TIMEOUT_MS
): Promise<void> {
  logInfo("[RECOVERY] Starting graceful shutdown");
  
  const timeout = new Promise<void>((_, reject) => {
    setTimeout(() => reject(new Error("Shutdown timeout")), timeoutMs);
  });
  
  try {
    await Promise.race([
      (async () => {
        // Flush cursor state
        cursorManager.flush();
        
        // Any other cleanup...
        
        logInfo("[RECOVERY] Graceful shutdown complete");
      })(),
      timeout,
    ]);
  } catch (error) {
    logError("[RECOVERY] Graceful shutdown failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
