/**
 * Facts Resolver - Merges tool data and calculates confidence scores
 * 
 * Combines onchain and market data, detects discrepancies,
 * and calculates overall confidence for verification results.
 */

import type {
  VerificationResult,
  VerificationStatus,
  Evidence,
} from "../types/evidence.js";
import type {
  ToolResult,
  TokenMintInfo,
  SupplyInfo,
  LargestAccountsInfo,
  MarketQuote,
} from "../types/tools.js";
import { mergeEvidence, hashData } from "./evidenceNormalizer.js";

// =============================================================================
// Confidence Calculation Weights
// =============================================================================

const CONFIDENCE_WEIGHTS = {
  ONCHAIN_PRESENT: 0.4,
  MARKET_PRESENT: 0.3,
  EVIDENCE_QUALITY: 0.2,
  LATENCY_BONUS: 0.1,
};

const DISCREPANCY_THRESHOLDS = {
  PRICE_PERCENT: 0.05, // 5% price difference
  LIQUIDITY_PERCENT: 0.1, // 10% liquidity difference
  TIMESTAMP_MS: 60000, // 60 seconds
};

// =============================================================================
// Facts Resolver
// =============================================================================

export interface ResolvedFacts {
  verificationResult: VerificationResult;
  discrepancies: string[];
  recommendations: string[];
}

export interface FactsResolverInput {
  ca: string;
  onchainResults: {
    mintInfo?: ToolResult<TokenMintInfo>;
    supply?: ToolResult<SupplyInfo>;
    largestAccounts?: ToolResult<LargestAccountsInfo>;
  };
  marketResults: ToolResult<MarketQuote>[];
}

/**
 * Resolve facts from multiple tool results
 */
export function resolveFacts(input: FactsResolverInput): ResolvedFacts {
  const discrepancies: string[] = [];
  const recommendations: string[] = [];
  
  // Collect all evidence
  const evidences: Evidence[] = [];
  
  // Process onchain results
  const onchainData = {
    mintInfo: input.onchainResults.mintInfo?.data || null,
    supply: input.onchainResults.supply?.data || null,
    largestAccounts: input.onchainResults.largestAccounts?.data || null,
  };
  
  if (input.onchainResults.mintInfo?.evidence) {
    evidences.push(input.onchainResults.mintInfo.evidence as Evidence);
  }
  if (input.onchainResults.supply?.evidence) {
    evidences.push(input.onchainResults.supply.evidence as Evidence);
  }
  if (input.onchainResults.largestAccounts?.evidence) {
    evidences.push(input.onchainResults.largestAccounts.evidence as Evidence);
  }
  
  // Process market results
  const marketData = mergeMarketData(input.marketResults);
  
  for (const result of input.marketResults) {
    if (result.evidence) {
      evidences.push(result.evidence as Evidence);
    }
  }
  
  // Detect discrepancies
  const marketDiscrepancies = detectMarketDiscrepancies(input.marketResults);
  discrepancies.push(...marketDiscrepancies);
  
  // Check onchain vs market consistency
  if (onchainData.mintInfo && marketData) {
    const consistencyCheck = checkOnchainMarketConsistency(
      onchainData.mintInfo,
      marketData
    );
    if (!consistent) {
      discrepancies.push(...consistencyCheck.issues);
    }
  }
  
  // Calculate confidence
  const confidence = calculateConfidence(
    input.onchainResults,
    input.marketResults,
    evidences,
    discrepancies.length
  );
  
  // Determine status
  const status = determineStatus(confidence, discrepancies.length);
  
  // Generate recommendations
  if (discrepancies.length > 0) {
    recommendations.push("Multiple data sources show discrepancies - verify before trading");
  }
  if (confidence < 0.6) {
    recommendations.push("Low confidence score - treat data as preliminary");
  }
  if (!onchainData.mintInfo) {
    recommendations.push("Onchain verification failed - cannot confirm token legitimacy");
  }
  
  // Merge evidence
  const mergedEvidence = evidences.length > 0 
    ? [mergeEvidence(evidences).evidence] 
    : [];
  
  // Build verification result
  const verificationResult: VerificationResult = {
    status,
    confidence,
    ca: input.ca,
    evidence: mergedEvidence,
    flags: discrepancies,
    onchainData,
    marketData,
    timestamp: new Date().toISOString(),
    latencyMs: calculateTotalLatency(input),
  };
  
  return {
    verificationResult,
    discrepancies,
    recommendations,
  };
}

// =============================================================================
// Market Data Merging
// =============================================================================

function mergeMarketData(results: ToolResult<MarketQuote>[]): MarketQuote | null {
  const successful = results.filter((r) => r.success && r.data);
  
  if (successful.length === 0) {
    return null;
  }
  
  if (successful.length === 1) {
    return successful[0]!.data;
  }
  
  // Take median values for price/liquidity
  const prices = successful
    .map((r) => r.data!.priceUsd)
    .filter((p): p is number => p !== null)
    .sort((a, b) => a - b);
  
  const liquidities = successful
    .map((r) => r.data!.liquidityUsd)
    .filter((l): l is number => l !== null)
    .sort((a, b) => a - b);
  
  const volumes = successful
    .map((r) => r.data!.volume24hUsd)
    .filter((v): v is number => v !== null);
  
  const medianPrice = prices[Math.floor(prices.length / 2)] || null;
  const medianLiquidity = liquidities[Math.floor(liquidities.length / 2)] || null;
  const avgVolume = volumes.length > 0 
    ? volumes.reduce((a, b) => a + b, 0) / volumes.length 
    : null;
  
  // Use the first result as base
  const base = successful[0]!.data!;
  
  return {
    ...base,
    priceUsd: medianPrice,
    liquidityUsd: medianLiquidity,
    volume24hUsd: avgVolume,
  };
}

// =============================================================================
// Discrepancy Detection
// =============================================================================

function detectMarketDiscrepancies(results: ToolResult<MarketQuote>[]): string[] {
  const discrepancies: string[] = [];
  const successful = results.filter((r) => r.success && r.data);
  
  if (successful.length < 2) {
    return discrepancies;
  }
  
  // Check price discrepancies
  const prices = successful
    .map((r) => r.data!.priceUsd)
    .filter((p): p is number => p !== null);
  
  if (prices.length >= 2) {
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const priceDiff = (maxPrice - minPrice) / minPrice;
    
    if (priceDiff > DISCREPANCY_THRESHOLDS.PRICE_PERCENT) {
      discrepancies.push(
        `PRICE_DISCREPANCY: ${(priceDiff * 100).toFixed(2)}% difference between sources`
      );
    }
  }
  
  // Check liquidity discrepancies
  const liquidities = successful
    .map((r) => r.data!.liquidityUsd)
    .filter((l): l is number => l !== null);
  
  if (liquidities.length >= 2) {
    const maxLiq = Math.max(...liquidities);
    const minLiq = Math.min(...liquidities);
    const liqDiff = maxLiq > 0 ? (maxLiq - minLiq) / minLiq : 0;
    
    if (liqDiff > DISCREPANCY_THRESHOLDS.LIQUIDITY_PERCENT) {
      discrepancies.push(
        `LIQUIDITY_DISCREPANCY: ${(liqDiff * 100).toFixed(2)}% difference between sources`
      );
    }
  }
  
  return discrepancies;
}

interface ConsistencyCheckResult {
  consistent: boolean;
  issues: string[];
}

let consistent = true; // Will be set in checkOnchainMarketConsistency

function checkOnchainMarketConsistency(
  mintInfo: TokenMintInfo,
  marketData: MarketQuote
): ConsistencyCheckResult {
  const issues: string[] = [];
  consistent = true;
  
  // Check if market data references the correct mint
  if (marketData.mint !== mintInfo.mint) {
    issues.push(`MINT_MISMATCH: Market data for different mint (${marketData.mint} vs ${mintInfo.mint})`);
    consistent = false;
  }
  
  // Check if token is initialized
  if (!mintInfo.isInitialized) {
    issues.push("TOKEN_NOT_INITIALIZED: Mint is not initialized onchain");
    consistent = false;
  }
  
  return { consistent, issues };
}

// =============================================================================
// Confidence Calculation
// =============================================================================

function calculateConfidence(
  onchainResults: FactsResolverInput["onchainResults"],
  marketResults: ToolResult<MarketQuote>[],
  evidences: Evidence[],
  discrepancyCount: number
): number {
  let confidence = 0;
  
  // Onchain presence bonus
  const onchainSuccess = [
    onchainResults.mintInfo?.success,
    onchainResults.supply?.success,
    onchainResults.largestAccounts?.success,
  ].filter(Boolean).length;
  
  if (onchainSuccess > 0) {
    confidence += CONFIDENCE_WEIGHTS.ONCHAIN_PRESENT * (onchainSuccess / 3);
  }
  
  // Market presence bonus
  const marketSuccess = marketResults.filter((r) => r.success).length;
  if (marketSuccess > 0) {
    confidence += CONFIDENCE_WEIGHTS.MARKET_PRESENT * Math.min(marketSuccess / 2, 1);
  }
  
  // Evidence quality bonus
  if (evidences.length > 0) {
    const qualityScore = evidences.every((e) => e.rawHash) ? 1 : 0.5;
    confidence += CONFIDENCE_WEIGHTS.EVIDENCE_QUALITY * qualityScore;
  }
  
  // Latency bonus (average latency < 2s)
  const latencies = [
    onchainResults.mintInfo?.latencyMs,
    onchainResults.supply?.latencyMs,
    ...marketResults.map((r) => r.latencyMs),
  ].filter((l): l is number => l !== undefined);
  
  if (latencies.length > 0) {
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    if (avgLatency < 2000) {
      confidence += CONFIDENCE_WEIGHTS.LATENCY_BONUS;
    }
  }
  
  // Discrepancy penalty
  confidence -= discrepancyCount * 0.15;
  
  return Math.max(0, Math.min(1, confidence));
}

function determineStatus(
  confidence: number,
  discrepancyCount: number
): VerificationStatus {
  if (confidence >= 0.85 && discrepancyCount === 0) {
    return "VERIFIED";
  }
  if (confidence >= 0.5) {
    return "PARTIAL";
  }
  return "UNVERIFIED";
}

function calculateTotalLatency(input: FactsResolverInput): number {
  const latencies = [
    input.onchainResults.mintInfo?.latencyMs,
    input.onchainResults.supply?.latencyMs,
    input.onchainResults.largestAccounts?.latencyMs,
    ...input.marketResults.map((r) => r.latencyMs),
  ].filter((l): l is number => l !== undefined);
  
  return latencies.length > 0 
    ? Math.max(...latencies) // Use max for parallel execution
    : 0;
}
