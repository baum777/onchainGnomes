/**
 * Tool Registry
 * 
 * Central registry for all tool definitions.
 */

import type { ToolName, ToolDefinition, ToolRegistry } from "../types/tools.js";

const toolDefinitions: Map<ToolName, ToolDefinition> = new Map([
  ["onchain", {
    name: "onchain",
    description: "Solana on-chain verification: mint info, largest accounts, supply",
    readOnly: true,
    supportedChains: ["solana"],
  }],
  ["market", {
    name: "market",
    description: "Market data from DexScreener and GeckoTerminal: price, liquidity, volume",
    readOnly: true,
    supportedChains: ["solana"],
  }],
  ["policy", {
    name: "policy",
    description: "CA validation and text sanitization for address safety",
    readOnly: true,
    supportedChains: ["solana", "evm"],
  }],
]);

export const toolRegistry: ToolRegistry = {
  getTool(name: ToolName): ToolDefinition | undefined {
    return toolDefinitions.get(name);
  },

  listTools(): ToolDefinition[] {
    return Array.from(toolDefinitions.values());
  },
};
