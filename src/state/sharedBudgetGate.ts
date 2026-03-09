import type { StateStore } from "./stateStore.js";
import { getStateStore } from "./storeFactory.js";
import { logWarn, logInfo } from "../ops/logger.js";
import { incrementCounter, setGauge } from "../observability/metrics.js";
import { COUNTER_NAMES, GAUGE_NAMES } from "../observability/metricTypes.js";

const MAX_LLM_CALLS_PER_MINUTE =
  Number(process.env.MAX_LLM_CALLS_PER_MINUTE) || 30;
const COST_WEIGHT_THREAD = Number(process.env.COST_WEIGHT_THREAD) || 2;
const COST_WEIGHT_REPLY = Number(process.env.COST_WEIGHT_REPLY) || 1;

const BUDGET_KEY = "budget:llm:minute";
const WINDOW_TTL_SECONDS = 60;

export async function checkLLMBudget(
  isThread: boolean = false,
  store?: StateStore,
): Promise<{
  allowed: boolean;
  remaining: number;
  used: number;
  limit: number;
  skipReason?: string;
}> {
  const kv = store ?? getStateStore();
  const weight = isThread ? COST_WEIGHT_THREAD : COST_WEIGHT_REPLY;
  
  const status = await getBudgetStatus(kv);
  const used = status.used;
  const remaining = MAX_LLM_CALLS_PER_MINUTE - used;

  if (used + weight > MAX_LLM_CALLS_PER_MINUTE) {
    incrementCounter(COUNTER_NAMES.LLM_BUDGET_BLOCK_TOTAL);
    const skipReason = `budget_exceeded: used=${used}, limit=${MAX_LLM_CALLS_PER_MINUTE}, requested_weight=${weight}`;
    logWarn("[BUDGET_GATE] LLM call blocked \u2014 budget exceeded", {
      used,
      limit: MAX_LLM_CALLS_PER_MINUTE,
      requestedWeight: weight,
      isThread,
    });
    return { allowed: false, remaining: 0, used, limit: MAX_LLM_CALLS_PER_MINUTE, skipReason };
  }

  return { allowed: true, remaining: remaining - weight, used, limit: MAX_LLM_CALLS_PER_MINUTE };
}

export async function recordLLMCall(
  isThread: boolean = false,
  store?: StateStore,
): Promise<void> {
  const kv = store ?? getStateStore();
  const weight = isThread ? COST_WEIGHT_THREAD : COST_WEIGHT_REPLY;

  for (let i = 0; i < weight; i++) {
    const current = await kv.incr(BUDGET_KEY);
    if (current === 1) {
      await kv.expire(BUDGET_KEY, WINDOW_TTL_SECONDS);
    }
  }
}

export async function getBudgetStatus(store?: StateStore): Promise<{
  used: number;
  limit: number;
  remaining: number;
  windowSize: number;
}> {
  const kv = store ?? getStateStore();
  const raw = await kv.get(BUDGET_KEY);
  const used = raw ? parseInt(raw, 10) : 0;
  const remaining = MAX_LLM_CALLS_PER_MINUTE - used;
  setGauge(GAUGE_NAMES.LLM_BUDGET_USED, used);
  setGauge(GAUGE_NAMES.LLM_BUDGET_REMAINING, Math.max(remaining, 0));
  return { used, limit: MAX_LLM_CALLS_PER_MINUTE, remaining, windowSize: WINDOW_TTL_SECONDS };
}

export async function resetBudget(store?: StateStore): Promise<void> {
  const kv = store ?? getStateStore();
  await kv.del(BUDGET_KEY);
  logInfo("[BUDGET_GATE] Budget reset");
}
