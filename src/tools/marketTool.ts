/**
 * Market Data Tool
 * 
 * Agent-ready tool interface for market data queries.
 */

import { 
  type MarketQuote, 
  type MarketResult,
  type MarketSource
} from "../types/tools.js";
import { DexScreenerAdapter } from "../adapters/market/dexscreenerAdapter.js";
import { GeckoAdapter } from "../adapters/market/geckoAdapter.js";
import { mergeMarketQuotes } from "../adapters/market/quoteMerger.js";

export const marketToolInterface = {
  async getMarketData(
    mint: string,
    options?: {
      sources?: MarketSource[];
      requireAllSources?: boolean;
      discrepancyThreshold?: number;
    }
  ): Promise<MarketResult<MarketQuote>> {
    const sources = options?.sources ?? ["dexscreener"];
    const results: MarketResult<MarketQuote>[] = [];

    const fetchers: Promise<MarketResult<MarketQuote>>[] = [];

    for (const source of sources) {
      if (source === "dexscreener") {
        const adapter = new DexScreenerAdapter();
        fetchers.push(adapter.fetchQuote(mint));
      } else if (source === "gecko_terminal") {
        const adapter = new GeckoAdapter();
        fetchers.push(adapter.fetchQuote(mint));
      }
    }

    const settled = await Promise.allSettled(fetchers);
    for (const result of settled) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({
          success: false,
          data: null,
          evidence: null,
          error: {
            code: "UNEXPECTED",
            message: result.reason instanceof Error ? result.reason.message : String(result.reason)
          },
          latencyMs: 0,
        });
      }
    }

    if (results.length === 1) {
      return results[0];
    }

    return mergeMarketQuotes(results, {
      requireAllSources: options?.requireAllSources,
      discrepancyThresholdPercentage: options?.discrepancyThreshold,
    });
  }
};
