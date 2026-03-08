/**
 * LLM Budget Gate
 * 
 * Implements sliding window rate limiting for LLM calls.
 * Prevents cost overruns by tracking call counts per minute.
 */

import { logWarn } from "../ops/logger.js";

// Configuration from environment
const MAX_LLM_CALLS_PER_MINUTE = Number(process.env.MAX_LLM_CALLS_PER_MINUTE) || 30;
const COST_WEIGHT_THREAD = Number(process.env.COST_WEIGHT_THREAD) || 2;
const COST_WEIGHT_REPLY = Number(process.env.COST_WEIGHT_REPLY) || 1;

// Sliding window tracking
interface WindowEntry {
  timestamp: number;
  weight: number;
}

const callWindow: WindowEntry[] = [];
const WINDOW_SIZE_MS = 60_000; // 1 minute

/**
 * Check if an LLM call is allowed within budget
 * @param isThread Whether this is a thread (higher cost) or simple reply
 * @returns Object with allowed status and remaining budget info
 */
export function checkLLMBudget(isThread: boolean = false): {
  allowed: boolean;
  remaining: number;
  used: number;
  limit: number;
  skipReason?: string;
} {
  const now = Date.now();
  const weight = isThread ? COST_WEIGHT_THREAD : COST_WEIGHT_REPLY;
  
  // Clean old entries outside the window
  const cutoff = now - WINDOW_SIZE_MS;
  while (callWindow.length > 0 && callWindow[0]!.timestamp < cutoff) {
    callWindow.shift();
  }
  
  // Calculate current usage
  const used = callWindow.reduce((sum, entry) => sum + entry.weight, 0);
  const remaining = MAX_LLM_CALLS_PER_MINUTE - used;
  
  // Check if this call would exceed budget
  if (used + weight > MAX_LLM_CALLS_PER_MINUTE) {
    const skipReason = `budget_exceeded: used=${used}, limit=${MAX_LLM_CALLS_PER_MINUTE}, requested_weight=${weight}`;
    logWarn("[BUDGET_GATE] LLM call blocked - budget exceeded", {
      used,
      limit: MAX_LLM_CALLS_PER_MINUTE,
      requestedWeight: weight,
      isThread,
    });
    return {
      allowed: false,
      remaining,
      used,
      limit: MAX_LLM_CALLS_PER_MINUTE,
      skipReason,
    };
  }
  
  return {
    allowed: true,
    remaining: remaining - weight,
    used,
    limit: MAX_LLM_CALLS_PER_MINUTE,
  };
}

/**
 * Record an LLM call in the budget window
 * @param isThread Whether this was a thread (higher cost) or simple reply
 */
export function recordLLMCall(isThread: boolean = false): void {
  const weight = isThread ? COST_WEIGHT_THREAD : COST_WEIGHT_REPLY;
  callWindow.push({
    timestamp: Date.now(),
    weight,
  });
}

/**
 * Get current budget status without consuming
 */
export function getBudgetStatus(): {
  used: number;
  limit: number;
  remaining: number;
  windowSize: number;
} {
  const now = Date.now();
  const cutoff = now - WINDOW_SIZE_MS;
  while (callWindow.length > 0 && callWindow[0]!.timestamp < cutoff) {
    callWindow.shift();
  }
  
  const used = callWindow.reduce((sum, entry) => sum + entry.weight, 0);
  return {
    used,
    limit: MAX_LLM_CALLS_PER_MINUTE,
    remaining: MAX_LLM_CALLS_PER_MINUTE - used,
    windowSize: callWindow.length,
  };
}

/**
 * Reset the budget window (useful for testing)
 */
export function resetBudget(): void {
  callWindow.length = 0;
}
