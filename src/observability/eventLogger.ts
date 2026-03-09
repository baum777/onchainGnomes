/**
 * Event Logger - Structured JSON Logging for Agent Tools
 * 
 * Records route decisions, execution outcomes, and policy violations.
 */

import type {
  RouteDecisionLog,
  RoutedToolCall,
  RoutedToolResult,
} from "../types/agentRouter.js";

export const eventLogger = {
  /**
   * Log a routing decision (Allow/Deny)
   */
  logRouteDecision(log: RouteDecisionLog): void {
    const output = JSON.stringify({
      event: "route_decision",
      ...log
    });
    console.log(output);
    // In production, this would write to a dedicated log stream or database
  },

  /**
   * Log a tool execution result
   */
  logToolExecution(
    call: RoutedToolCall,
    result: RoutedToolResult<any>
  ): void {
    const output = JSON.stringify({
      event: "tool_execution",
      requestId: result.requestId,
      role: result.role,
      tool: call.tool,
      method: call.method,
      success: result.success,
      classification: result.classification,
      confidence: result.confidence,
      latencyMs: result.latencyMs,
      timestamp: new Date().toISOString()
    });
    console.log(output);
  },

  /**
   * Log security/policy violations
   */
  logPolicyViolation(
    call: RoutedToolCall,
    violations: string[]
  ): void {
    const output = JSON.stringify({
      event: "policy_violation",
      requestId: call.requestId,
      role: call.role,
      tool: call.tool,
      violations,
      timestamp: new Date().toISOString()
    });
    console.warn(output);
  }
};
