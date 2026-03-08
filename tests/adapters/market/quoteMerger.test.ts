import { describe, it, expect } from "vitest";
import { mergeMarketQuotes } from "../../../src/adapters/market/quoteMerger.js";
import type { MarketQuote, MarketResult } from "../../../src/types/tools.js";

function makeSuccessResult(priceUsd: number, source: string): MarketResult<MarketQuote> {
  return {
    success: true,
    data: {
      mint: "testMint",
      priceUsd,
      liquidityUsd: 100000,
      volume24hUsd: 50000,
      marketCap: 1000000,
      priceChange24h: -2.5,
      pairAddress: "pair1",
      dexId: "raydium",
      timestamp: new Date().toISOString(),
    },
    evidence: {
      source: source as any,
      slot: null,
      timestamp: new Date().toISOString(),
      signature: null,
    },
    latencyMs: 100,
  };
}

function makeFailResult(source: string): MarketResult<MarketQuote> {
  return {
    success: false,
    data: null,
    evidence: { source: source as any, slot: null, timestamp: new Date().toISOString(), signature: null },
    error: { code: "SOURCE_DOWN", message: `${source} is down` },
    latencyMs: 50,
  };
}

describe("quoteMerger", () => {
  it("should return single result when only one provided", () => {
    const result = mergeMarketQuotes([makeSuccessResult(1.5, "dexscreener")]);
    expect(result.success).toBe(true);
    expect(result.data?.priceUsd).toBe(1.5);
  });

  it("should average prices from multiple sources", () => {
    const result = mergeMarketQuotes([
      makeSuccessResult(1.0, "dexscreener"),
      makeSuccessResult(1.2, "gecko_terminal"),
    ]);
    expect(result.success).toBe(true);
    expect(result.data?.priceUsd).toBeCloseTo(1.1);
  });

  it("should detect price discrepancy above threshold", () => {
    const result = mergeMarketQuotes([
      makeSuccessResult(1.0, "dexscreener"),
      makeSuccessResult(1.5, "gecko_terminal"),
    ], { discrepancyThresholdPercentage: 10 });

    expect(result.success).toBe(true);
    expect(result.sourceDiscrepancy?.detected).toBe(true);
  });

  it("should not detect discrepancy within threshold", () => {
    const result = mergeMarketQuotes([
      makeSuccessResult(1.0, "dexscreener"),
      makeSuccessResult(1.05, "gecko_terminal"),
    ], { discrepancyThresholdPercentage: 10 });

    expect(result.success).toBe(true);
    expect(result.sourceDiscrepancy?.detected).toBe(false);
  });

  it("should fail when requireAllSources and one source fails", () => {
    const result = mergeMarketQuotes([
      makeSuccessResult(1.0, "dexscreener"),
      makeFailResult("gecko_terminal"),
    ], { requireAllSources: true });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("SOURCE_DOWN");
  });

  it("should succeed with partial sources when requireAllSources is false", () => {
    const result = mergeMarketQuotes([
      makeSuccessResult(1.0, "dexscreener"),
      makeFailResult("gecko_terminal"),
    ]);

    expect(result.success).toBe(true);
    expect(result.data?.priceUsd).toBe(1.0);
  });
});
