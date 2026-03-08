import { describe, it, expect, vi, beforeEach } from "vitest";
import { GeckoAdapter } from "../../../src/adapters/market/geckoAdapter.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("GeckoAdapter", () => {
  let adapter: GeckoAdapter;
  const testMint = "DezXAZ8z7PnrnMcqzS2S6onBRShZCHshZxhXNoyoAnBX";

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new GeckoAdapter();
  });

  it("should return quote for a valid mint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          attributes: {
            price_usd: "0.00001234",
            total_reserve_in_usd: "500000",
            volume_usd: { h24: "120000" },
            fdv_usd: "8000000",
            price_change_percentage: { h24: "-3.5" },
            name: "Bonk",
            symbol: "BONK",
          }
        }
      })
    });

    const result = await adapter.fetchQuote(testMint);

    expect(result.success).toBe(true);
    expect(result.data?.priceUsd).toBeCloseTo(0.00001234);
    expect(result.data?.liquidityUsd).toBe(500000);
    expect(result.evidence?.source).toBe("gecko_terminal");
  });

  it("should return NO_DATA when no data found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: null })
    });

    const result = await adapter.fetchQuote(testMint);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("NO_DATA");
  });

  it("should handle HTTP errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: "Too Many Requests"
    });

    const result = await adapter.fetchQuote(testMint);

    expect(result.success).toBe(false);
  });
});
