/**
 * Circuit Guard - Circuit Breaker Pattern for Tool Execution
 * 
 * Implements circuit breaker pattern per adapter/tool to prevent
 * cascading failures and provide graceful degradation.
 */

import type { ToolName } from "../../types/agentRouter.js";

// =============================================================================
// Circuit Breaker State
// =============================================================================

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxCalls: number;
}

export interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  halfOpenCalls: number;
}

// Default configuration
const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenMaxCalls: 3,
};

// =============================================================================
// Circuit Guard State Management
// =============================================================================

class CircuitGuardState {
  private circuits: Map<ToolName, CircuitBreakerState> = new Map();
  private configs: Map<ToolName, CircuitBreakerConfig> = new Map();
  
  getState(tool: ToolName): CircuitBreakerState {
    let state = this.circuits.get(tool);
    
    if (!state) {
      state = {
        state: "CLOSED",
        failureCount: 0,
        successCount: 0,
        lastFailureTime: null,
        lastSuccessTime: null,
        halfOpenCalls: 0,
      };
      this.circuits.set(tool, state);
    }
    
    return state;
  }
  
  updateState(tool: ToolName, state: CircuitBreakerState): void {
    this.circuits.set(tool, state);
  }
  
  getConfig(tool: ToolName): CircuitBreakerConfig {
    return this.configs.get(tool) || DEFAULT_CIRCUIT_CONFIG;
  }
  
  setConfig(tool: ToolName, config: CircuitBreakerConfig): void {
    this.configs.set(tool, config);
  }
  
  reset(tool?: ToolName): void {
    if (tool) {
      this.circuits.delete(tool);
    } else {
      this.circuits.clear();
    }
  }
}

const circuitGuardState = new CircuitGuardState();

// =============================================================================
// Circuit State Transitions
// =============================================================================

function shouldTransitionToHalfOpen(
  state: CircuitBreakerState,
  config: CircuitBreakerConfig
): boolean {
  if (state.state !== "OPEN") {
    return false;
  }
  
  if (!state.lastFailureTime) {
    return true;
  }
  
  const now = Date.now();
  return now - state.lastFailureTime >= config.resetTimeoutMs;
}

function transitionState(
  state: CircuitBreakerState,
  config: CircuitBreakerConfig
): CircuitBreakerState {
  // Check for OPEN -> HALF_OPEN transition
  if (shouldTransitionToHalfOpen(state, config)) {
    return {
      ...state,
      state: "HALF_OPEN",
      halfOpenCalls: 0,
    };
  }
  
  return state;
}

// =============================================================================
// Circuit Guard Functions
// =============================================================================

export interface CircuitGuardResult {
  closed: boolean;
  state: CircuitState;
  canExecute: boolean;
  failureCount: number;
  successCount: number;
  lastFailureTime: string | null;
  timeUntilReset: number | null;
}

/**
 * Check if a tool can be executed (circuit breaker check)
 */
export function circuitGuard(tool: ToolName): CircuitGuardResult {
  const config = circuitGuardState.getConfig(tool);
  let state = circuitGuardState.getState(tool);
  
  // Check for state transitions
  state = transitionState(state, config);
  
  // Determine if execution is allowed
  let canExecute = false;
  
  switch (state.state) {
    case "CLOSED":
      canExecute = true;
      break;
      
    case "HALF_OPEN":
      if (state.halfOpenCalls < config.halfOpenMaxCalls) {
        canExecute = true;
        state.halfOpenCalls++;
      }
      break;
      
    case "OPEN":
      canExecute = false;
      break;
  }
  
  // Update state
  circuitGuardState.updateState(tool, state);
  
  // Calculate time until reset
  let timeUntilReset: number | null = null;
  if (state.state === "OPEN" && state.lastFailureTime) {
    const elapsed = Date.now() - state.lastFailureTime;
    timeUntilReset = Math.max(0, config.resetTimeoutMs - elapsed);
  }
  
  return {
    closed: state.state === "CLOSED",
    state: state.state,
    canExecute,
    failureCount: state.failureCount,
    successCount: state.successCount,
    lastFailureTime: state.lastFailureTime
      ? new Date(state.lastFailureTime).toISOString()
      : null,
    timeUntilReset,
  };
}

/**
 * Record a successful tool execution
 */
export function recordSuccess(tool: ToolName): void {
  const config = circuitGuardState.getConfig(tool);
  const state = circuitGuardState.getState(tool);
  
  const newState: CircuitBreakerState = {
    ...state,
    successCount: state.successCount + 1,
    lastSuccessTime: Date.now(),
  };
  
  // Transition HALF_OPEN -> CLOSED on success
  if (state.state === "HALF_OPEN") {
    newState.state = "CLOSED";
    newState.failureCount = 0;
    newState.halfOpenCalls = 0;
  }
  
  circuitGuardState.updateState(tool, newState);
}

/**
 * Record a failed tool execution
 */
export function recordFailure(tool: ToolName): void {
  const config = circuitGuardState.getConfig(tool);
  const state = circuitGuardState.getState(tool);
  
  const newFailureCount = state.failureCount + 1;
  const shouldOpen = newFailureCount >= config.failureThreshold;
  
  const newState: CircuitBreakerState = {
    ...state,
    failureCount: newFailureCount,
    lastFailureTime: Date.now(),
    state: shouldOpen ? "OPEN" : state.state,
  };
  
  // Reset half-open calls on failure in HALF_OPEN state
  if (state.state === "HALF_OPEN") {
    newState.halfOpenCalls = 0;
  }
  
  circuitGuardState.updateState(tool, newState);
}

/**
 * Get current circuit state for a tool
 */
export function getCircuitState(tool: ToolName): CircuitGuardResult {
  return circuitGuard(tool);
}

/**
 * Get all circuit states
 */
export function getAllCircuitStates(): Array<{
  tool: ToolName;
  state: CircuitGuardResult;
}> {
  const tools: ToolName[] = ["onchain", "market", "policy"];
  return tools.map((tool) => ({
    tool,
    state: getCircuitState(tool),
  }));
}

/**
 * Reset circuit breaker for a tool
 */
export function resetCircuit(tool?: ToolName): void {
  circuitGuardState.reset(tool);
}

/**
 * Configure circuit breaker for a tool
 */
export function configureCircuit(
  tool: ToolName,
  config: Partial<CircuitBreakerConfig>
): void {
  const currentConfig = circuitGuardState.getConfig(tool);
  circuitGuardState.setConfig(tool, { ...currentConfig, ...config });
}

/**
 * Force open a circuit (emergency stop)
 */
export function forceOpenCircuit(tool: ToolName, reason?: string): void {
  const state = circuitGuardState.getState(tool);
  circuitGuardState.updateState(tool, {
    ...state,
    state: "OPEN",
    lastFailureTime: Date.now(),
  });
}

/**
 * Force close a circuit (manual recovery)
 */
export function forceCloseCircuit(tool: ToolName): void {
  circuitGuardState.reset(tool);
}

// =============================================================================
// Health Check
// =============================================================================

export interface CircuitHealth {
  tool: ToolName;
  healthy: boolean;
  state: CircuitState;
  failureRate: number;
  recommendation: string;
}

/**
 * Get health status for all circuits
 */
export function getCircuitHealth(): CircuitHealth[] {
  const tools: ToolName[] = ["onchain", "market", "policy"];
  
  return tools.map((tool) => {
    const state = circuitGuardState.getState(tool);
    const totalCalls = state.successCount + state.failureCount;
    const failureRate = totalCalls > 0 ? state.failureCount / totalCalls : 0;
    
    let healthy = true;
    let recommendation = "Operating normally";
    
    if (state.state === "OPEN") {
      healthy = false;
      recommendation = "Circuit is OPEN - tool is temporarily unavailable";
    } else if (failureRate > 0.5) {
      healthy = false;
      recommendation = "High failure rate detected - monitor closely";
    } else if (state.failureCount > 3) {
      recommendation = "Elevated failure count - may trip soon";
    }
    
    return {
      tool,
      healthy,
      state: state.state,
      failureRate,
      recommendation,
    };
  });
}
