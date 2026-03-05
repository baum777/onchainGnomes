/**
 * Truth Gate - Response Classification System
 *
 * Categorizes bot responses into three categories:
 * - FACT: Verified on-chain or market data only
 * - LORE: Creative narrative content (stored in lore store)
 * - OPINION: Unrestricted commentary and analysis
 *
 * Rules:
 * - FACT → requires verified sources (RPC, explorer, audit)
 * - LORE → creative but must be stored for consistency
 * - OPINION → unrestricted, no verification needed
 *
 * Prevents fact hallucination by gating unverified claims.
 */

import type { TruthCategory, TruthClassification } from "../types/coreTypes.js";
import type { TokenAuditRun } from "../audit/tokenAuditEngine.js";

export interface TruthGateDeps {
  // Optional: Fact store for verification lookups
  factStore?: {
    getFact: (topic: string) => Promise<{ content: string; verified: boolean } | null>;
  };
}

/** Context for truth classification */
export interface TruthGateContext {
  hasAuditData?: boolean;
  auditResult?: TokenAuditRun | null;
  containsContractAddress?: boolean;
  contractValidationResult?: { valid: boolean };
}

/**
 * Categorizes a response into FACT, LORE, or OPINION.
 * This is the main entry point for the truth gate.
 */
export function categorizeResponse(
  response: string,
  context: TruthGateContext = {}
): TruthClassification {
  // Step 1: Check for factual claims that need verification
  const factualClaims = extractFactualClaims(response);

  if (factualClaims.length === 0) {
    // No factual claims = likely OPINION or LORE
    if (containsLoreMarkers(response)) {
      return {
        category: "LORE",
        confidence: 0.8,
        requires_verification: false,
        reasoning: "Contains narrative/lore markers without factual claims",
      };
    }

    return {
      category: "OPINION",
      confidence: 0.9,
      requires_verification: false,
      reasoning: "No verifiable factual claims detected",
    };
  }

  // Step 2: Check if factual claims are verified
  const verified = areClaimsVerified(factualClaims, context);

  if (verified.verified) {
    return {
      category: "FACT",
      confidence: verified.confidence,
      requires_verification: false,
      sources: verified.sources,
      reasoning: `Factual claims verified: ${verified.sources?.join(", ")}`,
    };
  }

  // Step 3: Unverified factual claims = high risk
  return {
    category: "OPINION", // Downgrade to opinion with warning
    confidence: 0.6,
    requires_verification: true,
    reasoning: `Unverified factual claims detected: ${verified.unverifiedClaims?.join(", ")}. Must verify before claiming as FACT.`,
  };
}

/**
 * Validates that a response claiming FACT status actually has proof.
 * Returns corrected category if needed.
 */
export function validateFactClaims(
  response: string,
  context: TruthGateContext
): { category: TruthCategory; violations: string[] } {
  const violations: string[] = [];

  // Check for "verified" claims without proof
  if (claimsVerifiedWithoutProof(response)) {
    if (!context.hasAuditData || !context.auditResult?.data_quality?.onchain_verified) {
      violations.push("VERIFIED_CLAIM_WITHOUT_PROOF");
    }
  }

  // Check for market data without sources
  if (containsMarketData(response) && !hasMarketSource(response)) {
    violations.push("MARKET_DATA_WITHOUT_SOURCE");
  }

  // Check for contract claims without validation
  if (context.containsContractAddress && !context.contractValidationResult?.valid) {
    violations.push("CONTRACT_CLAIM_WITHOUT_VALIDATION");
  }

  // Determine final category
  if (violations.length > 0) {
    return {
      category: "OPINION", // Downgrade to opinion
      violations,
    };
  }

  return {
    category: "FACT",
    violations: [],
  };
}

/**
 * Checks if a response is safe to send (no hallucinated facts).
 */
export function isResponseSafe(
  response: string,
  context: TruthGateContext
): { safe: boolean; reason?: string } {
  const classification = categorizeResponse(response, context);

  // FACT responses are safe if verified
  if (classification.category === "FACT" && classification.confidence > 0.7) {
    return { safe: true };
  }

  // LORE responses are safe (creative content)
  if (classification.category === "LORE") {
    return { safe: true };
  }

  // OPINION with unverified claims needs warning
  if (classification.category === "OPINION" && classification.requires_verification) {
    return {
      safe: false,
      reason: classification.reasoning,
    };
  }

  // Pure opinion without claims is safe
  return { safe: true };
}

// =============================================================================
// Internal Helper Functions
// =============================================================================

/**
 * Extracts factual claims from response text.
 */
function extractFactualClaims(response: string): string[] {
  const claims: string[] = [];

  // Patterns for factual claims
  const factPatterns = [
    // Market data claims
    { pattern: /\b(liquidity|volume|mcap|market cap)\s*(?:is|at|equals?)\s*[$]?[\d,.]+[KMBT]?\b/gi, type: "market" },
    // Holder claims
    { pattern: /\b(top\s*\d+|holders?|whales?)\s*(?:hold|control|own|have)\s*[\d,.]+%?\b/gi, type: "holders" },
    // Contract status claims
    { pattern: /\b(contract|CA)\s*(?:is|verified|valid|legitimate)\b/gi, type: "contract" },
    // Price claims
    { pattern: /\b(price)\s*(?:is|at|was)\s*[$]?[\d,.]+\b/gi, type: "price" },
    // Supply claims
    { pattern: /\b(supply|total\s*supply|circulating)\s*(?:is|at)\s*[\d,.]+[KMBT]?\b/gi, type: "supply" },
    // Dev/team claims
    { pattern: /\b(dev|team|founder)\s*(?:is|are|has|have|holds?)\b/gi, type: "dev" },
  ];

  for (const { pattern, type } of factPatterns) {
    const matches = response.match(pattern);
    if (matches) {
      claims.push(...matches.map(m => `${type}: ${m}`));
    }
  }

  return claims;
}

/**
 * Checks if claims are verified based on context.
 */
function areClaimsVerified(
  claims: string[],
  context: TruthGateContext
): { verified: boolean; confidence: number; sources?: string[]; unverifiedClaims?: string[] } {
  const sources: string[] = [];
  const unverifiedClaims: string[] = [];

  // Check if we have audit data
  if (context.hasAuditData && context.auditResult) {
    const audit = context.auditResult;

    // Check data quality
    if (audit.data_quality.mode === "fail_closed") {
      return {
        verified: false,
        confidence: 0,
        unverifiedClaims: claims,
      };
    }

    if (audit.data_quality.onchain_verified) {
      sources.push("onchain_rpc");
    }

    if (audit.data_quality.dex_pairs_found) {
      sources.push("dex_screener");
    }

    // Check specific claims against audit data
    for (const claim of claims) {
      const verified = verifyClaimAgainstAudit(claim, audit);
      if (!verified) {
        unverifiedClaims.push(claim);
      }
    }

    if (unverifiedClaims.length === 0 && sources.length > 0) {
      return {
        verified: true,
        confidence: 0.85,
        sources,
      };
    }
  }

  // Check for explorer references in response
  if (sources.length === 0) {
    // No audit data, check for manual sources
    return {
      verified: false,
      confidence: 0.3,
      unverifiedClaims: claims,
    };
  }

  return {
    verified: unverifiedClaims.length === 0,
    confidence: sources.length > 0 ? 0.7 : 0.3,
    sources,
    unverifiedClaims: unverifiedClaims.length > 0 ? unverifiedClaims : undefined,
  };
}

/**
 * Verifies a specific claim against audit data.
 */
function verifyClaimAgainstAudit(claim: string, audit: TokenAuditRun): boolean {
  // Check liquidity claims
  if (claim.includes("market") || claim.includes("liquidity")) {
    return audit.metrics.liquidity_usd !== null;
  }

  // Check holder claims
  if (claim.includes("holder") || claim.includes("whale")) {
    return audit.metrics.top10_holder_percent !== null;
  }

  // Check dev claims
  if (claim.includes("dev")) {
    return audit.metrics.dev_wallet_percent !== null;
  }

  // Check contract claims
  if (claim.includes("contract")) {
    return audit.data_quality.ca_valid && audit.data_quality.onchain_verified;
  }

  return false;
}

/**
 * Checks for lore/narrative markers in response.
 * Must be narrative/creative content, not just mentions of these words.
 */
function containsLoreMarkers(response: string): boolean {
  const lorePatterns = [
    // Origin/backstory patterns (first person or identity statements)
    /\b(i am|i'm|we are|we're)\s+(?:from|born|created|from)/i,
    /\b(my|our)\s+(?:origin|backstory|beginning|creation)/i,
    /\bwhere\s+(?:i|we)\s+(?:come|originate|emerge)\s+from/i,
    // Narrative patterns
    /\b(story|legend|myth|tale)\s+(?:goes|says|tells)/i,
    // Location/identity with narrative context
    /\bthe\s+(?:void|abyss|shadows?)\s+(?:behind|beyond|between)/i,
    /\b(i|we)\s+(?:watch|live|dwell|exist)\s+(?:in|within)/i,
    // Mystical/identity phrases
    /\b(i|we)\s+(?:don't|never)\s+(?:sleep|rest)/i,
    /\bwhere\s+(?:the|charts|candles?)\s+(?:whisper|dance|speak)/i,
  ];

  // Must have at least one strong lore pattern AND not be primarily about market data
  const hasLore = lorePatterns.some(p => p.test(response));
  
  // If it has clear factual/market claims, it's probably not lore
  const hasMarketClaims = /\$[\d,.]+[KMBT]?/.test(response) && 
                          /\b(liquidity|volume|mcap|price|holders?)\b/i.test(response);
  
  return hasLore && !hasMarketClaims;
}

/**
 * Detects "verified" claims without proof indicators.
 */
function claimsVerifiedWithoutProof(response: string): boolean {
  const verifiedPatterns = [
    /\bverified\b.*\bsafe\b/i,
    /\bconfirmed\b.*\bofficial\b/i,
    /\blegitimate\b/i,
    /\bgenuine\b/i,
    /\bauthentic\b/i,
  ];

  const proofIndicators = [
    /rpc/i,
    /explorer/i,
    /solscan/i,
    /solana.?fm/i,
    /birdeye/i,
    /dexscreener/i,
    /on-?chain/i,
    /audit/i,
  ];

  const hasVerifiedClaim = verifiedPatterns.some(p => p.test(response));
  const hasProofIndicator = proofIndicators.some(p => p.test(response));

  return hasVerifiedClaim && !hasProofIndicator;
}

/**
 * Detects market data in response.
 */
function containsMarketData(response: string): boolean {
  const marketPatterns = [
    /\$[\d,.]+[KMBT]?/,
    /[\d,.]+%/,
    /\b(price|volume|liquidity|mcap|market cap)\b/i,
  ];

  return marketPatterns.some(p => p.test(response));
}

/**
 * Checks for market data source references.
 */
function hasMarketSource(response: string): boolean {
  const sourcePatterns = [
    /\b(?:according to|per|from)\b/i,
    /\b(dexscreener|birdeye|coingecko|coinmarketcap)\b/i,
    /\bdata\s*shows?\b/i,
    /\bon-?chain\s*data\b/i,
  ];

  return sourcePatterns.some(p => p.test(response));
}

/**
 * Creates a fail-closed classification for unverified data.
 */
export function createFailClosedClassification(reason: string): TruthClassification {
  return {
    category: "OPINION",
    confidence: 0.5,
    requires_verification: true,
    reasoning: `Fail-closed: ${reason}`,
  };
}
