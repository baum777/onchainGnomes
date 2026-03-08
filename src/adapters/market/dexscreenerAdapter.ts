/**
 * DexScreener Market Adapter
 * 
 * Fetches market data for tokens from DexScreener.
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

export interface DexScreenerAdapterConfig extends AdapterConfig {
  baseUrl: string;
}

export class DexScreenerAdapter implements BaseAdapter {
  readonly name = "DexScreenerAdapter";
  readonly version = "1.0.0";
  
  private config: DexScreenerAdapterConfig;
  private circuitBreaker: CircuitBreaker;

  constructor(config?: Partial<DexScreenerAdapterConfig>) {
    this.config = {
      baseUrl: config?.baseUrl ?? "https://api.dexscreener.com/latest/dex/tokens",
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
        "DexScreener circuit breaker is OPEN",
        Date.now() - start
      ) as MarketResult<MarketQuote>;
    }

    try {
      const url = `${this.config.baseUrl}/${mint}`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 10000),
      });

      if (!response.ok) {
        throw createMarketApiError(
          new Error(`HTTP ${response.status}: ${response.statusText}`),
          "dexscreener",
          url,
          response.status === 429 ? "RATE_LIMITED" : "SERVER_ERROR"
        );
      }

      const data = await response.json();
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordSuccess();

      if (!data.pairs || data.pairs.length === 0) {
        return createErrorResult(
          "NO_DATA",
          `No DexScreener pairs found for mint: ${mint}`,
          latencyMs
        ) as MarketResult<MarketQuote>;
      }

      // We typically take the highest liquidity pair
      const bestPair = data.pairs.sort((a: any, b: any) => 
        (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      )[0];

      const quote: MarketQuote = {
        mint,
        priceUsd: parseFloat(bestPair.priceUsd) || null,
        liquidityUsd: bestPair.liquidity?.usd || null,
        volume24hUsd: bestPair.volume?.h24 || null,
        marketCap: bestPair.fdv || null, // FDV is often used as MC on DexScreener
        priceChange24h: bestPair.priceChange?.h24 || null,
        pairAddress: bestPair.pairAddress || null,
        dexId: bestPair.dexId || null,
        timestamp: new Date().toISOString(),
      };

      const evidence = createEvidence("dexscreener", null, {
        endpoint: url,
        notes: `Pair: ${bestPair.dexId} - ${bestPair.pairAddress}`
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

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; message?: string }> {
    const start = Date.now();
    try {
      const response = await fetch(`${this.config.baseUrl}/So11111111111111111111111111111111111111112`, {
        signal: AbortSignal.timeout(5000),
      });
      return {
        healthy: response.ok,
        latencyMs: Date.now() - start,
        message: response.ok ? "DexScreener reachable" : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  getConfig(): DexScreenerAdapterConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<DexScreenerAdapterConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
