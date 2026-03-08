/**
 * Tool Types - Shared schemas and types for tool-call modules
 * 
 * This module defines:
 * - Evidence: Proof objects returned from all tools
 * - ToolResult: Base result wrapper with evidence
 * - Onchain/Market/Policy specific types
 * - Zod schemas for runtime validation
 */

import { z } from "zod";

// =============================================================================
// Evidence - Proof objects returned from all tools
// =============================================================================

export const EvidenceSourceSchema = z.enum([
  "solana_rpc",
  "helius", 
  "moralis",
  "dexscreener",
  "gecko_terminal",
  "internal",
]);

export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;

export const EvidenceSchema = z.object({
  source: EvidenceSourceSchema,
  endpoint: z.string().optional(),
  slot: z.number().nullable(),
  timestamp: z.string().datetime(),
  signature: z.string().nullable(),
  notes: z.string().optional(),
});

export type Evidence = z.infer<typeof EvidenceSchema>;

// =============================================================================
// Base Tool Result
// =============================================================================

export const ToolErrorCodeSchema = z.enum([
  "INVALID_INPUT",
  "INVALID_MINT",
  "RPC_DOWN",
  "SOURCE_DOWN",
  "TIMEOUT",
  "PARSE_ERROR",
  "DISCREPANCY",
  "NO_DATA",
  "UNEXPECTED",
]);

export type ToolErrorCode = z.infer<typeof ToolErrorCodeSchema>;

export interface ToolResult<T> {
  success: boolean;
  data: T | null;
  evidence: Evidence | null;
  error?: {
    code: ToolErrorCode;
    message: string;
  };
  latencyMs: number;
}

// =============================================================================
// Onchain Types
// =============================================================================

export const CommitmentSchema = z.enum(["processed", "confirmed", "finalized"]);
export type Commitment = z.infer<typeof CommitmentSchema>;

export const OnchainInputSchema = z.object({
  mint: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Invalid Solana mint address"),
  rpcUrl: z.string().url().optional(),
  commitment: CommitmentSchema.default("confirmed"),
  timeoutMs: z.number().int().min(1000).max(60000).default(30000),
});

export type OnchainInput = z.infer<typeof OnchainInputSchema>;

export interface TokenMintInfo {
  mint: string;
  decimals: number;
  supply: string;
  isInitialized: boolean;
  freezeAuthority: string | null;
  mintAuthority: string | null;
}

export interface TokenAccountInfo {
  address: string;
  mint: string;
  owner: string;
  amount: string;
  decimals: number;
}

export interface LargestAccountsInfo {
  mint: string;
  accounts: TokenAccountInfo[];
}

export interface SupplyInfo {
  mint: string;
  total: string;
  circulating: string | null;
  nonCirculating: string | null;
}

export type OnchainResult<T> = ToolResult<T>;

// =============================================================================
// Market Types
// =============================================================================

export const MarketSourceSchema = z.enum(["dexscreener", "gecko_terminal"]);
export type MarketSource = z.infer<typeof MarketSourceSchema>;

export const MarketInputSchema = z.object({
  mint: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Invalid Solana mint address"),
  sources: z.array(MarketSourceSchema).default(["dexscreener"]),
  requireAllSources: z.boolean().default(false),
  timeoutMs: z.number().int().min(1000).max(60000).default(30000),
});

export type MarketInput = z.infer<typeof MarketInputSchema>;

export interface MarketQuote {
  mint: string;
  priceUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  marketCap: number | null;
  priceChange24h: number | null;
  pairAddress: string | null;
  dexId: string | null;
  timestamp: string;
}

export interface MarketResult<T> extends ToolResult<T> {
  sourceDiscrepancy?: {
    detected: boolean;
    details?: string;
  };
}

// =============================================================================
// Policy Types
// =============================================================================

export const ChainTypeSchema = z.enum(["solana", "evm", "unknown"]);
export type ChainType = z.infer<typeof ChainTypeSchema>;

export const SanitizePolicySchema = z.enum(["strict", "lenient"]);
export type SanitizePolicy = z.infer<typeof SanitizePolicySchema>;

export const ModificationTypeSchema = z.enum([
  "ADDRESS_REDACTED",
  "DECOY_INJECTED",
  "LENGTH_TRUNCATED",
]);

export type ModificationType = z.infer<typeof ModificationTypeSchema>;

export interface TextModification {
  type: ModificationType;
  original?: string;
  replacement: string;
  position: number;
}

export interface SanitizeResult {
  sanitized: string;
  modifications: TextModification[];
  spoofDetected: boolean;
  safety: {
    foreignAddressesFound: number;
    allowlistAddressesFound: number;
    decoyInjected: boolean;
  };
}

export interface CAValidationResult {
  valid: boolean;
  chain: ChainType;
  normalized: string | null;
  reason?: string;
  flags: string[];
  safety: {
    isTestPattern: boolean;
    hasAmbiguousChars: boolean;
    lengthValid: boolean;
  };
}

// =============================================================================
// Tool Registry Types
// =============================================================================

export type ToolName = "onchain" | "market" | "policy";

export interface ToolDefinition {
  name: ToolName;
  description: string;
  readOnly: boolean;
  supportedChains?: ChainType[];
}

export interface ToolRegistry {
  getTool(name: ToolName): ToolDefinition | undefined;
  listTools(): ToolDefinition[];
}

// =============================================================================
// Helper Functions
// =============================================================================

export function createEvidence(
  source: EvidenceSource,
  slot: number | null,
  options?: {
    endpoint?: string;
    signature?: string | null;
    notes?: string;
  }
): Evidence {
  return {
    source,
    endpoint: options?.endpoint,
    slot,
    timestamp: new Date().toISOString(),
    signature: options?.signature ?? null,
    notes: options?.notes,
  };
}

export function createErrorResult<T>(
  code: ToolErrorCode,
  message: string,
  latencyMs: number
): ToolResult<T> {
  return {
    success: false,
    data: null,
    evidence: null,
    error: { code, message },
    latencyMs,
  };
}

export function createSuccessResult<T>(
  data: T,
  evidence: Evidence,
  latencyMs: number
): ToolResult<T> {
  return {
    success: true,
    data,
    evidence,
    latencyMs,
  };
}
