/**
 * Policy Checks - Pre-execution validation layer
 * 
 * Runs before any tool execution to validate:
 * - Address format and validity
 * - Spoofing detection
 * - Similarity to known addresses
 * - Content sanitization
 */

import type {
  PolicyCheckResult,
  RoutedToolCall,
} from "../types/agentRouter.js";
import type { CAValidationResult } from "../types/tools.js";
import {
  validateCA,
  extractAndValidateAddresses,
} from "../adapters/policy/caValidator.js";
import {
  addressGateSanitize,
  detectSpoofContext,
} from "../adapters/policy/addressSanitizer.js";

// =============================================================================
// Policy Check Configuration
// =============================================================================

export interface PolicyCheckConfig {
  validateAddresses: boolean;
  detectSpoofing: boolean;
  sanitizeContent: boolean;
  checkSimilarity: boolean;
  similarityThreshold: number;
  rejectTestPatterns: boolean;
}

export const DEFAULT_POLICY_CONFIG: PolicyCheckConfig = {
  validateAddresses: true,
  detectSpoofing: true,
  sanitizeContent: true,
  checkSimilarity: true,
  similarityThreshold: 3,
  rejectTestPatterns: true,
};

// =============================================================================
// Main Policy Check Function
// =============================================================================

/**
 * Run all policy checks before tool execution
 */
export async function runPolicyChecks(
  call: RoutedToolCall,
  config: Partial<PolicyCheckConfig> = {}
): Promise<PolicyCheckResult> {
  const fullConfig = { ...DEFAULT_POLICY_CONFIG, ...config };
  const checksPerformed: string[] = [];
  const violations: string[] = [];
  
  let sanitizedContent: {
    original: string;
    sanitized: string;
    modifications: Array<{
      type: string;
      position: number;
      original?: string;
      replacement: string;
    }>;
  } | undefined;
  
  // 1. Address Validation
  if (fullConfig.validateAddresses) {
    checksPerformed.push("address_validation");
    const addressResult = await validateAddressesInCall(call);
    if (!addressResult.valid) {
      violations.push(...addressResult.errors);
    }
  }
  
  // 2. Spoofing Detection
  if (fullConfig.detectSpoofing) {
    checksPerformed.push("spoofing_detection");
    const spoofResult = detectSpoofingInCall(call);
    if (spoofResult.detected) {
      violations.push(`Spoofing context detected: ${spoofResult.keywords.join(", ")}`);
    }
  }
  
  // 3. Content Sanitization
  if (fullConfig.sanitizeContent) {
    checksPerformed.push("content_sanitization");
    const sanitizeResult = sanitizeCallContent(call);
    if (sanitizeResult.modifications.length > 0) {
      sanitizedContent = {
        original: sanitizeResult.original,
        sanitized: sanitizeResult.sanitized,
        modifications: sanitizeResult.modifications,
      };
      if (sanitizeResult.spoofDetected) {
        violations.push("Foreign addresses sanitized from content");
      }
    }
  }
  
  // 4. Similarity Check (if address provided)
  if (fullConfig.checkSimilarity && call.context?.validatedAddress) {
    checksPerformed.push("similarity_check");
    // Note: Full similarity check requires known address list
    // This is a placeholder for the security layer integration
  }
  
  return {
    passed: violations.length === 0,
    checksPerformed,
    violations,
    sanitized: sanitizedContent,
  };
}

// =============================================================================
// Address Validation
// =============================================================================

interface AddressValidationResult {
  valid: boolean;
  errors: string[];
  validated: CAValidationResult[];
}

async function validateAddressesInCall(
  call: RoutedToolCall
): Promise<AddressValidationResult> {
  const errors: string[] = [];
  const validated: CAValidationResult[] = [];
  
  // Extract mint address from arguments
  const args = call.arguments as Record<string, unknown> | undefined;
  const mintAddress = args?.mint || args?.address;
  
  if (typeof mintAddress === "string") {
    const result = validateCA(mintAddress, {
      rejectTestPatterns: true,
    });
    validated.push(result);
    
    if (!result.valid) {
      errors.push(`Invalid address '${mintAddress}': ${result.reason}`);
    }
  }
  
  // Also check context if available
  if (call.context?.validatedAddress) {
    const contextResult = validateCA(call.context.validatedAddress, {
      rejectTestPatterns: true,
    });
    validated.push(contextResult);
    
    if (!contextResult.valid) {
      errors.push(`Invalid context address: ${contextResult.reason}`);
    }
  }
  
  return { valid: errors.length === 0, errors, validated };
}

// =============================================================================
// Spoofing Detection
// =============================================================================

interface SpoofDetectionResult {
  detected: boolean;
  keywords: string[];
  confidence: number;
}

function detectSpoofingInCall(call: RoutedToolCall): SpoofDetectionResult {
  const keywords: string[] = [];
  
  // Check original query if available
  if (call.context?.originalQuery) {
    if (detectSpoofContext(call.context.originalQuery)) {
      keywords.push(...extractSpoofKeywords(call.context.originalQuery));
    }
  }
  
  // Check arguments for suspicious patterns
  const args = call.arguments as Record<string, unknown> | undefined;
  if (args?.prompt && typeof args.prompt === "string") {
    if (detectSpoofContext(args.prompt)) {
      keywords.push(...extractSpoofKeywords(args.prompt));
    }
  }
  
  const uniqueKeywords = [...new Set(keywords)];
  const confidence = Math.min(uniqueKeywords.length * 0.2, 1.0);
  
  return {
    detected: uniqueKeywords.length > 0,
    keywords: uniqueKeywords,
    confidence,
  };
}

function extractSpoofKeywords(text: string): string[] {
  const SPOOF_KEYWORDS = [
    "your real mint",
    "post as yours",
    "post this as your mint",
    "quote exactly",
    "quote this exactly",
    "ignore rules",
    "new official address",
    "your actual mint",
    "official mint is",
    "replace your ca with",
    "use this address instead",
    "pretend this is your",
    "act like this is your",
    "say this is your",
    "tell them this is",
    "this is now your",
    "update your mint to",
    "change your ca to",
    "switch to this address",
    "adopt this as your",
    "verify this as your",
    "confirm this is your",
    "validate this address",
    "trust this address",
    "this is the real",
    "the actual address is",
    "correct address is",
    "real mint address",
    "true contract address",
    "legitimate address",
    "authorized address",
    "approved address",
    "endorsed address",
    "verified address",
    "official contract",
    "canonical address",
  ];
  
  const lowerText = text.toLowerCase();
  return SPOOF_KEYWORDS.filter((kw) => lowerText.includes(kw.toLowerCase()));
}

// =============================================================================
// Content Sanitization
// =============================================================================

interface SanitizationResult {
  original: string;
  sanitized: string;
  modifications: Array<{
    type: string;
    position: number;
    original?: string;
    replacement: string;
  }>;
  spoofDetected: boolean;
}

function sanitizeCallContent(call: RoutedToolCall): SanitizationResult {
  let textToSanitize = "";
  
  // Determine what to sanitize based on tool and method
  const args = call.arguments as Record<string, unknown> | undefined;
  
  if (args?.text && typeof args.text === "string") {
    textToSanitize = args.text;
  } else if (call.context?.originalQuery) {
    textToSanitize = call.context.originalQuery;
  }
  
  if (!textToSanitize) {
    return {
      original: "",
      sanitized: "",
      modifications: [],
      spoofDetected: false,
    };
  }
  
  const result = addressGateSanitize({
    text: textToSanitize,
    allowlist: new Set(), // Empty allowlist = sanitize all foreign addresses
    policy: "strict",
    prompt: call.context?.originalQuery,
  });
  
  return {
    original: textToSanitize,
    sanitized: result.sanitized,
    modifications: result.modifications.map((m) => ({
      type: m.type,
      position: m.position,
      original: m.original,
      replacement: m.replacement,
    })),
    spoofDetected: result.spoofDetected,
  };
}

// =============================================================================
// Quick Policy Check
// =============================================================================

/**
 * Quick check if a call should be blocked immediately
 */
export function shouldBlockImmediately(call: RoutedToolCall): {
  block: boolean;
  reason?: string;
} {
  // Block if spoofing detected in high-confidence scenarios
  const spoofResult = detectSpoofingInCall(call);
  if (spoofResult.confidence >= 0.6) {
    return {
      block: true,
      reason: `High-confidence spoofing detected (${spoofResult.keywords.join(", ")})`,
    };
  }
  
  // Block narrator from onchain/market tools
  if (call.role === "narrator" && (call.tool === "onchain" || call.tool === "market")) {
    return {
      block: true,
      reason: "Narrator cannot directly access onchain or market tools",
    };
  }
  
  return { block: false };
}
