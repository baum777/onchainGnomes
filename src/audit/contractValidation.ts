/**
 * Contract Address Validation
 * Implements fail-closed validation for Solana (base58) and EVM (0x + 40 hex) addresses.
 * Hard Rules:
 * - Solana: base58, 32-44 chars, no 0, O, I, l
 * - EVM: 0x prefix + exactly 40 hex chars
 */

import { createHash } from "crypto";

export type ChainType = "solana" | "evm" | "unknown";

export interface ValidationResult {
  valid: boolean;
  chain: ChainType;
  normalized: string | null;
  reason?: string;
  flags?: string[];
}

/** Base58 alphabet without ambiguous characters (0, O, I, l) */
const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** EVM address regex: 0x + 40 hex characters */
const EVM_REGEX = /^0x[a-fA-F0-9]{40}$/;

/** Detects if string contains ambiguous base58 chars */
const AMBIGUOUS_BASE58_CHARS = /[0OIl]/;

/**
 * Validates a contract address.
 * Fail-closed: any ambiguity or format error = invalid.
 * Supports (address) or (chain, address) for API compatibility.
 */
export function validateContractAddress(
  addressOrChain: string | null | undefined,
  address?: string
): ValidationResult {
  const addr = address !== undefined ? address : addressOrChain;
  const invalid = (chain: ChainType, reason: string): ValidationResult => ({
    valid: false,
    chain,
    normalized: null,
    reason,
    flags: ["INVALID_CONTRACT_FORMAT"],
  });

  // Handle null or undefined
  if (addr === null || addr === undefined) {
    return invalid("unknown", "address_null_or_undefined");
  }

  // Must be a string
  if (typeof addr !== "string") {
    return invalid("unknown", "address_not_string");
  }

  const trimmed = addr.trim();

  if (trimmed.length === 0) {
    return invalid("unknown", "address_empty");
  }

  // Check for EVM format first (starts with 0x)
  if (trimmed.toLowerCase().startsWith("0x")) {
    return validateEvmAddress(trimmed);
  }

  // Check for Solana format (base58)
  return validateSolanaAddress(trimmed);
}

function validateSolanaAddress(address: string): ValidationResult {
  const invalid = (reason: string): ValidationResult => ({
    valid: false,
    chain: "solana",
    normalized: null,
    reason,
    flags: ["INVALID_CONTRACT_FORMAT"],
  });

  // Check length constraints
  if (address.length < 32 || address.length > 44) {
    return invalid(`solana_address_length_invalid: ${address.length} chars (expected 32-44)`);
  }

  // Check for ambiguous characters that indicate possible spoofing
  if (AMBIGUOUS_BASE58_CHARS.test(address)) {
    return invalid("solana_address_contains_ambiguous_chars: 0, O, I, l are not valid base58");
  }

  // Validate base58 alphabet
  if (!BASE58_REGEX.test(address)) {
    return invalid("solana_address_invalid_base58");
  }

  return {
    valid: true,
    chain: "solana",
    normalized: address,
  };
}

function validateEvmAddress(address: string): ValidationResult {
  const invalid = (reason: string): ValidationResult => ({
    valid: false,
    chain: "evm",
    normalized: null,
    reason,
    flags: ["INVALID_CONTRACT_FORMAT"],
  });

  // Must be exactly 42 chars: 0x + 40 hex
  if (address.length !== 42) {
    return invalid(`evm_address_length_invalid: ${address.length} chars (expected 42)`);
  }

  // Check lowercase 0x prefix and hex chars
  if (!EVM_REGEX.test(address)) {
    return invalid("evm_address_invalid_hex");
  }

  // Normalize to lowercase
  const normalized = address.toLowerCase();

  return {
    valid: true,
    chain: "evm",
    normalized,
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
 * Generates a stable hash for deduplication.
 * Normalizes: lowercase, trim, collapse whitespace.
 */
export function stableHash(data: unknown): string {
  const normalized = normalizeForHashing(data);
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Normalizes data for stable hashing.
 * - Trims whitespace
 * - Collapses repeated punctuation
 * - Removes timestamps (ISO 8601 patterns)
 * - Sorts object keys deterministically
 */
export function normalizeForHashing(data: unknown): string {
  if (data === null || data === undefined) {
    return "";
  }

  let str = typeof data === "string" ? data : JSON.stringify(sortKeys(data));

  // Trim and lowercase
  str = str.trim().toLowerCase();

  // Collapse repeated whitespace
  str = str.replace(/\s+/g, " ");

  // Collapse repeated punctuation
  str = str.replace(/[.]{2,}/g, ".");
  str = str.replace(/[!]{2,}/g, "!");
  str = str.replace(/[?]{2,}/g, "?");
  str = str.replace(/[,]{2,}/g, ",");

  // Remove ISO 8601 timestamps
  str = str.replace(/\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}(\.\d+)?(z|[+-]\d{2}:\d{2})?/gi, "");

  // Remove UUID-like patterns
  str = str.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "");

  return str;
}

/**
 * Recursively sorts object keys for deterministic JSON serialization.
 */
function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }

  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  for (const key of keys) {
    sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * AddressGate-like validator to prevent false positives.
 * Returns true if address passes strict validation AND is not a known test pattern.
 */
export function strictAddressGate(
  address: string,
  options?: {
    allowTestPatterns?: boolean;
    requireOnchainPrefix?: boolean;
  }
): boolean {
  const result = validateContractAddress(address);

  if (!result.valid) {
    return false;
  }

  if (!options?.allowTestPatterns) {
    // Reject known test patterns
    const testPatterns = [
      /1234/,
      /abcd/i,
      /test/i,
      /fake/i,
      /dummy/i,
      /placeholder/i,
      /example/i,
    ];
    if (testPatterns.some((p) => p.test(address))) {
      return false;
    }
  }

  return true;
}
