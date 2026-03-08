/**
 * Verification Pipeline Types
 *
 * Defines types for the end-to-end verification pipeline that coordinates
 * policy, onchain, and market tools to verify token claims.
 */

import type {
  TokenMintInfo,
  SupplyInfo,
  LargestAccountsInfo,
  MarketQuote,
  Evidence,
  VerificationStatus,
  CAValidationResult,
  SanitizeResult,
} from "../types/tools.js";

/**
 * Input to the verification pipeline
 */
export interface VerificationPipelineInput {
  /** Raw user query or text containing potential CA */
  query: string;
  /** Optional explicit CA if already extracted */
  ca?: string;
  /** Required verification depth */
  depth: "lite" | "standard" | "deep";
  /** Whether to fetch market data */
  includeMarketData: boolean;
  /** Allowlist of trusted addresses (for sanitization) */
  allowlist?: Set<string>;
  /** Timeout override per tool category */
  timeoutsMs?: {
    policy?: number;
    onchain?: number;
    market?: number;
  };
  /** Cache policy */
  cachePolicy?: "use_cache" | "bypass_cache";
}

/**
 * Output from the verification pipeline
 */
export interface VerificationPipelineOutput {
  /** Overall verification status */
  status: VerificationStatus;
  /** Validated contract address (null if invalid) */
  ca: string | null;
  /** Chain type detected */
  chain: "solana" | "evm" | "unknown";
  /** Evidence collected during verification */
  evidence: Evidence[];
  /** Warning/error flags */
  flags: string[];
  /** Onchain verification results */
  onchain: {
    success: boolean;
    mintInfo: TokenMintInfo | null;
    supply: SupplyInfo | null;
    largestAccounts: LargestAccountsInfo | null;
    error?: string;
  };
  /** Market data results */
  market: {
    success: boolean;
    quote: MarketQuote | null;
    sourceDiscrepancy?: {
      detected: boolean;
      details?: string;
    };
    error?: string;
  };
  /** Policy/safety check results */
  policy: {
    caValidation: CAValidationResult | null;
    sanitization: SanitizeResult | null;
    spoofDetected: boolean;
    shouldBlock: boolean;
  };
  /** Timing information */
  timing: {
    startedAt: string;
    completedAt: string;
    totalMs: number;
    policyMs: number;
    onchainMs: number;
    marketMs: number;
  };
}

/**
 * Internal context maintained during pipeline execution
 */
export interface VerificationContext {
  /** Unique request identifier */
  requestId: string;
  /** When the verification started */
  startedAt: string;
  /** Current pipeline phase */
  phase: VerificationPhase;
  /** Extracted candidate addresses */
  candidateAddresses: string[];
  /** Validated address (if any) */
  validatedAddress: string | null;
  /** CA validation result */
  caValidation: CAValidationResult | null;
  /** Sanitization result */
  sanitization: SanitizeResult | null;
  /** Whether spoofing was detected */
  spoofDetected: boolean;
  /** Whether to block the request */
  shouldBlock: boolean;
  /** Collected evidence */
  evidence: Evidence[];
  /** Error messages */
  errors: string[];
  /** Warning flags */
  flags: string[];
  /** Timing per phase */
  timing: {
    policyStart?: number;
    policyEnd?: number;
    onchainStart?: number;
    onchainEnd?: number;
    marketStart?: number;
    marketEnd?: number;
  };
}

/**
 * Pipeline execution phases
 */
export type VerificationPhase =
  | "idle"
  | "sanitizing"
  | "extracting_ca"
  | "validating_ca"
  | "fetching_onchain"
  | "fetching_market"
  | "synthesizing"
  | "completed"
  | "failed";

/**
 * Configuration for the verification pipeline
 */
export interface VerificationPipelineConfig {
  /** Maximum time for entire pipeline */
  maxTotalTimeoutMs: number;
  /** Individual tool timeouts */
  toolTimeouts: {
    policy: number;
    onchain: number;
    market: number;
  };
  /** Whether to require all sources for market data */
  requireAllMarketSources: boolean;
  /** Price discrepancy threshold percentage */
  priceDiscrepancyThreshold: number;
  /** Whether to block on spoof detection */
  blockOnSpoof: boolean;
  /** Whether to allow test pattern addresses */
  allowTestPatterns: boolean;
}

/**
 * Default pipeline configuration
 */
export const DEFAULT_PIPELINE_CONFIG: VerificationPipelineConfig = {
  maxTotalTimeoutMs: 60000,
  toolTimeouts: {
    policy: 5000,
    onchain: 30000,
    market: 15000,
  },
  requireAllMarketSources: false,
  priceDiscrepancyThreshold: 10,
  blockOnSpoof: true,
  allowTestPatterns: false,
};

/**
 * Result of the policy validation phase
 */
export interface PolicyPhaseResult {
  success: boolean;
  shouldProceed: boolean;
  shouldBlock: boolean;
  caValidation: CAValidationResult | null;
  sanitization: SanitizeResult | null;
  extractedAddresses: string[];
  error?: string;
}

/**
 * Result of the onchain fetch phase
 */
export interface OnchainPhaseResult {
  success: boolean;
  mintInfo: TokenMintInfo | null;
  supply: SupplyInfo | null;
  largestAccounts: LargestAccountsInfo | null;
  evidence: Evidence[];
  error?: string;
}

/**
 * Result of the market fetch phase
 */
export interface MarketPhaseResult {
  success: boolean;
  quote: MarketQuote | null;
  sourceDiscrepancy?: {
    detected: boolean;
    details?: string;
  };
  evidence: Evidence[];
  error?: string;
}

/**
 * Guard check result
 */
export interface GuardCheckResult {
  passed: boolean;
  reason?: string;
  severity: "info" | "warning" | "error" | "critical";
}
