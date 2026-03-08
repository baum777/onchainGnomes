/**
 * GeckoTerminal Market Adapter
 * 
 * Fetches market data for tokens from GeckoTerminal.
 */

import { 
  type MarketQuote, 
  type MarketResult,
  createEvidence, 
  createSuccessResult, 
  createErrorResult 
} from "../../types/tools.js";
import { 
  createCircuitBreaker, 
  type BaseAdapter, 
  type AdapterConfig,
  type CircuitBreaker 
} from "../base.js";
import { createMarketApiError, MarketApiError, mapMarketErrorToToolError } from "./errors.js";

export interface GeckoAdapterConfig extends AdapterConfig {
  baseUrl: string;
}

export class GeckoAdapter implements BaseAdapter {
  readonly name = "GeckoAdapter";
  readonly version = "1.0.0";
  
  private config: GeckoAdapterConfig;
  private circuitBreaker: CircuitBreaker;

  constructor(config?: Partial<GeckoAdapterConfig>) {
    this.config = {
      baseUrl: config?.baseUrl ?? "https://api.geckoterminal.com/api/v2/networks/solana/tokens",
      timeoutMs: config?.timeoutMs ?? 10000,
      maxRetries: config?.maxRetries ?? 3,
    };
    this.circuitBreaker = createCircuitBreaker();
  }

  /**
   * Fetch market data for a single mint
   */
  async fetchQuote(mint: string): Promise<MarketResult<MarketQuote>> {
    const start = Date.now();
    
    if (!this.circuitBreaker.canExecute()) {
      return createErrorResult(
        "SOURCE_DOWN",
        "GeckoTerminal circuit breaker is OPEN",
        Date.now() - start
      ) as MarketResult<MarketQuote>;
    }

    try {
      const url = `${this.config.baseUrl}/${mint}`;
      const response = await fetch(url, {
        headers: {
          "Accept": "application/json;version=20230302"
        },
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      if (!response.ok) {
        throw createMarketApiError(
          new Error(`HTTP ${response.status}: ${response.statusText}`),
          "gecko_terminal",
          url,
          response.status === 429 ? "RATE_LIMITED" : "SERVER_ERROR"
        );
      }

      const data = await response.json();
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordSuccess();

      if (!data.data || !data.data.attributes) {
        return createErrorResult(
          "NO_DATA",
          `No GeckoTerminal data found for mint: ${mint}`,
          latencyMs
        ) as MarketResult<MarketQuote>;
      }

      const attr = data.data.attributes;

      const quote: MarketQuote = {
        mint,
        priceUsd: parseFloat(attr.price_usd) || null,
        liquidityUsd: parseFloat(attr.total_reserve_in_usd) || null,
        volume24hUsd: parseFloat(attr.volume_usd?.h24) || null,
        marketCap: parseFloat(attr.fdv_usd) || null,
        priceChange24h: parseFloat(attr.price_change_percentage?.h24) || null,
        pairAddress: null, // Token endpoint doesn't give a specific pair
        dexId: null,
        timestamp: new Date().toISOString(),
      };

      const evidence = createEvidence("gecko_terminal", null, {
        endpoint: url,
        notes: `Name: ${attr.name} (${attr.symbol})`
      });

      return createSuccessResult(quote, evidence, latencyMs);

    } catch (error) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure();

      if (error instanceof MarketApiError) {
        return createErrorResult(
          mapMarketErrorToToolError(error),
          error.message,
          latencyMs
        ) as MarketResult<MarketQuote>;
      }

      return createErrorResult(
        "UNEXPECTED",
        error instanceof Error ? error.message : String(error),
        latencyMs
      ) as MarketResult<MarketQuote>;
    }
  }

  getConfig(): GeckoAdapterConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<GeckoAdapterConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
