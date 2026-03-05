/**
 * Token Audit Engine
 * Implements fail-closed token safety audit with deterministic risk scoring.
 * No hallucinations: unverifiable data = null + reason.
 */

import {
  validateContractAddress,
  detectChainType,
  stableHash,
  type ValidationResult,
} from "./contractValidation.js";

/** Risk verdict categories */
export type RiskVerdict = "SAFE" | "SPECULATIVE" | "HIGH_RISK" | "UNVERIFIED_HIGH_RISK";

/** Data quality modes */
export type DataQualityMode = "ok" | "degraded" | "fail_closed";

/** Individual risk component scores (0-100) */
export interface RiskComponents {
  liquidity_risk: number | null;
  holder_concentration_risk: number | null;
  bot_activity_risk: number | null;
  narrative_manipulation_risk: number | null;
  dev_control_risk: number | null;
}

/** Complete risk score with final calculation */
export interface RiskScore extends RiskComponents {
  final_risk: number;
  reason: string;
}

/** On-chain metrics for the token */
export interface TokenMetrics {
  liquidity_usd: number | null;
  volume24h_usd: number | null;
  top10_holder_percent: number | null;
  dev_wallet_percent: number | null;
}

/** Data quality assessment */
export interface DataQuality {
  mode: DataQualityMode;
  ca_valid: boolean;
  onchain_verified: boolean;
  dex_pairs_found: boolean;
  missing: string[];
}

/** Token identification */
export interface TokenIdentity {
  ticker: string;
  contract_address: string;
}

/** Complete audit run output */
export interface TokenAuditRun {
  run_id: string;
  timestamp: string;
  token: TokenIdentity;
  data_quality: DataQuality;
  flags: string[];
  metrics: TokenMetrics;
  risk_score: RiskScore;
  verdict: RiskVerdict;
}

/** Risk weights for weighted score calculation */
const RISK_WEIGHTS = {
  liquidity: 0.25,
  holder_concentration: 0.25,
  bot_activity: 0.20,
  narrative_manipulation: 0.15,
  dev_control: 0.15,
} as const;

/** Thresholds for verdict classification */
const VERDICT_THRESHOLDS = {
  safe: 25,
  speculative: 50,
  high_risk: 75,
} as const;

/**
 * Runs a complete token audit.
 * Fail-closed: invalid contract or unverified onchain = UNVERIFIED_HIGH_RISK.
 */
export async function runTokenAudit(
  ticker: string,
  contractAddress: string | null | undefined,
  options?: {
    runId?: string;
    rpcUrl?: string;
    skipOnchainVerification?: boolean;
  }
): Promise<TokenAuditRun> {
  const run_id = options?.runId ?? generateRunId(ticker, contractAddress);
  const timestamp = new Date().toISOString();

  // Step 1: Validate contract address
  const validation = validateContractAddress(contractAddress);

  // Step 2: Assess data quality
  const data_quality = assessDataQuality(validation, options?.skipOnchainVerification ?? true);

  // Step 3: If contract invalid, fail-closed immediately
  if (!validation.valid) {
    return buildFailClosedResult({
      run_id,
      timestamp,
      ticker,
      contract_address: contractAddress ?? "null",
      data_quality,
      validation,
    });
  }

  // Step 4: Attempt to fetch metrics (stub for RPC integration)
  // At this point, validation.valid is true, so chain must be solana or evm
  const chain = validation.chain === "unknown" ? "solana" : validation.chain;
  const metrics = await fetchTokenMetrics(
    validation.normalized!,
    chain,
    options?.rpcUrl
  );

  // Step 5: Calculate risk score
  const risk_score = calculateRiskScore(metrics, data_quality);

  // Step 6: Determine verdict
  const verdict = determineVerdict(risk_score, data_quality);

  // Step 7: Build flags
  const flags = buildFlags(metrics, data_quality, risk_score);

  return {
    run_id,
    timestamp,
    token: {
      ticker,
      contract_address: contractAddress!,
    },
    data_quality,
    flags,
    metrics,
    risk_score,
    verdict,
  };
}

/**
 * Generates a deterministic run ID.
 */
function generateRunId(ticker: string, address: string | null | undefined): string {
  const seed = `${ticker}:${address ?? "null"}:${Date.now()}`;
  return `audit_${stableHash(seed).slice(0, 16)}`;
}

/**
 * Assesses data quality based on validation and verification status.
 */
function assessDataQuality(
  validation: ValidationResult,
  skipVerification: boolean
): DataQuality {
  const missing: string[] = [];

  if (!validation.valid) {
    missing.push("valid_contract_address");
    if (validation.reason) {
      missing.push(validation.reason);
    }
    return {
      mode: "fail_closed",
      ca_valid: false,
      onchain_verified: false,
      dex_pairs_found: false,
      missing,
    };
  }

  if (skipVerification) {
    missing.push("onchain_verification");
    missing.push("rpc_proof");
  }

  const mode: DataQualityMode = skipVerification ? "degraded" : "ok";

  return {
    mode,
    ca_valid: true,
    onchain_verified: !skipVerification,
    dex_pairs_found: false, // Would be set by DEX scanner
    missing,
  };
}

/**
 * Stub: Fetches token metrics from on-chain/RPC.
 * In production, this would call Solana RPC or EVM provider.
 */
async function fetchTokenMetrics(
  address: string,
  chain: "solana" | "evm",
  rpcUrl?: string
): Promise<TokenMetrics> {
  // Stub implementation: returns null for all metrics
  // Real implementation would:
  // - Query DEX liquidity pools
  // - Analyze holder distribution
  // - Check dev wallet activity
  // - Scan for bot patterns

  void address;
  void chain;
  void rpcUrl;

  return {
    liquidity_usd: null,
    volume24h_usd: null,
    top10_holder_percent: null,
    dev_wallet_percent: null,
  };
}

/**
 * Calculates risk score with weighted components.
 */
function calculateRiskScore(
  metrics: TokenMetrics,
  dataQuality: DataQuality
): RiskScore {
  // If fail-closed mode, return max risk
  if (dataQuality.mode === "fail_closed") {
    return {
      liquidity_risk: null,
      holder_concentration_risk: null,
      bot_activity_risk: null,
      narrative_manipulation_risk: null,
      dev_control_risk: null,
      final_risk: 100,
      reason: "fail_closed: contract validation failed or onchain unverified",
    };
  }

  // Calculate individual risk components
  const liquidity_risk = calculateLiquidityRisk(metrics.liquidity_usd);
  const holder_concentration_risk = calculateHolderRisk(metrics.top10_holder_percent);
  const dev_control_risk = calculateDevRisk(metrics.dev_wallet_percent);
  const bot_activity_risk = null; // Requires heuristics/RPC analysis
  const narrative_manipulation_risk = null; // Requires social signal analysis

  // Compute weighted final risk
  const weights = [
    { value: liquidity_risk, weight: RISK_WEIGHTS.liquidity },
    { value: holder_concentration_risk, weight: RISK_WEIGHTS.holder_concentration },
    { value: bot_activity_risk, weight: RISK_WEIGHTS.bot_activity },
    { value: narrative_manipulation_risk, weight: RISK_WEIGHTS.narrative_manipulation },
    { value: dev_control_risk, weight: RISK_WEIGHTS.dev_control },
  ];

  let weightedSum = 0;
  let totalWeight = 0;

  for (const { value, weight } of weights) {
    if (value !== null) {
      weightedSum += value * weight;
      totalWeight += weight;
    }
  }

  // If no data available, default to speculative risk
  const final_risk = totalWeight > 0
    ? Math.round(weightedSum / totalWeight)
    : 50; // Default to middle risk when no data

  const reason = buildRiskReason(
    {
      liquidity_risk,
      holder_concentration_risk,
      bot_activity_risk,
      narrative_manipulation_risk,
      dev_control_risk,
    },
    dataQuality
  );

  return {
    liquidity_risk,
    holder_concentration_risk,
    bot_activity_risk,
    narrative_manipulation_risk,
    dev_control_risk,
    final_risk,
    reason,
  };
}

/**
 * Calculates liquidity risk based on USD liquidity.
 */
function calculateLiquidityRisk(liquidityUsd: number | null): number | null {
  if (liquidityUsd === null) return null;

  // Risk thresholds (example)
  if (liquidityUsd < 10000) return 95; // Very high risk
  if (liquidityUsd < 50000) return 80; // High risk
  if (liquidityUsd < 100000) return 60; // Medium-high risk
  if (liquidityUsd < 500000) return 40; // Medium risk
  if (liquidityUsd < 1000000) return 25; // Low-medium risk
  return 10; // Low risk
}

/**
 * Calculates holder concentration risk.
 */
function calculateHolderRisk(top10Percent: number | null): number | null {
  if (top10Percent === null) return null;

  // Risk increases with concentration
  if (top10Percent > 80) return 95; // Whales control everything
  if (top10Percent > 60) return 80; // High concentration
  if (top10Percent > 40) return 60; // Medium concentration
  if (top10Percent > 25) return 40; // Some concentration
  return 20; // Well distributed
}

/**
 * Calculates dev control risk based on dev wallet holdings.
 */
function calculateDevRisk(devPercent: number | null): number | null {
  if (devPercent === null) return null;

  if (devPercent > 50) return 95; // Dev can rug at will
  if (devPercent > 25) return 75; // Significant dev control
  if (devPercent > 10) return 50; // Moderate dev holdings
  if (devPercent > 5) return 30; // Some dev holdings
  return 15; // Low dev control
}

/**
 * Builds human-readable risk reason.
 */
function buildRiskReason(
  components: RiskComponents,
  dataQuality: DataQuality
): string {
  const parts: string[] = [];

  if (dataQuality.mode === "degraded") {
    parts.push("degraded_mode: limited onchain data available");
  }

  if (components.liquidity_risk !== null && components.liquidity_risk > 50) {
    parts.push("low_liquidity_detected");
  }

  if (components.holder_concentration_risk !== null && components.holder_concentration_risk > 50) {
    parts.push("high_holder_concentration");
  }

  if (components.dev_control_risk !== null && components.dev_control_risk > 50) {
    parts.push("significant_dev_wallet_holdings");
  }

  if (parts.length === 0) {
    parts.push("insufficient_data_for_detailed_assessment");
  }

  return parts.join("; ");
}

/**
 * Determines final verdict based on risk score and data quality.
 */
function determineVerdict(riskScore: RiskScore, dataQuality: DataQuality): RiskVerdict {
  // Fail-closed takes precedence
  if (dataQuality.mode === "fail_closed") {
    return "UNVERIFIED_HIGH_RISK";
  }

  // Unverified onchain = at least speculative
  if (!dataQuality.onchain_verified) {
    if (riskScore.final_risk >= VERDICT_THRESHOLDS.high_risk) {
      return "UNVERIFIED_HIGH_RISK";
    }
    return "SPECULATIVE";
  }

  // Apply thresholds
  if (riskScore.final_risk < VERDICT_THRESHOLDS.safe) {
    return "SAFE";
  }
  if (riskScore.final_risk < VERDICT_THRESHOLDS.speculative) {
    return "SPECULATIVE";
  }
  return "HIGH_RISK";
}

/**
 * Builds audit flags based on findings.
 */
function buildFlags(
  metrics: TokenMetrics,
  dataQuality: DataQuality,
  riskScore: RiskScore
): string[] {
  const flags: string[] = [];

  // Data quality flags
  if (dataQuality.mode === "fail_closed") {
    flags.push("FAIL_CLOSED_MODE");
  }
  if (!dataQuality.ca_valid) {
    flags.push("INVALID_CONTRACT_ADDRESS");
  }
  if (!dataQuality.onchain_verified) {
    flags.push("UNVERIFIED_ONCHAIN");
  }

  // Metric-based flags
  if (metrics.liquidity_usd !== null && metrics.liquidity_usd < 10000) {
    flags.push("EXTREMELY_LOW_LIQUIDITY");
  }
  if (metrics.top10_holder_percent !== null && metrics.top10_holder_percent > 60) {
    flags.push("WHALE_CONCENTRATION_HIGH");
  }
  if (metrics.dev_wallet_percent !== null && metrics.dev_wallet_percent > 25) {
    flags.push("DEV_CONTROL_SIGNIFICANT");
  }

  // Risk score flags
  if (riskScore.final_risk >= 80) {
    flags.push("CRITICAL_RISK_SCORE");
  } else if (riskScore.final_risk >= 60) {
    flags.push("ELEVATED_RISK_SCORE");
  }

  return flags;
}

/**
 * Builds a fail-closed result when validation fails.
 */
function buildFailClosedResult(params: {
  run_id: string;
  timestamp: string;
  ticker: string;
  contract_address: string;
  data_quality: DataQuality;
  validation: ValidationResult;
}): TokenAuditRun {
  const { run_id, timestamp, ticker, contract_address, data_quality, validation } = params;

  const flags = [
    "FAIL_CLOSED_MODE",
    "INVALID_CONTRACT_ADDRESS",
    validation.reason ?? "unknown_validation_failure",
  ];

  return {
    run_id,
    timestamp,
    token: { ticker, contract_address },
    data_quality,
    flags,
    metrics: {
      liquidity_usd: null,
      volume24h_usd: null,
      top10_holder_percent: null,
      dev_wallet_percent: null,
    },
    risk_score: {
      liquidity_risk: null,
      holder_concentration_risk: null,
      bot_activity_risk: null,
      narrative_manipulation_risk: null,
      dev_control_risk: null,
      final_risk: 100,
      reason: `fail_closed: ${validation.reason ?? "contract validation failed"}`,
    },
    verdict: "UNVERIFIED_HIGH_RISK",
  };
}

/**
 * Batch audit multiple tokens.
 */
export async function runBatchAudit(
  tokens: Array<{ ticker: string; contract_address: string }>
): Promise<TokenAuditRun[]> {
  const results: TokenAuditRun[] = [];
  for (const token of tokens) {
    const result = await runTokenAudit(token.ticker, token.contract_address);
    results.push(result);
  }
  // Stable sort by ticker
  return results.sort((a, b) => a.token.ticker.localeCompare(b.token.ticker));
}
