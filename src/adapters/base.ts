/**
 * Base Adapter Interface
 * 
 * Defines the contract that all adapters must implement.
 * Adapters are low-level clients for external services (RPC, APIs).
 */

import type { ToolResult, Evidence } from "../types/tools.js";

export interface AdapterConfig {
  timeoutMs?: number;
  maxRetries?: number;
  baseUrl?: string;
}

export interface BaseAdapter {
  readonly name: string;
  readonly version: string;
  
  /**
   * Check if the adapter is healthy and reachable
   */
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number; message?: string }>;
  
  /**
   * Get the current adapter configuration
   */
  getConfig(): AdapterConfig;
  
  /**
   * Update adapter configuration
   */
  setConfig(config: Partial<AdapterConfig>): void;
}

/**
 * Circuit breaker states
 */
export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxCalls: number;
}

export interface CircuitBreaker {
  readonly state: CircuitState;
  readonly failureCount: number;
  readonly lastFailureTime: number | null;
  
  recordSuccess(): void;
  recordFailure(): void;
  canExecute(): boolean;
}

/**
 * Create a circuit breaker instance
 */
export function createCircuitBreaker(
  config: CircuitBreakerConfig = {
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    halfOpenMaxCalls: 3,
  }
): CircuitBreaker {
  let state: CircuitState = "CLOSED";
  let failureCount = 0;
  let lastFailureTime: number | null = null;
  let halfOpenCalls = 0;

  return {
    get state() {
      if (state === "OPEN") {
        const now = Date.now();
        if (lastFailureTime && now - lastFailureTime >= config.resetTimeoutMs) {
          state = "HALF_OPEN";
          halfOpenCalls = 0;
        }
      }
      return state;
    },
    
    get failureCount() {
      return failureCount;
    },
    
    get lastFailureTime() {
      return lastFailureTime;
    },

    recordSuccess() {
      if (state === "HALF_OPEN") {
        halfOpenCalls++;
        if (halfOpenCalls >= config.halfOpenMaxCalls) {
          state = "CLOSED";
          failureCount = 0;
          halfOpenCalls = 0;
        }
      } else {
        failureCount = 0;
      }
    },

    recordFailure() {
      failureCount++;
      lastFailureTime = Date.now();
      
      if (state === "HALF_OPEN" || failureCount >= config.failureThreshold) {
        state = "OPEN";
      }
    },

    canExecute() {
      const currentState = this.state;
      
      if (currentState === "CLOSED") {
        return true;
      }
      
      if (currentState === "HALF_OPEN" && halfOpenCalls < config.halfOpenMaxCalls) {
        return true;
      }
      
      return false;
    },
  };
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Calculate delay with exponential backoff
 */
export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig
): number {
  const exponential = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
  const jitter = Math.random() * 1000;
  return Math.min(exponential + jitter, config.maxDelayMs);
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("econnrefused") ||
      message.includes("etimedout") ||
      message.includes("503") ||
      message.includes("502") ||
      message.includes("504")
    );
  }
  return false;
}
