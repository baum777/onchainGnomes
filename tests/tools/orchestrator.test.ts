import { describe, it, expect, vi, beforeEach } from "vitest";
import { createOrchestrator, createPipelineContext } from "../../src/tools/orchestrator.js";
import type { ToolCall } from "../../src/types/tools.js";

// Mock the tool interfaces so orchestrator tests don't make real calls
vi.mock("../../src/tools/onchainTool.js", () => ({
  onchainToolInterface: {
    getTokenMintInfo: vi.fn().mockResolvedValue({
      success: true,
      data: { mint: "test", decimals: 9, supply: "1000", isInitialized: true, freezeAuthority: null, mintAuthority: null },
      evidence: { source: "solana_rpc", slot: 100, timestamp: new Date().toISOString(), signature: null },
      latencyMs: 50,
    }),
    getLargestAccounts: vi.fn().mockResolvedValue({
      success: true,
      data: { mint: "test", accounts: [] },
      evidence: { source: "solana_rpc", slot: 100, timestamp: new Date().toISOString(), signature: null },
      latencyMs: 50,
    }),
    getSupply: vi.fn().mockResolvedValue({
      success: true,
      data: { mint: "test", total: "1000", circulating: null, nonCirculating: null },
      evidence: { source: "solana_rpc", slot: 100, timestamp: new Date().toISOString(), signature: null },
      latencyMs: 50,
    }),
  }
}));

vi.mock("../../src/tools/marketTool.js", () => ({
  marketToolInterface: {
    getMarketData: vi.fn().mockResolvedValue({
      success: true,
      data: { mint: "test", priceUsd: 1.5, liquidityUsd: 100000, volume24hUsd: 50000, marketCap: 1000000, priceChange24h: -2.5, pairAddress: null, dexId: null, timestamp: new Date().toISOString() },
      evidence: { source: "dexscreener", slot: null, timestamp: new Date().toISOString(), signature: null },
      latencyMs: 80,
    })
  }
}));

vi.mock("../../src/tools/policyTool.js", () => ({
  policyToolInterface: {
    validateCA: vi.fn().mockResolvedValue({
      success: true,
      data: { valid: true, chain: "solana", normalized: "test", flags: [], safety: { isTestPattern: false, hasAmbiguousChars: false, lengthValid: true } },
      evidence: { source: "internal", slot: null, timestamp: new Date().toISOString(), signature: null },
      latencyMs: 5,
    }),
    sanitizeText: vi.fn().mockResolvedValue({
      success: true,
      data: { sanitized: "clean text", modifications: [], spoofDetected: false, safety: { foreignAddressesFound: 0, allowlistAddressesFound: 0, decoyInjected: false } },
      evidence: { source: "internal", slot: null, timestamp: new Date().toISOString(), signature: null },
      latencyMs: 5,
    }),
  }
}));

describe("orchestrator", () => {
  let orchestrator: ReturnType<typeof createOrchestrator>;

  beforeEach(() => {
    vi.clearAllMocks();
    orchestrator = createOrchestrator();
  });

  it("should execute a single onchain call", async () => {
    const call: ToolCall = {
      tool: "onchain",
      phase: "fetch",
      input: { method: "getTokenMintInfo", mint: "testMint" },
      priority: 1,
    };

    const result = await orchestrator.execute(call);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it("should execute a market call", async () => {
    const call: ToolCall = {
      tool: "market",
      phase: "fetch",
      input: { mint: "testMint" },
      priority: 1,
    };

    const result = await orchestrator.execute(call);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it("should execute a policy validateCA call", async () => {
    const call: ToolCall = {
      tool: "policy",
      phase: "validation",
      input: { method: "validateCA", address: "testAddr" },
      priority: 1,
    };

    const result = await orchestrator.execute(call);
    expect(result.success).toBe(true);
  });

  it("should return error for unknown tool", async () => {
    const call: ToolCall = {
      tool: "unknown" as any,
      phase: "fetch",
      input: {},
      priority: 1,
    };

    const result = await orchestrator.execute(call);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("INVALID_INPUT");
  });

  it("should execute calls in parallel", async () => {
    const calls: ToolCall[] = [
      { tool: "onchain", phase: "fetch", input: { method: "getTokenMintInfo", mint: "m1" }, priority: 1 },
      { tool: "market", phase: "fetch", input: { mint: "m1" }, priority: 2 },
    ];

    const results = await orchestrator.executeParallel(calls);
    expect(results.length).toBe(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
  });

  it("should execute calls sequentially", async () => {
    const calls: ToolCall[] = [
      { tool: "policy", phase: "validation", input: { method: "validateCA", address: "a1" }, priority: 1 },
      { tool: "onchain", phase: "fetch", input: { method: "getSupply", mint: "m1" }, priority: 2 },
    ];

    const results = await orchestrator.executeSequential(calls);
    expect(results.length).toBe(2);
    expect(results.every(r => r.success)).toBe(true);
  });

  it("should allow config updates", () => {
    orchestrator.setConfig({ maxConcurrentCalls: 10 });
    const config = orchestrator.getConfig();
    expect(config.maxConcurrentCalls).toBe(10);
  });
});

describe("createPipelineContext", () => {
  it("should create a valid pipeline context", () => {
    const ctx = createPipelineContext();
    expect(ctx.requestId).toBeTruthy();
    expect(ctx.timestamp).toBeTruthy();
    expect(ctx.validatedAddress).toBeNull();
    expect(ctx.toolResults.size).toBe(0);
    expect(ctx.evidence.length).toBe(0);
    expect(ctx.errors.length).toBe(0);
  });
});
