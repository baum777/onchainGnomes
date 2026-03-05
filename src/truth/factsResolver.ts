/**
 * Facts Resolver - Integration with Token Audit Engine
 *
 * Resolves factual claims by connecting to the token audit system.
 * Provides verified on-chain data for the truth gate.
 *
 * Integration points:
 * - Token Audit Engine for contract validation and metrics
 * - Fact Store for cached verified data
 * - RPC providers for on-chain verification
 */

import {
  runTokenAudit,
  auditToken,
  type TokenAuditRun,
  type TokenMetrics,
  type RiskScore,
} from "../audit/tokenAuditEngine.js";

export interface FactsResolverDeps {
  // Optional RPC URL for on-chain verification
  rpcUrl?: string;
  // Optional cache for audit results
  auditCache?: Map<string, TokenAuditRun>;
}

/** Fact resolution request */
export interface FactResolutionRequest {
  ticker?: string;
  contract_address?: string;
  fact_type: "contract_valid" | "liquidity" | "holders" | "dev_wallet" | "general";
}

/** Fact resolution result */
export interface FactResolutionResult {
  resolved: boolean;
  fact_type: string;
  value: unknown;
  verification: {
    source: "audit_engine" | "cache" | "rpc" | "none";
    timestamp: string;
    expires_at?: string;
  };
  audit_result?: TokenAuditRun;
  error?: string;
}

/**
 * Resolves a factual claim using the audit engine.
 * Primary entry point for fact verification.
 */
export async function resolveFact(
  deps: FactsResolverDeps,
  request: FactResolutionRequest
): Promise<FactResolutionResult> {
  const { ticker, contract_address, fact_type } = request;

  // Check cache first
  if (deps.auditCache && contract_address) {
    const cached = deps.auditCache.get(contract_address);
    if (cached) {
      return buildResolutionFromAudit(fact_type, cached, "cache");
    }
  }

  // No contract address = cannot verify on-chain
  if (!contract_address) {
    return {
      resolved: false,
      fact_type,
      value: null,
      verification: {
        source: "none",
        timestamp: new Date().toISOString(),
      },
      error: "No contract address provided for verification",
    };
  }

  // Run token audit
  try {
    const auditResult = await runTokenAudit(
      ticker || "UNKNOWN",
      contract_address,
      {
        rpcUrl: deps.rpcUrl,
        skipOnchainVerification: !deps.rpcUrl, // Skip if no RPC available
      }
    );

    // Cache the result
    if (deps.auditCache) {
      deps.auditCache.set(contract_address, auditResult);
    }

    return buildResolutionFromAudit(fact_type, auditResult, "audit_engine");
  } catch (error) {
    return {
      resolved: false,
      fact_type,
      value: null,
      verification: {
        source: "none",
        timestamp: new Date().toISOString(),
      },
      error: error instanceof Error ? error.message : "Audit failed",
    };
  }
}

/**
 * Batch resolves multiple facts.
 */
export async function resolveFactsBatch(
  deps: FactsResolverDeps,
  requests: FactResolutionRequest[]
): Promise<FactResolutionResult[]> {
  const results: FactResolutionResult[] = [];

  for (const request of requests) {
    const result = await resolveFact(deps, request);
    results.push(result);
  }

  return results;
}

/**
 * Gets metrics for a token from audit engine.
 */
export async function getTokenMetrics(
  deps: FactsResolverDeps,
  ticker: string,
  contract_address: string
): Promise<TokenMetrics | null> {
  const result = await resolveFact(deps, {
    ticker,
    contract_address,
    fact_type: "general",
  });

  return result.audit_result?.metrics || null;
}

/**
 * Gets risk score for a token from audit engine.
 */
export async function getTokenRiskScore(
  deps: FactsResolverDeps,
  ticker: string,
  contract_address: string
): Promise<RiskScore | null> {
  const result = await resolveFact(deps, {
    ticker,
    contract_address,
    fact_type: "general",
  });

  return result.audit_result?.risk_score || null;
}

/**
 * Validates a contract address using the audit engine.
 */
export async function validateContractFact(
  deps: FactsResolverDeps,
  contract_address: string
): Promise<{ valid: boolean; chain: "solana" | "evm" | "unknown"; reason?: string }> {
  const result = await resolveFact(deps, {
    contract_address,
    fact_type: "contract_valid",
  });

  if (!result.audit_result) {
    return {
      valid: false,
      chain: "unknown",
      reason: result.error || "Could not validate contract",
    };
  }

  const audit = result.audit_result;

  return {
    valid: audit.data_quality.ca_valid,
    chain: detectChainFromAudit(audit),
    reason: audit.data_quality.missing.length > 0
      ? audit.data_quality.missing.join(", ")
      : undefined,
  };
}

/**
 * Checks if audit data is fresh (not expired).
 */
export function isFactFresh(
  resolution: FactResolutionResult,
  maxAgeMinutes: number = 30
): boolean {
  const timestamp = new Date(resolution.verification.timestamp);
  const now = new Date();
  const ageMs = now.getTime() - timestamp.getTime();
  const ageMinutes = ageMs / (1000 * 60);

  return ageMinutes < maxAgeMinutes;
}

/**
 * Formats a fact for display in responses.
 */
export function formatFactForDisplay(
  resolution: FactResolutionResult,
  format: "short" | "detailed" = "short"
): string {
  if (!resolution.resolved) {
    return "Data unavailable";
  }

  const audit = resolution.audit_result;
  if (!audit) {
    return String(resolution.value);
  }

  if (format === "short") {
    const metrics = audit.metrics;
    const parts: string[] = [];

    if (metrics.liquidity_usd !== null) {
      parts.push(`$${formatNumber(metrics.liquidity_usd)} liq`);
    }

    if (metrics.top10_holder_percent !== null) {
      parts.push(`${metrics.top10_holder_percent.toFixed(1)}% top10`);
    }

    if (metrics.dev_wallet_percent !== null) {
      parts.push(`${metrics.dev_wallet_percent.toFixed(1)}% dev`);
    }

    return parts.join(" | ") || "Metrics unavailable";
  }

  // Detailed format
  return JSON.stringify(audit.metrics, null, 2);
}

// =============================================================================
// Internal Helper Functions
// =============================================================================

/**
 * Builds resolution result from audit data.
 */
function buildResolutionFromAudit(
  fact_type: string,
  audit: TokenAuditRun,
  source: "audit_engine" | "cache" | "rpc"
): FactResolutionResult {
  let value: unknown = null;

  switch (fact_type) {
    case "contract_valid":
      value = audit.data_quality.ca_valid;
      break;
    case "liquidity":
      value = audit.metrics.liquidity_usd;
      break;
    case "holders":
      value = audit.metrics.top10_holder_percent;
      break;
    case "dev_wallet":
      value = audit.metrics.dev_wallet_percent;
      break;
    case "general":
    default:
      value = audit.metrics;
      break;
  }

  return {
    resolved: audit.data_quality.ca_valid || fact_type !== "contract_valid",
    fact_type,
    value,
    verification: {
      source,
      timestamp: audit.timestamp,
    },
    audit_result: audit,
  };
}

/**
 * Detects chain type from audit result.
 */
function detectChainFromAudit(audit: TokenAuditRun): "solana" | "evm" | "unknown" {
  const ca = audit.token.contract_address;

  if (ca.startsWith("0x") && ca.length === 42) {
    return "evm";
  }

  if (/^[A-HJ-NP-Za-km-z1-9]{32,44}$/.test(ca)) {
    return "solana";
  }

  return "unknown";
}

/**
 * Formats a number for display (K, M, B, T suffixes).
 */
function formatNumber(num: number): string {
  if (num >= 1_000_000_000_000) {
    return (num / 1_000_000_000_000).toFixed(1) + "T";
  }
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1) + "B";
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + "K";
  }
  return num.toString();
}

/**
 * Creates a fact resolution cache.
 */
export function createFactCache(): Map<string, TokenAuditRun> {
  return new Map<string, TokenAuditRun>();
}
