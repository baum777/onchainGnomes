/**
 * Tool Orchestrator
 * 
 * Coordinates tool execution with sequencing, parallelism, and caching.
 */

import { randomUUID } from "node:crypto";
import type {
  ToolCall,
  ToolResult,
  OrchestratorConfig,
  ToolOrchestrator,
  PipelineContext,
  ToolName,
  Evidence,
} from "../types/tools.js";
import { createErrorResult } from "../types/tools.js";
import { toolRegistry } from "./registry.js";
import { onchainToolInterface } from "./onchainTool.js";
import { marketToolInterface } from "./marketTool.js";
import { policyToolInterface } from "./policyTool.js";

const DEFAULT_CONFIG: OrchestratorConfig = {
  enableParallelExecution: true,
  maxConcurrentCalls: 5,
  defaultTimeoutMs: 30000,
  enableCaching: false,
  cacheTtlMs: 60000,
};

export function createOrchestrator(
  config?: Partial<OrchestratorConfig>
): ToolOrchestrator {
  let currentConfig: OrchestratorConfig = { ...DEFAULT_CONFIG, ...config };

  async function execute<T>(call: ToolCall): Promise<ToolResult<T>> {
    const definition = toolRegistry.getTool(call.tool);
    if (!definition) {
      return createErrorResult<T>(
        "INVALID_INPUT",
        `Unknown tool: ${call.tool}`,
        0
      );
    }

    try {
      return await dispatchCall<T>(call);
    } catch (error) {
      return createErrorResult<T>(
        "UNEXPECTED",
        error instanceof Error ? error.message : String(error),
        0
      );
    }
  }

  async function executeSequential<T>(calls: ToolCall[]): Promise<ToolResult<T>[]> {
    const results: ToolResult<T>[] = [];
    for (const call of calls) {
      results.push(await execute<T>(call));
    }
    return results;
  }

  async function executeParallel<T>(calls: ToolCall[]): Promise<ToolResult<T>[]> {
    if (!currentConfig.enableParallelExecution) {
      return executeSequential<T>(calls);
    }

    // Limit concurrency
    const chunks: ToolCall[][] = [];
    for (let i = 0; i < calls.length; i += currentConfig.maxConcurrentCalls) {
      chunks.push(calls.slice(i, i + currentConfig.maxConcurrentCalls));
    }

    const allResults: ToolResult<T>[] = [];
    for (const chunk of chunks) {
      const results = await Promise.all(chunk.map(c => execute<T>(c)));
      allResults.push(...results);
    }
    return allResults;
  }

  return {
    execute,
    executeSequential,
    executeParallel,
    getConfig: () => ({ ...currentConfig }),
    setConfig: (c) => { currentConfig = { ...currentConfig, ...c }; },
  };
}

async function dispatchCall<T>(call: ToolCall): Promise<ToolResult<T>> {
  const input = call.input as any;

  switch (call.tool) {
    case "onchain": {
      const method = input?.method as string;
      const mint = input?.mint as string;

      if (method === "getTokenMintInfo") {
        return onchainToolInterface.getTokenMintInfo(mint) as Promise<ToolResult<T>>;
      }
      if (method === "getLargestAccounts") {
        return onchainToolInterface.getLargestAccounts(mint) as Promise<ToolResult<T>>;
      }
      if (method === "getSupply") {
        return onchainToolInterface.getSupply(mint) as Promise<ToolResult<T>>;
      }
      return createErrorResult<T>("INVALID_INPUT", `Unknown onchain method: ${method}`, 0);
    }

    case "market": {
      return marketToolInterface.getMarketData(
        input?.mint,
        input?.options
      ) as Promise<ToolResult<T>>;
    }

    case "policy": {
      const method = input?.method as string;
      if (method === "validateCA") {
        return policyToolInterface.validateCA(
          input?.address,
          input?.options
        ) as Promise<ToolResult<T>>;
      }
      if (method === "sanitizeText") {
        return policyToolInterface.sanitizeText(
          input?.text,
          input?.options
        ) as Promise<ToolResult<T>>;
      }
      return createErrorResult<T>("INVALID_INPUT", `Unknown policy method: ${method}`, 0);
    }

    default:
      return createErrorResult<T>("INVALID_INPUT", `Unhandled tool: ${call.tool}`, 0);
  }
}

export function createPipelineContext(): PipelineContext {
  return {
    requestId: randomUUID(),
    timestamp: new Date().toISOString(),
    validatedAddress: null,
    toolResults: new Map(),
    evidence: [],
    errors: [],
  };
}
