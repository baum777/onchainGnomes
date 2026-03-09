/**
 * Evidence Normalizer - Transforms adapter outputs into standardized Proof Objects
 * 
 * Ensures all tool results conform to the standardized Evidence format
 * with proper hashing, timestamps, and source attribution.
 */

import type { Evidence, EvidenceSource } from "../types/evidence.js";
import type { TokenMintInfo, SupplyInfo, LargestAccountsInfo, MarketQuote } from "../types/tools.js";

// =============================================================================
// Normalization Functions
// =============================================================================

export interface NormalizedEvidence {
  evidence: Evidence;
  normalized: boolean;
  warnings: string[];
}

/**
 * Normalize Solana RPC evidence
 */
export function normalizeSolanaEvidence(
  data: TokenMintInfo | SupplyInfo | LargestAccountsInfo,
  endpoint: string,
  slot: number | null,
  rawData: unknown
): NormalizedEvidence {
  const warnings: string[] = [];
  
  if (!slot) {
    warnings.push("No slot number provided by RPC");
  }
  
  const evidence: Evidence = {
    source: "solana_rpc",
    endpoint,
    timestamp: new Date().toISOString(),
    slot,
    signature: null,
    rawHash: hashData(rawData),
    notes: `Mint: ${(data as any).mint}`,
  };
  
  return {
    evidence,
    normalized: true,
    warnings,
  };
}

/**
 * Normalize DexScreener evidence
 */
export function normalizeDexScreenerEvidence(
  data: MarketQuote,
  endpoint: string,
  rawData: unknown
): NormalizedEvidence {
  const warnings: string[] = [];
  
  if (!data.priceUsd) {
    warnings.push("No price data available");
  }
  
  if (!data.liquidityUsd) {
    warnings.push("No liquidity data available");
  }
  
  const evidence: Evidence = {
    source: "dexscreener",
    endpoint,
    timestamp: new Date().toISOString(),
    slot: null,
    signature: null,
    rawHash: hashData(rawData),
    notes: `Pair: ${data.dexId} - ${data.pairAddress}`,
  };
  
  return {
    evidence,
    normalized: true,
    warnings,
  };
}

/**
 * Normalize GeckoTerminal evidence
 */
export function normalizeGeckoEvidence(
  data: MarketQuote,
  endpoint: string,
  rawData: unknown
): NormalizedEvidence {
  const warnings: string[] = [];
  
  const evidence: Evidence = {
    source: "gecko_terminal",
    endpoint,
    timestamp: new Date().toISOString(),
    slot: null,
    signature: null,
    rawHash: hashData(rawData),
    notes: `Mint: ${data.mint}`,
  };
  
  return {
    evidence,
    normalized: true,
    warnings,
  };
}

/**
 * Normalize internal/policy evidence
 */
export function normalizeInternalEvidence(
  operation: string,
  details?: string
): NormalizedEvidence {
  const evidence: Evidence = {
    source: "internal",
    endpoint: "internal",
    timestamp: new Date().toISOString(),
    slot: null,
    signature: null,
    rawHash: hashData({ operation, details, timestamp: Date.now() }),
    notes: details || operation,
  };
  
  return {
    evidence,
    normalized: true,
    warnings: [],
  };
}

// =============================================================================
// Hash Functions
// =============================================================================

/**
 * Create a deterministic hash of data for integrity verification
 */
export function hashData(data: unknown): string {
  const str = JSON.stringify(data, Object.keys(data as object).sort());
  return hashString(str);
}

function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(16).padStart(16, "0");
}

// =============================================================================
// Evidence Validation
// =============================================================================

export interface EvidenceValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate normalized evidence
 */
export function validateNormalizedEvidence(
  evidence: Evidence
): EvidenceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required fields
  if (!evidence.source) {
    errors.push("Evidence missing source");
  }
  
  if (!evidence.endpoint) {
    errors.push("Evidence missing endpoint");
  }
  
  if (!evidence.timestamp) {
    errors.push("Evidence missing timestamp");
  } else {
    const timestamp = new Date(evidence.timestamp);
    if (isNaN(timestamp.getTime())) {
      errors.push("Invalid timestamp format");
    }
  }
  
  // Source-specific validation
  if (evidence.source === "solana_rpc" && evidence.slot === undefined) {
    warnings.push("Solana RPC evidence should include slot number");
  }
  
  if (!evidence.rawHash) {
    warnings.push("Evidence missing rawHash - integrity verification limited");
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// Evidence Merging
// =============================================================================

export interface MergedEvidence {
  evidence: Evidence;
  sources: EvidenceSource[];
  conflicts: string[];
}

/**
 * Merge multiple evidence objects into a single merged evidence
 */
export function mergeEvidence(evidences: Evidence[]): MergedEvidence {
  const sources = [...new Set(evidences.map((e) => e.source))];
  const conflicts: string[] = [];
  
  // Check for timestamp conflicts (> 60s difference)
  const timestamps = evidences.map((e) => new Date(e.timestamp).getTime());
  const maxDiff = Math.max(...timestamps) - Math.min(...timestamps);
  
  if (maxDiff > 60000) {
    conflicts.push(`Timestamp spread: ${Math.round(maxDiff / 1000)}s`);
  }
  
  // Create merged evidence
  const latestTimestamp = new Date(Math.max(...timestamps)).toISOString();
  const combinedHash = evidences.map((e) => e.rawHash || e.timestamp).join("|");
  
  const merged: Evidence = {
    source: "merged",
    endpoint: "merged",
    timestamp: latestTimestamp,
    slot: null,
    signature: null,
    rawHash: hashString(combinedHash),
    notes: `Merged ${evidences.length} sources: ${sources.join(", ")}`,
  };
  
  return {
    evidence: merged,
    sources,
    conflicts,
  };
}
