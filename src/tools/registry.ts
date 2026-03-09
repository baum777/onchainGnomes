/**
 * Tool Registry
 * 
 * Central registry for all tool definitions with agent access control metadata.
 */

import type { ToolName, ToolDefinition, ToolRegistry } from "../types/tools.js";
import type { AgentRole, WorkflowPhase } from "../types/agentRouter.js";

// Extended tool definition with agent routing metadata
export interface AgentToolDefinition extends ToolDefinition {
  allowedRoles: AgentRole[];
  allowedPhases: WorkflowPhase[];
  requiresEvidence: boolean;
  methods: string[];
}

const toolDefinitions: Map<ToolName, AgentToolDefinition> = new Map([
  ["onchain", {
    name: "onchain",
    description: "Solana on-chain verification: mint info, largest accounts, supply",
    readOnly: true,
    supportedChains: ["solana"],
    allowedRoles: ["planner", "executor", "qa"],
    allowedPhases: ["discovery", "verification", "synthesis"],
    requiresEvidence: true,
    methods: ["getTokenMintInfo", "getLargestAccounts", "getSupply"],
  }],
  ["market", {
    name: "market",
    description: "Market data from DexScreener and GeckoTerminal: price, liquidity, volume",
    readOnly: true,
    supportedChains: ["solana"],
    allowedRoles: ["planner", "executor", "qa"],
    allowedPhases: ["discovery", "verification", "synthesis"],
    requiresEvidence: true,
    methods: ["getMarketData"],
  }],
  ["policy", {
    name: "policy",
    description: "CA validation and text sanitization for address safety",
    readOnly: true,
    supportedChains: ["solana", "evm"],
    allowedRoles: ["planner", "executor", "reviewer", "qa", "narrator"],
    allowedPhases: ["intake", "discovery", "verification", "synthesis", "output"],
    requiresEvidence: false,
    methods: ["validateCA", "sanitizeText"],
  }],
]);

export const toolRegistry: ToolRegistry & {
  getAgentTool(name: ToolName): AgentToolDefinition | undefined;
  listAgentTools(): AgentToolDefinition[];
  canRoleExecute(role: AgentRole, tool: ToolName): boolean;
  canExecuteInPhase(phase: WorkflowPhase, tool: ToolName): boolean;
} = {
  getTool(name: ToolName): ToolDefinition | undefined {
    return toolDefinitions.get(name);
  },

  listTools(): ToolDefinition[] {
    return Array.from(toolDefinitions.values());
  },

  // Agent-specific methods
  getAgentTool(name: ToolName): AgentToolDefinition | undefined {
    return toolDefinitions.get(name);
  },

  listAgentTools(): AgentToolDefinition[] {
    return Array.from(toolDefinitions.values());
  },

  canRoleExecute(role: AgentRole, tool: ToolName): boolean {
    const definition = toolDefinitions.get(tool);
    if (!definition) return false;
    return definition.allowedRoles.includes(role);
  },

  canExecuteInPhase(phase: WorkflowPhase, tool: ToolName): boolean {
    const definition = toolDefinitions.get(tool);
    if (!definition) return false;
    return definition.allowedPhases.includes(phase);
  },
};
