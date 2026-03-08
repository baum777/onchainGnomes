import { describe, it, expect, vi, beforeEach } from "vitest";
import { DexScreenerAdapter } from "../../../src/adapters/market/dexscreenerAdapter.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("DexScreenerAdapter", () => {
  let adapter: DexScreenerAdapter;
  const testMint = "DezXAZ8z7PnrnMcqzS2S6onBRShZCHshZxhXNoyoAnBX";

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new DexScreenerAdapter();
  });

  it("should return quote for a valid mint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pairs: [{
          priceUsd: "0.00001234",
          liquidity: { usd: 500000 },
          volume: { h24: 120000 },
          fdv: 8000000,
          priceChange: { h24: -3.5 },
          pairAddress: "pair123",
          dexId: "raydium",
        }]
      })
    });

    const result = await adapter.fetchQuote(testMint);

    expect(result.success).toBe(true);
    expect(result.data?.priceUsd).toBeCloseTo(0.00001234);
    expect(result.data?.liquidityUsd).toBe(500000);
    expect(result.data?.volume24hUsd).toBe(120000);
    expect(result.data?.dexId).toBe("raydium");
    expect(result.evidence?.source).toBe("dexscreener");
  });

  it("should return NO_DATA when no pairs found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ pairs: [] })
    });

    const result = await adapter.fetchQuote(testMint);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("NO_DATA");
  });

  it("should handle HTTP errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error"
    });

    const result = await adapter.fetchQuote(testMint);

    expect(result.success).toBe(false);
  });

  it("should handle network failures", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await adapter.fetchQuote(testMint);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("UNEXPECTED");
  });

  it("should select the highest liquidity pair", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pairs: [
          { priceUsd: "0.0001", liquidity: { usd: 100 }, volume: { h24: 10 }, fdv: 1000, priceChange: { h24: 0 }, pairAddress: "low", dexId: "orca" },
          { priceUsd: "0.0002", liquidity: { usd: 999999 }, volume: { h24: 50000 }, fdv: 5000000, priceChange: { h24: 5 }, pairAddress: "high", dexId: "raydium" },
        ]
      })
    });

    const result = await adapter.fetchQuote(testMint);

    expect(result.success).toBe(true);
    expect(result.data?.pairAddress).toBe("high");
    expect(result.data?.dexId).toBe("raydium");
  });
});
