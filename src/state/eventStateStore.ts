/**
 * Event State Manager (StateStore-backed)
 *
 * Tracks event processing state and publish idempotency.
 * Uses StateStore for durable persistence.
 */

import { logError, logInfo, logWarn } from "../ops/logger.js";
import { getStateStore } from "./storeFactory.js";
import type { EventTracking, EventState } from "./stateStore.js";
import { incrementCounter } from "../observability/metrics.js";
import { COUNTER_NAMES } from "../observability/metricTypes.js";

// Retry configuration
const RETRY_DELAYS_MS = [1000, 5000, 15000]; // 1s, 5s, 15s
const MAX_RETRIES = RETRY_DELAYS_MS.length;
const PUBLISH_LOCK_TTL_MS = 30_000; // 30 seconds
const PUBLISHED_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// In-memory cache for hot path
const hotCache = new Map<string, EventTracking>();
const HOT_CACHE_SIZE = 1000;

/**
 * Get event state from store (with cache)
 */
async function getTracking(eventId: string): Promise<EventTracking | null> {
  // Check hot cache
  const cached = hotCache.get(eventId);
  if (cached) return cached;
  
  // Load from store
  const store = getStateStore();
  const tracking = await store.getEventState(eventId);
  
  if (tracking) {
    // Add to hot cache (LRU eviction)
    if (hotCache.size >= HOT_CACHE_SIZE) {
      const firstKey = hotCache.keys().next().value;
      if (firstKey) {
        hotCache.delete(firstKey);
      }
    }
    hotCache.set(eventId, tracking);
  }
  
  return tracking;
}

/**
 * Save event state to store (with cache update)
 */
async function saveTracking(tracking: EventTracking): Promise<void> {
  // Update cache
  hotCache.set(tracking.eventId, tracking);
  
  // Persist to store
  const store = getStateStore();
  await store.setEventState(tracking.eventId, tracking);
}

/**
 * Record that an event has been seen
 */
export async function recordEventSeen(eventId: string): Promise<void> {
  const existing = await getTracking(eventId);
  
  if (!existing) {
    const tracking: EventTracking = {
      state: "event_seen",
      eventId,
      attempts: 0,
    };
    await saveTracking(tracking);
    logInfo("[EVENT_STATE] Event seen", { eventId });
  }
}

/**
 * Record that a mention was skipped (block, circuit breaker, etc.) - marks as processed for idempotency
 */
export async function recordMentionSkipped(eventId: string): Promise<void> {
  const existing = await getTracking(eventId);
  const tracking: EventTracking = {
    ...(existing || { eventId, attempts: 0 }),
    state: "processed_ok",
    eventId,
  };
  await saveTracking(tracking);
}

/**
 * Check if a mention has been processed (seen and decided on - skip or published)
 */
export async function isProcessed(eventId: string): Promise<boolean> {
  const tracking = await getTracking(eventId);
  if (tracking) return true;
  const pub = await isPublished(eventId);
  return pub.published;
}

/**
 * Record that an event has been processed successfully
 */
export async function recordEventProcessed(eventId: string): Promise<void> {
  const existing = await getTracking(eventId);
  
  const tracking: EventTracking = {
    ...(existing || { eventId, attempts: 0 }),
    state: "processed_ok",
    eventId,
  };
  
  await saveTracking(tracking);
  logInfo("[EVENT_STATE] Event processed", { eventId });
}

/**
 * Record a publish attempt
 */
export async function recordPublishAttempt(eventId: string): Promise<void> {
  const existing = await getTracking(eventId);
  
  const tracking: EventTracking = {
    ...(existing || { eventId, attempts: 0 }),
    state: "publish_attempted",
    eventId,
    attempts: (existing?.attempts || 0) + 1,
    lastAttemptAt: Date.now(),
  };
  
  await saveTracking(tracking);
  logInfo("[EVENT_STATE] Publish attempted", { eventId, attempt: tracking.attempts });
}

/**
 * Record successful publish with tweet ID
 */
export async function recordPublishSuccess(eventId: string, tweetId: string): Promise<void> {
  const existing = await getTracking(eventId);
  
  const tracking: EventTracking = {
    ...(existing || { eventId, attempts: 0 }),
    state: "publish_succeeded",
    eventId,
    tweetId,
    lastAttemptAt: Date.now(),
  };
  
  await saveTracking(tracking);
  
  // Also mark in published store for fast lookup
  const store = getStateStore();
  await store.markPublished(eventId, tweetId, PUBLISHED_TTL_MS);
  
  logInfo("[EVENT_STATE] Publish succeeded", { eventId, tweetId });
}

/**
 * Record publish failure
 */
export async function recordPublishFailure(eventId: string, error: string): Promise<void> {
  const existing = await getTracking(eventId);
  
  const tracking: EventTracking = {
    ...(existing || { eventId, attempts: 0 }),
    state: existing?.state || "publish_attempted",
    eventId,
    error,
    lastAttemptAt: Date.now(),
  };
  
  await saveTracking(tracking);
  logError("[EVENT_STATE] Publish failed", { eventId, error, attempts: tracking.attempts });
}

/**
 * Check if event has already been published (idempotency check)
 */
export async function isPublished(eventId: string): Promise<{ published: boolean; tweetId?: string }> {
  // Check hot cache first
  const cached = hotCache.get(eventId);
  if (cached?.state === "publish_succeeded" && cached.tweetId) {
    return { published: true, tweetId: cached.tweetId };
  }
  
  // Check published store (faster than full state)
  const store = getStateStore();
  return await store.isPublished(eventId);
}

/**
 * Get current state of an event
 */
export async function getEventState(eventId: string): Promise<EventTracking | null> {
  return await getTracking(eventId);
}

/**
 * Check if event should be retried and get delay
 */
export async function shouldRetryPublish(eventId: string): Promise<{ shouldRetry: boolean; delayMs: number }> {
  const tracking = await getTracking(eventId);
  
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
 * Execute publish with retry logic and distributed locking
 */
export async function publishWithRetry(
  eventId: string,
  publishFn: () => Promise<{ tweetId: string }>
): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  const store = getStateStore();
  
  // Check idempotency first
  const existing = await isPublished(eventId);
  if (existing.published) {
    incrementCounter(COUNTER_NAMES.PUBLISH_DUPLICATE_PREVENTED_TOTAL);
    logInfo("[EVENT_STATE] Duplicate publish prevented", { eventId, tweetId: existing.tweetId });
    return { success: true, tweetId: existing.tweetId };
  }
  
  let lastError: string | undefined;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Check if we should retry
    if (attempt > 0) {
      const retryCheck = await shouldRetryPublish(eventId);
      if (!retryCheck.shouldRetry) {
        break;
      }
      logInfo("[EVENT_STATE] Retrying publish", { eventId, attempt, delayMs: retryCheck.delayMs });
      await new Promise(resolve => setTimeout(resolve, retryCheck.delayMs));
    }
    
    // Acquire distributed lock
    const lockAcquired = await store.acquirePublishLock(eventId, PUBLISH_LOCK_TTL_MS);
    if (!lockAcquired) {
      logWarn("[EVENT_STATE] Could not acquire publish lock", { eventId });
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      continue;
    }
    
    try {
      // Double-check idempotency after acquiring lock
      const doubleCheck = await store.isPublished(eventId);
      if (doubleCheck.published) {
        return { success: true, tweetId: doubleCheck.tweetId };
      }
      
      await recordPublishAttempt(eventId);
      
      const result = await publishFn();
      await recordPublishSuccess(eventId, result.tweetId);
      
      return { success: true, tweetId: result.tweetId };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await recordPublishFailure(eventId, lastError);
    } finally {
      // Always release lock
      await store.releasePublishLock(eventId);
    }
  }
  
  return { success: false, error: lastError ?? "Max retries exceeded" };
}

/**
 * Reset all event states (useful for testing)
 */
export async function resetEventStates(): Promise<void> {
  hotCache.clear();
  logInfo("[EVENT_STATE] Reset complete");
}

/**
 * Get stats for monitoring
 */
export async function getEventStateStats(): Promise<{
  total: number;
  byState: Record<EventState, number>;
}> {
  // This is expensive with StateStore - use cache for approximation
  const byState: Record<EventState, number> = {
    event_seen: 0,
    processed_ok: 0,
    publish_attempted: 0,
    publish_succeeded: 0,
  };
  
  for (const tracking of hotCache.values()) {
    byState[tracking.state]++;
  }
  
  return {
    total: hotCache.size,
    byState,
  };
}
