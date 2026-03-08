/**
 * Rate Limiter — Token bucket (global + per-user)
 *
 * Protects against X API rate limits and ban risk.
 * Consume in all modes (incl. dry_run) for realistic behavior.
 */

import { cacheGet, cacheSet } from "./memoryCache.js";

export type RateLimitDecision =
  | { ok: true }
  | { ok: false; reason: "rate_limited"; retryAfterMs: number };

type BucketState = {
  tokens: number;
  lastRefillMs: number;
};

function now(): number {
  return Date.now();
}

function stateKey(scope: string, id: string): string {
  return `rl:${scope}:${id}`;
}

async function loadState(key: string, capacity: number): Promise<BucketState> {
  const raw = await cacheGet(key);
  if (!raw)
    return { tokens: capacity, lastRefillMs: now() };
  try {
    const parsed = JSON.parse(raw) as BucketState;
    if (
      typeof parsed.tokens !== "number" ||
      typeof parsed.lastRefillMs !== "number"
    ) {
      return { tokens: capacity, lastRefillMs: now() };
    }
    return parsed;
  } catch {
    return { tokens: capacity, lastRefillMs: now() };
  }
}

async function saveState(
  key: string,
  s: BucketState,
  ttlSeconds = 24 * 60 * 60
): Promise<void> {
  await cacheSet(key, JSON.stringify(s), ttlSeconds);
}

/**
 * Token bucket: capacity tokens, refill per minute.
 * Consumes cost tokens (default 1).
 */
export async function rateLimitTake(opts: {
  scope: "global" | "user";
  id: string;
  capacity: number;
  refillPerMinute: number;
  cost?: number;
}): Promise<RateLimitDecision> {
  const { scope, id, capacity, refillPerMinute } = opts;
  const cost = opts.cost ?? 1;

  const key = stateKey(scope, id);
  const s0 = await loadState(key, capacity);

  const elapsedMs = Math.max(0, now() - s0.lastRefillMs);
  const refillPerMs = refillPerMinute / 60_000;
  const refilled = s0.tokens + elapsedMs * refillPerMs;
  const tokens = Math.min(capacity, refilled);

  if (tokens < cost) {
    const missing = cost - tokens;
    const retryAfterMs = Math.ceil(missing / refillPerMs);
    await saveState(key, { tokens, lastRefillMs: now() });
    return { ok: false, reason: "rate_limited", retryAfterMs };
  }

  const s1: BucketState = { tokens: tokens - cost, lastRefillMs: now() };
  await saveState(key, s1);
  return { ok: true };
}

/**
 * Default policy for launch: global 5/min, per-user 2/min.
 */
export async function enforceLaunchRateLimits(params: {
  authorHandle: string;
  globalId?: string;
}): Promise<RateLimitDecision> {
  const globalId = params.globalId ?? "bot";

  const g = await rateLimitTake({
    scope: "global",
    id: globalId,
    capacity: 5,
    refillPerMinute: 5,
  });
  if (!g.ok) return g;

  const u = await rateLimitTake({
    scope: "user",
    id: params.authorHandle.toLowerCase(),
    capacity: 2,
    refillPerMinute: 2,
  });
  if (!u.ok) return u;

  return { ok: true };
}
