/**
 * Agent Router Types - Multi-Agent Tool Routing System
 * 
 * Defines:
 * - Agent roles and workflow phases
 * - Tool permissions and access control
 * - Routed tool calls and results
 * - Route decision logging
 */

import { z } from "zod";
import type { ToolResult, Evidence } from "./tools.js";

// =============================================================================
// Agent Roles
// =============================================================================

export const AgentRoleSchema = z.enum([
  "planner",
  "executor", 
  "reviewer",
  "qa",
  "narrator",
]);

export type AgentRole = z.infer<typeof AgentRoleSchema>;

// =============================================================================
// Workflow Phases
// =============================================================================

export const WorkflowPhaseSchema = z.enum([
  "intake",
  "discovery",
  "verification",
  "synthesis",
  "output",
]);

export type WorkflowPhase = z.infer<typeof WorkflowPhaseSchema>;

// =============================================================================
// Tool Permission
// =============================================================================

export type ToolName = "onchain" | "market" | "policy";

export interface ToolPermission {
  tool: ToolName;
  allowedRoles: AgentRole[];
  allowedPhases: WorkflowPhase[];
  requiresEvidence: boolean;
  readOnly: boolean;
  description: string;
}

export const ToolPermissionSchema = z.object({
  tool: z.enum(["onchain", "market", "policy"]),
  allowedRoles: z.array(AgentRoleSchema),
  allowedPhases: z.array(WorkflowPhaseSchema),
  requiresEvidence: z.boolean(),
  readOnly: z.boolean(),
  description: z.string(),
});

// =============================================================================
// Routed Tool Call
// =============================================================================

export interface RoutedToolCall {
  requestId: string;
  timestamp: string;
  role: AgentRole;
  phase: WorkflowPhase;
  tool: ToolName;
  method: string;
  arguments: unknown;
  context?: {
    originalQuery?: string;
    validatedAddress?: string | null;
    sessionId?: string;
  };
}

export const RoutedToolCallSchema = z.object({
  requestId: z.string().uuid(),
  timestamp: z.string().datetime(),
  role: AgentRoleSchema,
  phase: WorkflowPhaseSchema,
  tool: z.enum(["onchain", "market", "policy"]),
  method: z.string(),
  arguments: z.unknown(),
  context: z.object({
    originalQuery: z.string().optional(),
    validatedAddress: z.string().nullable().optional(),
    sessionId: z.string().optional(),
  }).optional(),
});

// =============================================================================
// Routed Tool Result
// =============================================================================

export interface RoutedToolResult<T> extends ToolResult<T> {
  requestId: string;
  role: AgentRole;
  phase: WorkflowPhase;
  routedAt: string;
  permissionCheck: {
    passed: boolean;
    roleAllowed: boolean;
    phaseAllowed: boolean;
  };
  policyCheck: {
    passed: boolean;
    checks: string[];
    violations: string[];
  };
  guardCheck: {
    passed: boolean;
    rateLimitOk: boolean;
    circuitClosed: boolean;
  };
  evidenceAttached: boolean;
  confidence?: number;
  classification: "FACT" | "UNVERIFIED" | "OPINION" | "ERROR";
}

// =============================================================================
// Route Decision Log
// =============================================================================

export interface RouteDecisionLog {
  requestId: string;
  timestamp: string;
  role: AgentRole;
  phase: WorkflowPhase;
  tool: ToolName;
  method: string;
  decision: "ALLOWED" | "DENIED" | "GUARDED";
  reason: string;
  permissionResult: {
    roleAllowed: boolean;
    phaseAllowed: boolean;
  };
  policyResult: {
    passed: boolean;
    violations: string[];
  };
  guardResult: {
    rateLimitOk: boolean;
    circuitClosed: boolean;
  };
  latencyMs: number;
}

export const RouteDecisionLogSchema = z.object({
  requestId: z.string().uuid(),
  timestamp: z.string().datetime(),
  role: AgentRoleSchema,
  phase: WorkflowPhaseSchema,
  tool: z.enum(["onchain", "market", "policy"]),
  method: z.string(),
  decision: z.enum(["ALLOWED", "DENIED", "GUARDED"]),
  reason: z.string(),
  permissionResult: z.object({
    roleAllowed: z.boolean(),
    phaseAllowed: z.boolean(),
  }),
  policyResult: z.object({
    passed: z.boolean(),
    violations: z.array(z.string()),
  }),
  guardResult: z.object({
    rateLimitOk: z.boolean(),
    circuitClosed: z.boolean(),
  }),
  latencyMs: z.number().int().min(0),
});

// =============================================================================
// Router Configuration
// =============================================================================

export interface AgentRouterConfig {
  enforceStrictMode: boolean;
  logAllDecisions: boolean;
  requireEvidenceForFacts: boolean;
  defaultRateLimit: {
    requests: number;
    windowMs: number;
  };
  circuitBreaker: {
    failureThreshold: number;
    resetTimeoutMs: number;
    halfOpenMaxCalls: number;
  };
}

export const AgentRouterConfigSchema = z.object({
  enforceStrictMode: z.boolean().default(true),
  logAllDecisions: z.boolean().default(true),
  requireEvidenceForFacts: z.boolean().default(true),
  defaultRateLimit: z.object({
    requests: z.number().int().min(1).default(10),
    windowMs: z.number().int().min(1000).default(1000),
  }),
  circuitBreaker: z.object({
    failureThreshold: z.number().int().min(1).default(5),
    resetTimeoutMs: z.number().int().min(1000).default(30000),
    halfOpenMaxCalls: z.number().int().min(1).default(3),
  }),
});

// =============================================================================
// Agent Tool Router Interface
// =============================================================================

export interface AgentToolRouter {
  route<T>(call: RoutedToolCall): Promise<RoutedToolResult<T>>;
  canAccess(role: AgentRole, phase: WorkflowPhase, tool: ToolName): boolean;
  getPermissions(tool: ToolName): ToolPermission | undefined;
  listPermissions(): ToolPermission[];
  getConfig(): AgentRouterConfig;
  setConfig(config: Partial<AgentRouterConfig>): void;
}

// =============================================================================
// Helper Types
// =============================================================================

export type RouteDecision = "ALLOWED" | "DENIED" | "GUARDED";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface GuardResult {
  passed: boolean;
  rateLimit: {
    allowed: boolean;
    remaining: number;
    resetAt: string;
  };
  circuitBreaker: {
    closed: boolean;
    state: "CLOSED" | "OPEN" | "HALF_OPEN";
    failureCount: number;
  };
}

export interface PolicyCheckResult {
  passed: boolean;
  checksPerformed: string[];
  violations: string[];
  sanitized?: {
    original: string;
    sanitized: string;
    modifications: Array<{
      type: string;
      position: number;
      original?: string;
      replacement: string;
    }>;
  };
}
