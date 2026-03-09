/**
 * Rate Guard - Token Bucket Rate Limiting
 * 
 * Implements per-tool, per-role rate limiting using token bucket algorithm.
 * Prevents API abuse and ensures fair resource distribution.
 */

import type { AgentRole, ToolName } from "../../types/agentRouter.js";

// =============================================================================
// Rate Limit Configuration
// =============================================================================

export interface RateLimitConfig {
  requests: number;
  windowMs: number;
}

export interface RateLimitState {
  tokens: number;
  lastRefill: number;
  windowStart: number;
}

// Default rate limits per tool per role
const DEFAULT_RATE_LIMITS: Record<ToolName, Record<AgentRole, RateLimitConfig>> = {
  onchain: {
    planner: { requests: 20, windowMs: 60000 },
    executor: { requests: 50, windowMs: 60000 },
    reviewer: { requests: 0, windowMs: 60000 },
    qa: { requests: 30, windowMs: 60000 },
    narrator: { requests: 0, windowMs: 60000 },
  },
  market: {
    planner: { requests: 30, windowMs: 60000 },
    executor: { requests: 100, windowMs: 60000 },
    reviewer: { requests: 0, windowMs: 60000 },
    qa: { requests: 50, windowMs: 60000 },
    narrator: { requests: 0, windowMs: 60000 },
  },
  policy: {
    planner: { requests: 50, windowMs: 60000 },
    executor: { requests: 100, windowMs: 60000 },
    reviewer: { requests: 30, windowMs: 60000 },
    qa: { requests: 100, windowMs: 60000 },
    narrator: { requests: 50, windowMs: 60000 },
  },
};

// =============================================================================
// Rate Guard State
// =============================================================================

class RateGuardState {
  private buckets: Map<string, RateLimitState> = new Map();
  
  private getKey(role: AgentRole, tool: ToolName): string {
    return `${role}:${tool}`;
  }
  
  getState(role: AgentRole, tool: ToolName): RateLimitState {
    const key = this.getKey(role, tool);
    let state = this.buckets.get(key);
    
    if (!state) {
      const config = DEFAULT_RATE_LIMITS[tool][role];
      state = {
        tokens: config.requests,
        lastRefill: Date.now(),
        windowStart: Date.now(),
      };
      this.buckets.set(key, state);
    }
    
    return state;
  }
  
  updateState(role: AgentRole, tool: ToolName, state: RateLimitState): void {
    const key = this.getKey(role, tool);
    this.buckets.set(key, state);
  }
  
  reset(role?: AgentRole, tool?: ToolName): void {
    if (role && tool) {
      this.buckets.delete(this.getKey(role, tool));
    } else if (role) {
      for (const key of this.buckets.keys()) {
        if (key.startsWith(`${role}:`)) {
          this.buckets.delete(key);
        }
      }
    } else {
      this.buckets.clear();
    }
  }
}

const rateGuardState = new RateGuardState();

// =============================================================================
// Token Bucket Algorithm
// =============================================================================

function refillTokens(
  state: RateLimitState,
  config: RateLimitConfig
): RateLimitState {
  const now = Date.now();
  const timePassed = now - state.lastRefill;
  const tokensToAdd = Math.floor(
    (timePassed / config.windowMs) * config.requests
  );
  
  if (tokensToAdd > 0) {
    return {
      tokens: Math.min(state.tokens + tokensToAdd, config.requests),
      lastRefill: now,
      windowStart: state.windowStart,
    };
  }
  
  return state;
}

function shouldResetWindow(
  state: RateLimitState,
  config: RateLimitConfig
): boolean {
  const now = Date.now();
  return now - state.windowStart >= config.windowMs;
}

// =============================================================================
// Rate Guard Functions
// =============================================================================

export interface RateGuardResult {
  allowed: boolean;
  remaining: number;
  resetAt: string;
  limit: number;
  windowMs: number;
}

/**
 * Check if a tool call is within rate limits
 */
export function rateGuard(
  role: AgentRole,
  tool: ToolName,
  customConfig?: RateLimitConfig
): RateGuardResult {
  const config = customConfig || DEFAULT_RATE_LIMITS[tool][role];
  
  // Get or create state
  let state = rateGuardState.getState(role, tool);
  
  // Check if window should reset
  if (shouldResetWindow(state, config)) {
    state = {
      tokens: config.requests,
      lastRefill: Date.now(),
      windowStart: Date.now(),
    };
  }
  
  // Refill tokens based on time passed
  state = refillTokens(state, config);
  
  // Check if request is allowed
  const allowed = state.tokens > 0;
  
  if (allowed) {
    state.tokens--;
  }
  
  // Update state
  rateGuardState.updateState(role, tool, state);
  
  // Calculate reset time
  const resetAt = new Date(state.windowStart + config.windowMs).toISOString();
  
  return {
    allowed,
    remaining: state.tokens,
    resetAt,
    limit: config.requests,
    windowMs: config.windowMs,
  };
}

/**
 * Check rate limit without consuming a token (peek)
 */
export function peekRateLimit(
  role: AgentRole,
  tool: ToolName,
  customConfig?: RateLimitConfig
): RateGuardResult {
  const config = customConfig || DEFAULT_RATE_LIMITS[tool][role];
  
  let state = rateGuardState.getState(role, tool);
  
  if (shouldResetWindow(state, config)) {
    state = {
      tokens: config.requests,
      lastRefill: Date.now(),
      windowStart: Date.now(),
    };
  }
  
  state = refillTokens(state, config);
  
  const resetAt = new Date(state.windowStart + config.windowMs).toISOString();
  
  return {
    allowed: state.tokens > 0,
    remaining: state.tokens,
    resetAt,
    limit: config.requests,
    windowMs: config.windowMs,
  };
}

/**
 * Get current rate limit status for a role/tool combination
 */
export function getRateLimitStatus(
  role: AgentRole,
  tool: ToolName
): RateGuardResult {
  return peekRateLimit(role, tool);
}

/**
 * Reset rate limits for a specific role/tool or all
 */
export function resetRateLimits(
  role?: AgentRole,
  tool?: ToolName
): void {
  rateGuardState.reset(role, tool);
}

/**
 * Get all rate limit configurations
 */
export function getRateLimitConfigs(): Record<
  ToolName,
  Record<AgentRole, RateLimitConfig>
> {
  return JSON.parse(JSON.stringify(DEFAULT_RATE_LIMITS));
}

/**
 * Update rate limit configuration for a role/tool
 */
export function setRateLimitConfig(
  tool: ToolName,
  role: AgentRole,
  config: RateLimitConfig
): void {
  DEFAULT_RATE_LIMITS[tool][role] = config;
}

// =============================================================================
// Batch Rate Guard
// =============================================================================

export interface BatchRateGuardResult {
  allAllowed: boolean;
  results: Array<{
    role: AgentRole;
    tool: ToolName;
    allowed: boolean;
    remaining: number;
  }>;
}

/**
 * Check rate limits for multiple calls
 */
export function batchRateGuard(
  calls: Array<{ role: AgentRole; tool: ToolName }>
): BatchRateGuardResult {
  const results = calls.map((call) => {
    const result = rateGuard(call.role, call.tool);
    return {
      role: call.role,
      tool: call.tool,
      allowed: result.allowed,
      remaining: result.remaining,
    };
  });
  
  return {
    allAllowed: results.every((r) => r.allowed),
    results,
  };
}
