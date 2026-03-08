/**
 * Robust Fetch Utilities
 *
 * Provides resilient HTTP fetching with:
 * - Configurable timeouts
 * - Exponential backoff with jitter
 * - Rate limit handling
 * - Partial response handling
 */

import { logWarn, logError, logInfo } from "../ops/logger.js";
import { incrementCounter, observeHistogram } from "../observability/metrics.js";
import { COUNTER_NAMES, HISTOGRAM_NAMES } from "../observability/metricTypes.js";

// Configuration from environment
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS) || 30_000;
const FETCH_BACKOFF_BASE_MS = Number(process.env.FETCH_BACKOFF_BASE_MS) || 5_000;
const FETCH_BACKOFF_MAX_MS = Number(process.env.FETCH_BACKOFF_MAX_MS) || 300_000;
const FETCH_RETRY_JITTER_MS = Number(process.env.FETCH_RETRY_JITTER_MS) || 500;
const MAX_FETCH_RETRIES = 3;

export interface FetchOptions {
  timeoutMs?: number;
  maxRetries?: number;
  backoffBaseMs?: number;
  backoffMaxMs?: number;
}

export interface FetchResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  rateLimited?: boolean;
  retryAfterMs?: number;
  partial?: boolean;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  baseMs: number = FETCH_BACKOFF_BASE_MS,
  maxMs: number = FETCH_BACKOFF_MAX_MS,
  jitterMs: number = FETCH_RETRY_JITTER_MS
): number {
  const exponential = baseMs * Math.pow(2, attempt);
  const jitter = Math.random() * jitterMs;
  return Math.min(exponential + jitter, maxMs);
}

/**
 * Check if error is a rate limit (429)
 */
export function isRateLimitError(error: unknown): boolean {
  const e = error as { code?: number; status?: number; rateLimitError?: boolean };
  return e?.code === 429 || e?.status === 429 || e?.rateLimitError === true;
}

/**
 * Check if error is transient (retryable)
 */
export function isTransientError(error: unknown): boolean {
  const e = error as { code?: number; status?: number };
  const transientCodes = [408, 429, 500, 502, 503, 504];
  const code = e?.code || e?.status;
  return code !== undefined && transientCodes.includes(code);
}

/**
 * Extract retry-after from error or headers
 */
export function getRetryAfterMs(error: unknown, defaultMs: number = 60_000): number {
  const e = error as { retryAfter?: number; headers?: { [key: string]: string } };
  
  // Check error object
  if (e?.retryAfter && typeof e.retryAfter === "number") {
    return e.retryAfter * 1000; // Convert seconds to ms
  }
  
  // Check headers
  const retryAfterHeader = e?.headers?.["retry-after"];
  if (retryAfterHeader) {
    const seconds = parseInt(retryAfterHeader, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }
  }
  
  return defaultMs;
}

/**
 * Execute fetch with timeout
 */
export async function fetchWithTimeout<T>(
  fetchFn: () => Promise<T>,
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<T> {
  return Promise.race([
    fetchFn(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Fetch timeout after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Robust fetch with retry, backoff, and rate limit handling
 */
export async function robustFetch<T>(
  fetchFn: () => Promise<T>,
  options: FetchOptions = {}
): Promise<FetchResult<T>> {
  const {
    timeoutMs = FETCH_TIMEOUT_MS,
    maxRetries = MAX_FETCH_RETRIES,
    backoffBaseMs = FETCH_BACKOFF_BASE_MS,
    backoffMaxMs = FETCH_BACKOFF_MAX_MS,
  } = options;

  let lastError: Error | undefined;
  const startMs = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const data = await fetchWithTimeout(fetchFn, timeoutMs);
      observeHistogram(HISTOGRAM_NAMES.FETCH_DURATION_MS, Date.now() - startMs);

      if (attempt > 0) {
        incrementCounter(COUNTER_NAMES.FETCH_RETRY_TOTAL);
        logInfo("[ROBUST_FETCH] Succeeded after retry", { attempt });
      }

      return { success: true, data };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (isRateLimitError(error)) {
        incrementCounter(COUNTER_NAMES.FETCH_RATE_LIMITED_TOTAL);
        const retryAfterMs = getRetryAfterMs(error);
        logWarn("[ROBUST_FETCH] Rate limited", { attempt, retryAfterMs });

        return {
          success: false,
          error: lastError.message,
          rateLimited: true,
          retryAfterMs,
        };
      }

      if (attempt < maxRetries && isTransientError(error)) {
        incrementCounter(COUNTER_NAMES.FETCH_RETRY_TOTAL);
        const delayMs = calculateBackoffDelay(attempt, backoffBaseMs, backoffMaxMs);
        logWarn("[ROBUST_FETCH] Transient error, retrying", {
          attempt,
          delayMs,
          error: lastError.message,
        });

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      
      // Non-retryable error
      logError("[ROBUST_FETCH] Non-retryable error", {
        attempt,
        error: lastError.message,
      });
      
      return {
        success: false,
        error: lastError.message,
      };
    }
  }

  // Max retries exceeded
  logError("[ROBUST_FETCH] Max retries exceeded", {
    error: lastError?.message,
  });
  
  return {
    success: false,
    error: lastError?.message || "Max retries exceeded",
  };
}

/**
 * Handle partial response - validate and extract what we can
 */
export function handlePartialResponse<T>(
  response: unknown,
  validator: (data: unknown) => data is T
): FetchResult<T> {
  if (validator(response)) {
    return { success: true, data: response };
  }
  
  // Try to extract partial data
  const partial = response as { data?: unknown; partial?: boolean };
  if (partial?.data && validator(partial.data)) {
    logWarn("[ROBUST_FETCH] Using partial response");
    return {
      success: true,
      data: partial.data,
      partial: true,
    };
  }
  
  return {
    success: false,
    error: "Invalid response format",
  };
}

/**
 * Adaptive polling interval calculator
 */
export class AdaptivePollingController {
  private currentIntervalMs: number;
  private readonly minIntervalMs: number;
  private readonly maxIntervalMs: number;
  private readonly baseIntervalMs: number;

  constructor(
    baseIntervalMs: number = 30_000,
    minIntervalMs: number = 5_000,
    maxIntervalMs: number = 300_000
  ) {
    this.baseIntervalMs = baseIntervalMs;
    this.currentIntervalMs = baseIntervalMs;
    this.minIntervalMs = minIntervalMs;
    this.maxIntervalMs = maxIntervalMs;
  }

  /**
   * Get current polling interval
   */
  getInterval(): number {
    return this.currentIntervalMs;
  }

  /**
   * Decrease interval (after successful fetch)
   */
  onSuccess(): void {
    this.currentIntervalMs = Math.max(
      this.currentIntervalMs * 0.9,
      this.minIntervalMs
    );
  }

  /**
   * Increase interval (after rate limit or error)
   */
  onRateLimit(retryAfterMs?: number): void {
    if (retryAfterMs) {
      this.currentIntervalMs = Math.max(retryAfterMs, this.currentIntervalMs);
    } else {
      this.currentIntervalMs = Math.min(
        this.currentIntervalMs * 1.5,
        this.maxIntervalMs
      );
    }
    
    logInfo("[ADAPTIVE_POLL] Increased interval", {
      newIntervalMs: this.currentIntervalMs,
    });
  }

  /**
   * Reset to base interval
   */
  reset(): void {
    this.currentIntervalMs = this.baseIntervalMs;
  }
}
