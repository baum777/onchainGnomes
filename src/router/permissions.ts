/**
 * Router Permissions - Role and Phase Based Access Control
 * 
 * Defines the PERMISSION_MATRIX that controls which agent roles
 * may call which tools in which workflow phases.
 * 
 * CRITICAL RULE: Narrator CANNOT directly call onchain or market tools.
 */

import type {
  AgentRole,
  WorkflowPhase,
  ToolPermission,
  ToolName,
} from "../types/agentRouter.js";

// =============================================================================
// Permission Matrix
// =============================================================================

/**
 * The permission matrix defines access control for all tool combinations.
 * 
 * Rules:
 * 1. planner: Can plan tool calls but not execute (discovery phase)
 * 2. executor: Can execute all tools (verification phase)
 * 3. reviewer: Can review results but not call tools (synthesis phase)
 * 4. qa: Can call policy tools for validation (all phases)
 * 5. narrator: CANNOT call onchain/market directly (output phase only)
 */
export const PERMISSION_MATRIX: ToolPermission[] = [
  // Onchain Tool Permissions
  {
    tool: "onchain",
    allowedRoles: ["planner", "executor", "qa"],
    allowedPhases: ["discovery", "verification", "synthesis"],
    requiresEvidence: true,
    readOnly: true,
    description: "Solana on-chain verification: mint info, supply, largest accounts",
  },
  
  // Market Tool Permissions
  {
    tool: "market",
    allowedRoles: ["planner", "executor", "qa"],
    allowedPhases: ["discovery", "verification", "synthesis"],
    requiresEvidence: true,
    readOnly: true,
    description: "Market data from DexScreener and GeckoTerminal",
  },
  
  // Policy Tool Permissions
  {
    tool: "policy",
    allowedRoles: ["planner", "executor", "reviewer", "qa", "narrator"],
    allowedPhases: ["intake", "discovery", "verification", "synthesis", "output"],
    requiresEvidence: false,
    readOnly: true,
    description: "CA validation and text sanitization for address safety",
  },
];

// =============================================================================
// Permission Check Functions
// =============================================================================

/**
 * Check if a role can access a tool
 */
export function canRoleAccessTool(role: AgentRole, tool: ToolName): boolean {
  const permission = PERMISSION_MATRIX.find((p) => p.tool === tool);
  if (!permission) {
    return false;
  }
  return permission.allowedRoles.includes(role);
}

/**
 * Check if a tool can be used in a phase
 */
export function canUseToolInPhase(phase: WorkflowPhase, tool: ToolName): boolean {
  const permission = PERMISSION_MATRIX.find((p) => p.tool === tool);
  if (!permission) {
    return false;
  }
  return permission.allowedPhases.includes(phase);
}

/**
 * Check if a role can access a tool in a specific phase
 */
export function canAccess(
  role: AgentRole,
  phase: WorkflowPhase,
  tool: ToolName
): { allowed: boolean; reason?: string } {
  const permission = PERMISSION_MATRIX.find((p) => p.tool === tool);
  
  if (!permission) {
    return {
      allowed: false,
      reason: `Unknown tool: ${tool}`,
    };
  }
  
  const roleAllowed = permission.allowedRoles.includes(role);
  const phaseAllowed = permission.allowedPhases.includes(phase);
  
  if (!roleAllowed && !phaseAllowed) {
    return {
      allowed: false,
      reason: `Role '${role}' cannot access tool '${tool}' in phase '${phase}'`,
    };
  }
  
  if (!roleAllowed) {
    return {
      allowed: false,
      reason: `Role '${role}' is not allowed to access tool '${tool}'`,
    };
  }
  
  if (!phaseAllowed) {
    return {
      allowed: false,
      reason: `Tool '${tool}' cannot be used in phase '${phase}'`,
    };
  }
  
  return { allowed: true };
}

/**
 * Get all tools accessible by a role
 */
export function getToolsForRole(role: AgentRole): ToolName[] {
  return PERMISSION_MATRIX
    .filter((p) => p.allowedRoles.includes(role))
    .map((p) => p.tool);
}

/**
 * Get all tools usable in a phase
 */
export function getToolsForPhase(phase: WorkflowPhase): ToolName[] {
  return PERMISSION_MATRIX
    .filter((p) => p.allowedPhases.includes(phase))
    .map((p) => p.tool);
}

/**
 * Get permission details for a tool
 */
export function getPermission(tool: ToolName): ToolPermission | undefined {
  return PERMISSION_MATRIX.find((p) => p.tool === tool);
}

/**
 * List all permissions
 */
export function listPermissions(): ToolPermission[] {
  return [...PERMISSION_MATRIX];
}

// =============================================================================
// Special Role Checks
// =============================================================================

/**
 * Check if role is a narrator (restricted access)
 */
export function isNarrator(role: AgentRole): boolean {
  return role === "narrator";
}

/**
 * Check if role can execute tools (vs just plan/review)
 */
export function canExecuteTools(role: AgentRole): boolean {
  return ["executor", "qa"].includes(role);
}

/**
 * Check if role requires evidence for claims
 */
export function requiresEvidence(role: AgentRole): boolean {
  return role !== "narrator";
}

// =============================================================================
// Phase Transition Validation
// =============================================================================

const VALID_PHASE_TRANSITIONS: Record<WorkflowPhase, WorkflowPhase[]> = {
  intake: ["discovery"],
  discovery: ["verification", "intake"],
  verification: ["synthesis", "discovery"],
  synthesis: ["output", "verification"],
  output: ["intake"],
};

/**
 * Check if a phase transition is valid
 */
export function isValidPhaseTransition(
  from: WorkflowPhase,
  to: WorkflowPhase
): boolean {
  if (from === to) {
    return true;
  }
  return VALID_PHASE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get valid next phases from current phase
 */
export function getValidNextPhases(from: WorkflowPhase): WorkflowPhase[] {
  return VALID_PHASE_TRANSITIONS[from] ?? [];
}

// =============================================================================
// Permission Violation Messages
// =============================================================================

export function getPermissionViolationMessage(
  role: AgentRole,
  phase: WorkflowPhase,
  tool: ToolName
): string {
  const permission = PERMISSION_MATRIX.find((p) => p.tool === tool);
  
  if (!permission) {
    return `Access denied: Tool '${tool}' does not exist in permission matrix`;
  }
  
  if (role === "narrator" && (tool === "onchain" || tool === "market")) {
    return `Security violation: Narrator cannot directly access ${tool} tools. Use executor role or work with pre-verified facts.`;
  }
  
  if (!permission.allowedRoles.includes(role)) {
    return `Access denied: Role '${role}' is not permitted to use tool '${tool}'. Allowed roles: ${permission.allowedRoles.join(", ")}`;
  }
  
  if (!permission.allowedPhases.includes(phase)) {
    return `Access denied: Tool '${tool}' cannot be used in phase '${phase}'. Allowed phases: ${permission.allowedPhases.join(", ")}`;
  }
  
  return `Access denied: Unknown permission violation for ${role} accessing ${tool} in ${phase}`;
}
