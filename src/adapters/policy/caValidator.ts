/**
 * CA Validator - Contract Address Validation
 * 
 * Implements fail-closed validation for Solana (base58) and EVM (0x + 40 hex) addresses.
 * Hard Rules:
 * - Solana: base58, 32-44 chars, no 0, O, I, l
 * - EVM: 0x prefix + exactly 40 hex chars
 */

import type { ChainType, CAValidationResult } from "../../types/tools.js";

/** Base58 alphabet without ambiguous characters (0, O, I, l) */
const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** EVM address regex: 0x + 40 hex characters */
const EVM_REGEX = /^0x[a-fA-F0-9]{40}$/;

/** Detects if string contains ambiguous base58 chars */
const AMBIGUOUS_BASE58_CHARS = /[0OIl]/;

/** Test patterns to reject - expanded with additional patterns (NEW) */
const TEST_PATTERNS = [
  /123456789/,
  /abcdefghi/i,
  /testtest/i,
  /fakefake/i,
  /dummyaddress/i,
  /placeholder/i,
  /exampleaddress/i,
  /deadbeef/i,
  /aaaaaaaaaa/i,  // Repeated chars
  /xxxxxxxxxx/i,  // Repeated x
  /nulladdress/i, // Common placeholder
  /mintaddress/i, // Generic placeholder
  /tokenaddress/i, // Generic placeholder
];

export interface ValidateCAOptions {
  allowedChains?: ChainType[];
  rejectTestPatterns?: boolean;
}

/**
 * Validates a contract address.
 * Fail-closed: any ambiguity or format error = invalid.
 */
export function validateCA(
  address: string | null | undefined,
  options: ValidateCAOptions = {}
): CAValidationResult {
  const { allowedChains = ["solana", "evm"], rejectTestPatterns = true } = options;
  
  const flags: string[] = [];

  // 1. Null/undefined check
  if (address === null || address === undefined) {
    return {
      valid: false,
      chain: "unknown",
      normalized: null,
      reason: "address_null_or_undefined",
      flags: ["INVALID_CONTRACT_FORMAT", "NULL_ADDRESS"],
      safety: {
        isTestPattern: false,
        hasAmbiguousChars: false,
        lengthValid: false,
      },
    };
  }

  // 2. Type check (must be string)
  if (typeof address !== "string") {
    return {
      valid: false,
      chain: "unknown",
      normalized: null,
      reason: "address_not_string",
      flags: ["INVALID_CONTRACT_FORMAT", "TYPE_ERROR"],
      safety: {
        isTestPattern: false,
        hasAmbiguousChars: false,
        lengthValid: false,
      },
    };
  }

  const trimmed = address.trim();

  // 3. Empty check
  if (trimmed.length === 0) {
    return {
      valid: false,
      chain: "unknown",
      normalized: null,
      reason: "address_empty",
      flags: ["INVALID_CONTRACT_FORMAT", "EMPTY_ADDRESS"],
      safety: {
        isTestPattern: false,
        hasAmbiguousChars: false,
        lengthValid: false,
      },
    };
  }

  // 4. Test pattern check
  const isTestPattern = TEST_PATTERNS.some((pattern) => pattern.test(trimmed));
  if (rejectTestPatterns && isTestPattern) {
    return {
      valid: false,
      chain: "unknown",
      normalized: null,
      reason: "address_contains_test_pattern",
      flags: ["INVALID_CONTRACT_FORMAT", "TEST_PATTERN_DETECTED"],
      safety: {
        isTestPattern: true,
        hasAmbiguousChars: false,
        lengthValid: false,
      },
    };
  }

  // 5. Chain detection and validation
  if (trimmed.toLowerCase().startsWith("0x")) {
    return validateEvmAddress(trimmed, allowedChains, flags, isTestPattern);
  }

  return validateSolanaAddress(trimmed, allowedChains, flags, isTestPattern);
}

function validateSolanaAddress(
  address: string,
  allowedChains: ChainType[],
  flags: string[],
  isTestPattern: boolean
): CAValidationResult {
  const hasAmbiguousChars = AMBIGUOUS_BASE58_CHARS.test(address);
  const lengthValid = address.length >= 32 && address.length <= 44;

  // Check if Solana is allowed
  if (!allowedChains.includes("solana")) {
    return {
      valid: false,
      chain: "solana",
      normalized: null,
      reason: "solana_chain_not_allowed",
      flags: [...flags, "CHAIN_NOT_ALLOWED"],
      safety: {
        isTestPattern,
        hasAmbiguousChars,
        lengthValid,
      },
    };
  }

  // Check length
  if (!lengthValid) {
    return {
      valid: false,
      chain: "solana",
      normalized: null,
      reason: `solana_address_length_invalid: ${address.length} chars (expected 32-44)`,
      flags: [...flags, "INVALID_CONTRACT_FORMAT", "INVALID_LENGTH"],
      safety: {
        isTestPattern,
        hasAmbiguousChars,
        lengthValid: false,
      },
    };
  }

  // Check for ambiguous characters
  if (hasAmbiguousChars) {
    return {
      valid: false,
      chain: "solana",
      normalized: null,
      reason: "solana_address_contains_ambiguous_chars: 0, O, I, l are not valid base58",
      flags: [...flags, "INVALID_CONTRACT_FORMAT", "AMBIGUOUS_CHARS"],
      safety: {
        isTestPattern,
        hasAmbiguousChars: true,
        lengthValid,
      },
    };
  }

  // Validate base58 alphabet
  if (!BASE58_REGEX.test(address)) {
    return {
      valid: false,
      chain: "solana",
      normalized: null,
      reason: "solana_address_invalid_base58",
      flags: [...flags, "INVALID_CONTRACT_FORMAT", "INVALID_BASE58"],
      safety: {
        isTestPattern,
        hasAmbiguousChars: false,
        lengthValid,
      },
    };
  }

  // Valid Solana address
  return {
    valid: true,
    chain: "solana",
    normalized: address,
    flags,
    safety: {
      isTestPattern,
      hasAmbiguousChars: false,
      lengthValid: true,
    },
  };
}

function validateEvmAddress(
  address: string,
  allowedChains: ChainType[],
  flags: string[],
  isTestPattern: boolean
): CAValidationResult {
  const lengthValid = address.length === 42;

  // Check if EVM is allowed
  if (!allowedChains.includes("evm")) {
    return {
      valid: false,
      chain: "evm",
      normalized: null,
      reason: "evm_chain_not_allowed",
      flags: [...flags, "CHAIN_NOT_ALLOWED"],
      safety: {
        isTestPattern,
        hasAmbiguousChars: false,
        lengthValid,
      },
    };
  }

  // Check length
  if (!lengthValid) {
    return {
      valid: false,
      chain: "evm",
      normalized: null,
      reason: `evm_address_length_invalid: ${address.length} chars (expected 42)`,
      flags: [...flags, "INVALID_CONTRACT_FORMAT", "INVALID_LENGTH"],
      safety: {
        isTestPattern,
        hasAmbiguousChars: false,
        lengthValid: false,
      },
    };
  }

  // Check hex format
  if (!EVM_REGEX.test(address)) {
    return {
      valid: false,
      chain: "evm",
      normalized: null,
      reason: "evm_address_invalid_hex",
      flags: [...flags, "INVALID_CONTRACT_FORMAT", "INVALID_HEX"],
      safety: {
        isTestPattern,
        hasAmbiguousChars: false,
        lengthValid: true,
      },
    };
  }

  // Valid EVM address
  const normalized = address.toLowerCase();
  return {
    valid: true,
    chain: "evm",
    normalized,
    flags,
    safety: {
      isTestPattern,
      hasAmbiguousChars: false,
      lengthValid: true,
    },
  };
}

/**
 * Determines chain type from address format without full validation.
 * Used for early detection in audit pipeline.
 */
export function detectChainType(address: string): ChainType {
  if (address.toLowerCase().startsWith("0x")) {
    return "evm";
  }
  if (address.length >= 32 && address.length <= 44) {
    return "solana";
  }
  return "unknown";
}

/**
 * Strict address gate - combines validation with test pattern rejection
 * This is the primary function for pipeline use (NEW)
 */
export function strictAddressGate(
  address: string,
  options?: {
    allowTestPatterns?: boolean;
    requireOnchainPrefix?: boolean;
    allowedChains?: ChainType[];
  }
): boolean {
  const result = validateCA(address, {
    rejectTestPatterns: !options?.allowTestPatterns,
    allowedChains: options?.allowedChains,
  });

  return result.valid;
}

/**
 * Extract and validate all addresses from text
 * Returns only valid addresses (NEW)
 */
export function extractAndValidateAddresses(
  text: string,
  options?: ValidateCAOptions
): {
  valid: Array<{ address: string; chain: ChainType; normalized: string }>;
  invalid: Array<{ address: string; reason: string }>;
} {
  const base58Candidates = text.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g) || [];
  const evmCandidates = text.match(/\b0x[a-fA-F0-9]{40}\b/g) || [];
  const allCandidates = [...new Set([...base58Candidates, ...evmCandidates])];

  const valid: Array<{ address: string; chain: ChainType; normalized: string }> = [];
  const invalid: Array<{ address: string; reason: string }> = [];

  for (const candidate of allCandidates) {
    const result = validateCA(candidate, options);
    if (result.valid && result.normalized) {
      valid.push({
        address: candidate,
        chain: result.chain,
        normalized: result.normalized,
      });
    } else {
      invalid.push({
        address: candidate,
        reason: result.reason || "validation_failed",
      });
    }
  }

  return { valid, invalid };
}
