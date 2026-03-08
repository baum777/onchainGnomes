/**
 * Shared LLM Budget Gate
 *
 * Uses StateStore for cross-worker budget tracking.
 */

import { logWarn } from "../ops/logger.js";
import { getStateStore } from "./storeFactory.js";
import { incrementCounter, setGauge } from "../observability/metrics.js";
import { COUNTER_NAMES, GAUGE_NAMES } from "../observability/metricTypes.js";

// Configuration from environment
const MAX_LLM_CALLS_PER_MINUTE = Number(process.env.MAX_LLM_CALLS_PER_MINUTE) || 30;
const COST_WEIGHT_THREAD = Number(process.env.COST_WEIGHT_THREAD) || 2;
const COST_WEIGHT_REPLY = Number(process.env.COST_WEIGHT_REPLY) || 1;

const WINDOW_SIZE_MS = 60_000; // 1 minute

/**
 * Check if an LLM call is allowed within budget
 */
export async function checkLLMBudget(isThread: boolean = false): Promise<{
  allowed: boolean;
  remaining: number;
  used: number;
  limit: number;
  skipReason?: string;
}> {
  const weight = isThread ? COST_WEIGHT_THREAD : COST_WEIGHT_REPLY;
  const store = getStateStore();
  
  // Get current window start
  const now = Date.now();
  const windowStart = Math.floor(now / WINDOW_SIZE_MS) * WINDOW_SIZE_MS;
  
  // Get current usage from shared store
  const used = await store.getBudgetUsage(windowStart);
  const remaining = MAX_LLM_CALLS_PER_MINUTE - used;
  
  setGauge(GAUGE_NAMES.LLM_BUDGET_USED, used);
  setGauge(GAUGE_NAMES.LLM_BUDGET_REMAINING, remaining);

  if (used + weight > MAX_LLM_CALLS_PER_MINUTE) {
    incrementCounter(COUNTER_NAMES.LLM_BUDGET_BLOCK_TOTAL);
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
 */
export async function recordLLMCall(isThread: boolean = false): Promise<void> {
  const weight = isThread ? COST_WEIGHT_THREAD : COST_WEIGHT_REPLY;
  const store = getStateStore();
  
  await store.incrementBudgetUsage(weight, WINDOW_SIZE_MS);
}

/**
 * Get current budget status without consuming
 */
export async function getBudgetStatus(): Promise<{
  used: number;
  limit: number;
  remaining: number;
  windowSize: number;
}> {
  const now = Date.now();
  const windowStart = Math.floor(now / WINDOW_SIZE_MS) * WINDOW_SIZE_MS;
  
  const store = getStateStore();
  const used = await store.getBudgetUsage(windowStart);
  const remaining = MAX_LLM_CALLS_PER_MINUTE - used;
  setGauge(GAUGE_NAMES.LLM_BUDGET_USED, used);
  setGauge(GAUGE_NAMES.LLM_BUDGET_REMAINING, remaining);
  return {
    used,
    limit: MAX_LLM_CALLS_PER_MINUTE,
    remaining,
    windowSize: WINDOW_SIZE_MS,
  };
}

/**
 * Reset the budget window
 */
export async function resetBudget(): Promise<void> {
  const store = getStateStore();
  await store.resetBudget();
}
