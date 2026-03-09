/**
 * Agent Tool Router - Central Routing Layer for Multi-Agent Execution
 * 
 * Controls which agent roles may call which tools, in which workflow phases,
 * under which policy and guard conditions.
 * 
 * CRITICAL: Narrator cannot directly call onchain or market tools.
 */

import { randomUUID } from "node:crypto";
import type {
  AgentRole,
  WorkflowPhase,
  ToolName,
  RoutedToolCall,
  RoutedToolResult,
  AgentRouterConfig,
  RouteDecisionLog,
  RouteDecision,
  GuardResult,
} from "../types/agentRouter.js";
import type { ToolResult } from "../types/tools.js";
import { classifyOutput } from "../types/evidence.js";
import {
  canAccess,
  getPermissionViolationMessage,
} from "./permissions.js";
import {
  runPolicyChecks,
  shouldBlockImmediately,
} from "./policyChecks.js";
import { rateGuard } from "../tools/guards/rateGuard.js";
import { circuitGuard, recordSuccess, recordFailure } from "../tools/guards/circuitGuard.js";
import { toolRegistry } from "../tools/registry.js";
import { onchainToolInterface } from "../tools/onchainTool.js";
import { marketToolInterface } from "../tools/marketTool.js";
import { policyToolInterface } from "../tools/policyTool.js";

// =============================================================================
// Router Configuration
// =============================================================================

const DEFAULT_CONFIG: AgentRouterConfig = {
  enforceStrictMode: true,
  logAllDecisions: true,
  requireEvidenceForFacts: true,
  defaultRateLimit: {
    requests: 10,
    windowMs: 1000,
  },
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    halfOpenMaxCalls: 3,
  },
};

// =============================================================================
// Agent Tool Router Implementation
// =============================================================================

export class AgentToolRouter {
  private config: AgentRouterConfig;
  private decisionLogs: RouteDecisionLog[] = [];
  
  constructor(config?: Partial<AgentRouterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Route a tool call through permission, policy, and guard checks
   */
  async route<T>(call: RoutedToolCall): Promise<RoutedToolResult<T>> {
    const startTime = Date.now();
    const requestId = call.requestId || randomUUID();
    
    // Initialize result structure
    const baseResult: Partial<RoutedToolResult<T>> = {
      requestId,
      role: call.role,
      phase: call.phase,
      routedAt: new Date().toISOString(),
      success: false,
      data: null,
      evidence: null,
      latencyMs: 0,
      classification: "ERROR",
      evidenceAttached: false,
    };
    
    try {
      // Step 1: Permission Check
      const permissionResult = this.checkPermission(call);
      baseResult.permissionCheck = permissionResult;
      
      if (!permissionResult.passed) {
        const denialResult = this.createDenialResult(
          baseResult,
          permissionResult,
          "Permission denied"
        );
        await this.logDecision(call, "DENIED", "Permission check failed", startTime);
        return denialResult as RoutedToolResult<T>;
      }
      
      // Step 2: Immediate Block Check
      const blockCheck = shouldBlockImmediately(call);
      if (blockCheck.block) {
        const blockResult = this.createDenialResult(
          baseResult,
          permissionResult,
          blockCheck.reason || "Blocked by security policy"
        );
        await this.logDecision(call, "DENIED", blockCheck.reason || "Security block", startTime);
        return blockResult as RoutedToolResult<T>;
      }
      
      // Step 3: Policy Check
      const policyResult = await runPolicyChecks(call);
      baseResult.policyCheck = {
        passed: policyResult.passed,
        checks: policyResult.checksPerformed,
        violations: policyResult.violations,
      };
      
      if (!policyResult.passed && this.config.enforceStrictMode) {
        const policyDenial = this.createDenialResult(
          baseResult,
          permissionResult,
          `Policy violations: ${policyResult.violations.join(", ")}`
        );
        await this.logDecision(call, "DENIED", "Policy check failed", startTime);
        return policyDenial as RoutedToolResult<T>;
      }
      
      // Step 4: Guard Check (Rate + Circuit)
      const guardResult = this.runGuardChecks(call);
      baseResult.guardCheck = {
        passed: guardResult.passed,
        rateLimitOk: guardResult.rateLimit.allowed,
        circuitClosed: guardResult.circuitBreaker.closed,
      };
      
      if (!guardResult.passed) {
        const guardDenial = this.createDenialResult(
          baseResult,
          permissionResult,
          this.getGuardFailureReason(guardResult)
        );
        await this.logDecision(call, "GUARDED", "Guard check failed", startTime);
        return guardDenial as RoutedToolResult<T>;
      }
      
      // Step 5: Execute Tool
      const executionResult = await this.executeTool<T>(call);
      
      // Step 6: Record success/failure for circuit breaker
      if (executionResult.success) {
        recordSuccess(call.tool);
      } else {
        recordFailure(call.tool);
      }
      
      // Step 7: Build final result
      const finalResult: RoutedToolResult<T> = {
        ...baseResult,
        success: executionResult.success,
        data: executionResult.data,
        evidence: executionResult.evidence,
        error: executionResult.error,
        latencyMs: Date.now() - startTime,
        evidenceAttached: executionResult.evidence !== null,
        confidence: this.calculateConfidence(executionResult),
        classification: classifyOutput(
          executionResult.success,
          executionResult.evidence !== null,
          this.calculateConfidence(executionResult)
        ),
      } as RoutedToolResult<T>;
      
      await this.logDecision(call, "ALLOWED", "Execution successful", startTime);
      return finalResult;
      
    } catch (error) {
      // Handle unexpected errors
      const errorResult: RoutedToolResult<T> = {
        ...baseResult,
        success: false,
        error: {
          code: "UNEXPECTED",
          message: error instanceof Error ? error.message : "Unknown router error",
        },
        latencyMs: Date.now() - startTime,
        classification: "ERROR",
      } as RoutedToolResult<T>;
      
      recordFailure(call.tool);
      await this.logDecision(call, "DENIED", "Router exception", startTime);
      return errorResult;
    }
  }
  
  // ===========================================================================
  // Permission Check
  // ===========================================================================
  
  private checkPermission(call: RoutedToolCall): {
    passed: boolean;
    roleAllowed: boolean;
    phaseAllowed: boolean;
  } {
    const result = canAccess(call.role, call.phase, call.tool);
    return {
      passed: result.allowed,
      roleAllowed: result.allowed || !result.reason?.includes("Role"),
      phaseAllowed: result.allowed || !result.reason?.includes("phase"),
    };
  }
  
  // ===========================================================================
  // Guard Checks
  // ===========================================================================
  
  private runGuardChecks(call: RoutedToolCall): GuardResult {
    const rateResult = rateGuard(call.role, call.tool);
    const circuitResult = circuitGuard(call.tool);
    
    return {
      passed: rateResult.allowed && circuitResult.canExecute,
      rateLimit: {
        allowed: rateResult.allowed,
        remaining: rateResult.remaining,
        resetAt: rateResult.resetAt,
      },
      circuitBreaker: {
        closed: circuitResult.closed,
        state: circuitResult.state,
        failureCount: circuitResult.failureCount,
      },
    };
  }
  
  private getGuardFailureReason(guardResult: GuardResult): string {
    if (!guardResult.rateLimit.allowed) {
      return "Rate limit exceeded";
    }
    if (!guardResult.circuitBreaker.closed) {
      return `Circuit breaker is ${guardResult.circuitBreaker.state}`;
    }
    return "Guard check failed";
  }
  
  // ===========================================================================
  // Tool Execution
  // ===========================================================================
  
  private async executeTool<T>(call: RoutedToolCall): Promise<ToolResult<T>> {
    const args = call.arguments as Record<string, unknown>;
    
    switch (call.tool) {
      case "onchain": {
        return this.executeOnchainTool<T>(call.method, args);
      }
      
      case "market": {
        return this.executeMarketTool<T>(args);
      }
      
      case "policy": {
        return this.executePolicyTool<T>(call.method, args);
      }
      
      default:
        return {
          success: false,
          data: null,
          evidence: null,
          error: {
            code: "INVALID_INPUT",
            message: `Unknown tool: ${call.tool}`,
          },
          latencyMs: 0,
        };
    }
  }
  
  private async executeOnchainTool<T>(
    method: string,
    args: Record<string, unknown>
  ): Promise<ToolResult<T>> {
    const mint = args.mint as string;
    
    switch (method) {
      case "getTokenMintInfo":
        return onchainToolInterface.getTokenMintInfo(mint) as Promise<ToolResult<T>>;
      case "getLargestAccounts":
        return onchainToolInterface.getLargestAccounts(mint) as Promise<ToolResult<T>>;
      case "getSupply":
        return onchainToolInterface.getSupply(mint) as Promise<ToolResult<T>>;
      default:
        return {
          success: false,
          data: null,
          evidence: null,
          error: { code: "INVALID_INPUT", message: `Unknown method: ${method}` },
          latencyMs: 0,
        };
    }
  }
  
  private async executeMarketTool<T>(
    args: Record<string, unknown>
  ): Promise<ToolResult<T>> {
    const mint = args.mint as string;
    const options = args.options as { sources?: string[] } | undefined;
    
    return marketToolInterface.getMarketData(mint, {
      sources: options?.sources as any,
    }) as Promise<ToolResult<T>>;
  }
  
  private async executePolicyTool<T>(
    method: string,
    args: Record<string, unknown>
  ): Promise<ToolResult<T>> {
    switch (method) {
      case "validateCA": {
        const address = args.address as string;
        return policyToolInterface.validateCA(address) as Promise<ToolResult<T>>;
      }
      case "sanitizeText": {
        const text = args.text as string;
        const options = args.options as { allowlist?: string[]; prompt?: string } | undefined;
        return policyToolInterface.sanitizeText(text, {
          allowlist: options?.allowlist ? new Set(options.allowlist) : undefined,
          prompt: options?.prompt,
        }) as Promise<ToolResult<T>>;
      }
      default:
        return {
          success: false,
          data: null,
          evidence: null,
          error: { code: "INVALID_INPUT", message: `Unknown method: ${method}` },
          latencyMs: 0,
        };
    }
  }
  
  // ===========================================================================
  // Helper Methods
  // ===========================================================================
  
  private createDenialResult<T>(
    base: Partial<RoutedToolResult<T>>,
    permissionCheck: { passed: boolean; roleAllowed: boolean; phaseAllowed: boolean },
    reason: string
  ): Partial<RoutedToolResult<T>> {
    return {
      ...base,
      success: false,
      error: {
        code: "PERMISSION_DENIED",
        message: reason,
      },
      classification: "ERROR",
    };
  }
  
  private calculateConfidence<T>(result: ToolResult<T>): number {
    if (!result.success || !result.evidence) {
      return 0;
    }
    
    // Base confidence from success
    let confidence = 0.5;
    
    // Increase if evidence present
    if (result.evidence) {
      confidence += 0.3;
    }
    
    // Increase if low latency (< 1s)
    if (result.latencyMs < 1000) {
      confidence += 0.1;
    }
    
    // Decrease if high latency (> 5s)
    if (result.latencyMs > 5000) {
      confidence -= 0.1;
    }
    
    return Math.max(0, Math.min(1, confidence));
  }
  
  // ===========================================================================
  // Logging
  // ===========================================================================
  
  private async logDecision(
    call: RoutedToolCall,
    decision: RouteDecision,
    reason: string,
    startTime: number
  ): Promise<void> {
    if (!this.config.logAllDecisions) {
      return;
    }
    
    const permissionCheck = this.checkPermission(call);
    const guardResult = this.runGuardChecks(call);
    const policyResult = await runPolicyChecks(call);
    
    const log: RouteDecisionLog = {
      requestId: call.requestId,
      timestamp: new Date().toISOString(),
      role: call.role,
      phase: call.phase,
      tool: call.tool,
      method: call.method,
      decision,
      reason,
      permissionResult: {
        roleAllowed: permissionCheck.roleAllowed,
        phaseAllowed: permissionCheck.phaseAllowed,
      },
      policyResult: {
        passed: policyResult.passed,
        violations: policyResult.violations,
      },
      guardResult: {
        rateLimitOk: guardResult.rateLimit.allowed,
        circuitClosed: guardResult.circuitBreaker.closed,
      },
      latencyMs: Date.now() - startTime,
    };
    
    this.decisionLogs.push(log);
    
    // Also log to console in development
    if (process.env.NODE_ENV !== "production") {
      console.log(`[ROUTER] ${decision}: ${call.role} -> ${call.tool}.${call.method} (${reason})`);
    }
  }
  
  // ===========================================================================
  // Public API
  // ===========================================================================
  
  canAccess(role: AgentRole, phase: WorkflowPhase, tool: ToolName): boolean {
    return canAccess(role, phase, tool).allowed;
  }
  
  getPermissions(tool: ToolName) {
    return toolRegistry.getTool(tool);
  }
  
  listPermissions() {
    return toolRegistry.listTools();
  }
  
  getConfig(): AgentRouterConfig {
    return { ...this.config };
  }
  
  setConfig(config: Partial<AgentRouterConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  getDecisionLogs(): RouteDecisionLog[] {
    return [...this.decisionLogs];
  }
  
  clearDecisionLogs(): void {
    this.decisionLogs = [];
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let globalRouter: AgentToolRouter | null = null;

export function getAgentRouter(config?: Partial<AgentRouterConfig>): AgentToolRouter {
  if (!globalRouter) {
    globalRouter = new AgentToolRouter(config);
  }
  return globalRouter;
}

export function resetAgentRouter(): void {
  globalRouter = null;
}
