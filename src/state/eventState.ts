/**
 * Event State Manager
 * 
 * Tracks event processing state and publish idempotency.
 * Prevents duplicate replies and enables retry with exponential backoff.
 */

import { logError, logInfo, logWarn } from "../ops/logger.js";

// Event states
export type EventState = 
  | "event_seen"
  | "processed_ok"
  | "publish_attempted"
  | "publish_succeeded";

interface EventTracking {
  state: EventState;
  eventId: string;
  tweetId?: string;
  attempts: number;
  lastAttemptAt?: number;
  error?: string;
}

// In-memory state tracking
const eventStates = new Map<string, EventTracking>();

// Retry configuration
const RETRY_DELAYS_MS = [1000, 5000, 15000]; // 1s, 5s, 15s
const MAX_RETRIES = RETRY_DELAYS_MS.length;

/**
 * Get or create event tracking entry
 */
function getOrCreateTracking(eventId: string): EventTracking {
  let tracking = eventStates.get(eventId);
  if (!tracking) {
    tracking = {
      state: "event_seen",
      eventId,
      attempts: 0,
    };
    eventStates.set(eventId, tracking);
  }
  return tracking;
}

/**
 * Record that an event has been seen
 */
export function recordEventSeen(eventId: string): void {
  const tracking = getOrCreateTracking(eventId);
  if (tracking.state === "event_seen") {
    tracking.state = "event_seen";
    logInfo("[EVENT_STATE] Event seen", { eventId });
  }
}

/**
 * Record that an event has been processed successfully (pipeline completed)
 */
export function recordEventProcessed(eventId: string): void {
  const tracking = getOrCreateTracking(eventId);
  tracking.state = "processed_ok";
  logInfo("[EVENT_STATE] Event processed", { eventId });
}

/**
 * Record a publish attempt
 */
export function recordPublishAttempt(eventId: string): void {
  const tracking = getOrCreateTracking(eventId);
  tracking.state = "publish_attempted";
  tracking.attempts++;
  tracking.lastAttemptAt = Date.now();
  logInfo("[EVENT_STATE] Publish attempted", { eventId, attempt: tracking.attempts });
}

/**
 * Record successful publish with tweet ID mapping
 */
export function recordPublishSuccess(eventId: string, tweetId: string): void {
  const tracking = getOrCreateTracking(eventId);
  tracking.state = "publish_succeeded";
  tracking.tweetId = tweetId;
  logInfo("[EVENT_STATE] Publish succeeded", { eventId, tweetId });
}

/**
 * Record publish failure
 */
export function recordPublishFailure(eventId: string, error: string): void {
  const tracking = getOrCreateTracking(eventId);
  tracking.error = error;
  logError("[EVENT_STATE] Publish failed", { eventId, error, attempts: tracking.attempts });
}

/**
 * Check if event has already been published (idempotency check)
 */
export function isPublished(eventId: string): { published: boolean; tweetId?: string } {
  const tracking = eventStates.get(eventId);
  if (tracking?.state === "publish_succeeded" && tracking.tweetId) {
    return { published: true, tweetId: tracking.tweetId };
  }
  return { published: false };
}

/**
 * Get current state of an event
 */
export function getEventState(eventId: string): EventTracking | undefined {
  return eventStates.get(eventId);
}

/**
 * Check if event should be retried and get delay
 */
export function shouldRetryPublish(eventId: string): { shouldRetry: boolean; delayMs: number } {
  const tracking = eventStates.get(eventId);
  
  if (!tracking) {
    return { shouldRetry: true, delayMs: 0 };
  }
  
  // Already succeeded - don't retry
  if (tracking.state === "publish_succeeded") {
    return { shouldRetry: false, delayMs: 0 };
  }
  
  // Check if we've exceeded max retries
  if (tracking.attempts >= MAX_RETRIES) {
    logWarn("[EVENT_STATE] Max retries exceeded", { eventId, attempts: tracking.attempts });
    return { shouldRetry: false, delayMs: 0 };
  }
  
  return { 
    shouldRetry: true, 
    delayMs: RETRY_DELAYS_MS[tracking.attempts] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!
  };
}

/**
 * Execute publish with retry logic
 */
export async function publishWithRetry(
  eventId: string,
  publishFn: () => Promise<{ tweetId: string }>
): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  // Check idempotency first
  const existing = isPublished(eventId);
  if (existing.published) {
    logInfo("[EVENT_STATE] Duplicate publish prevented", { eventId, tweetId: existing.tweetId });
    return { success: true, tweetId: existing.tweetId };
  }
  
  let lastError: string | undefined;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Check if we should retry
    if (attempt > 0) {
      const retryCheck = shouldRetryPublish(eventId);
      if (!retryCheck.shouldRetry) {
        break;
      }
      logInfo("[EVENT_STATE] Retrying publish", { eventId, attempt, delayMs: retryCheck.delayMs });
      await new Promise(resolve => setTimeout(resolve, retryCheck.delayMs));
    }
    
    recordPublishAttempt(eventId);
    
    try {
      const result = await publishFn();
      recordPublishSuccess(eventId, result.tweetId);
      return { success: true, tweetId: result.tweetId };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      recordPublishFailure(eventId, lastError);
    }
  }
  
  return { success: false, error: lastError ?? "Max retries exceeded" };
}

/**
 * Reset all event states (useful for testing)
 */
export function resetEventStates(): void {
  eventStates.clear();
}

/**
 * Clean up old entries (call periodically to prevent memory growth)
 */
export function cleanupOldEntries(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
  const cutoff = Date.now() - maxAgeMs;
  let cleaned = 0;
  
  for (const [eventId, tracking] of eventStates.entries()) {
    if (tracking.lastAttemptAt && tracking.lastAttemptAt < cutoff) {
      eventStates.delete(eventId);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    logInfo("[EVENT_STATE] Cleaned up old entries", { cleaned, remaining: eventStates.size });
  }
}

/**
 * Get stats for monitoring
 */
export function getEventStateStats(): {
  total: number;
  byState: Record<EventState, number>;
} {
  const byState: Record<EventState, number> = {
    event_seen: 0,
    processed_ok: 0,
    publish_attempted: 0,
    publish_succeeded: 0,
  };
  
  for (const tracking of eventStates.values()) {
    byState[tracking.state]++;
  }
  
  return {
    total: eventStates.size,
    byState,
  };
}
