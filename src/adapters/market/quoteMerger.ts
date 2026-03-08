/**
 * Market Quote Merger
 * 
 * Merges market data from multiple sources and detects discrepancies.
 */

import { 
  type MarketQuote, 
  type MarketResult 
} from "../../types/tools.js";

export function mergeMarketQuotes(
  results: MarketResult<MarketQuote>[],
  options?: {
    discrepancyThresholdPercentage?: number;
    requireAllSources?: boolean;
  }
): MarketResult<MarketQuote> {
  const threshold = options?.discrepancyThresholdPercentage ?? 10;
  const successfulResults = results.filter(r => r.success && r.data);
  const latencyMs = Math.max(...results.map(r => r.latencyMs));

  if (successfulResults.length === 0) {
    return results[0]!;
  }

  if (options?.requireAllSources && successfulResults.length < results.length) {
    const failedSources = results
      .filter(r => !r.success)
      .map(r => r.evidence?.source || "unknown");
    
    return {
      success: false,
      data: null,
      evidence: null,
      error: {
        code: "SOURCE_DOWN",
        message: `Missing required sources: ${failedSources.join(", ")}`
      },
      latencyMs
    };
  }

  if (successfulResults.length === 1) {
    return successfulResults[0]!;
  }

  const quotes = successfulResults.map(r => r.data!);
  
  const prices = quotes.filter(q => q.priceUsd !== null).map(q => q.priceUsd!) as number[];
  const avgPriceUsd = prices.length > 0 
    ? prices.reduce((a, b) => a + b, 0) / prices.length 
    : null;

  let discrepancyDetected = false;
  let discrepancyDetails = "";

  if (prices.length > 1) {
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const diffPercent = ((maxPrice - minPrice) / minPrice) * 100;

    if (diffPercent > threshold) {
      discrepancyDetected = true;
      discrepancyDetails = `Price difference of ${diffPercent.toFixed(2)}% between sources exceeds ${threshold}% threshold`;
    }
  }

  const mergedQuote: MarketQuote = {
    mint: quotes[0]!.mint,
    priceUsd: avgPriceUsd,
    liquidityUsd: averageMetric(quotes.map(q => q.liquidityUsd)),
    volume24hUsd: averageMetric(quotes.map(q => q.volume24hUsd)),
    marketCap: averageMetric(quotes.map(q => q.marketCap)),
    priceChange24h: averageMetric(quotes.map(q => q.priceChange24h)),
    pairAddress: quotes[0]!.pairAddress,
    dexId: quotes[0]!.dexId,
    timestamp: new Date().toISOString(),
  };

  const firstEvidence = successfulResults[0]!.evidence!;
  const combinedEvidence = {
    ...firstEvidence,
    notes: `Merged from ${successfulResults.length} sources. ${discrepancyDetails}`.trim(),
  };

  return {
    success: true,
    data: mergedQuote,
    evidence: combinedEvidence,
    latencyMs,
    sourceDiscrepancy: {
      detected: discrepancyDetected,
      details: discrepancyDetails || undefined
    }
  };
}

function averageMetric(values: (number | null)[]): number | null {
  const filtered = values.filter(v => v !== null) as number[];
  if (filtered.length === 0) return null;
  return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}
