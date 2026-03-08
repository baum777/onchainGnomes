/**
 * Onchain Adapter Errors
 *
 * RPC-specific error definitions and error classification for Solana RPC calls.
 * Maps RPC errors to ToolErrorCode for consistent error handling across the system.
 */

import type { ToolErrorCode } from "../../types/tools.js";

/**
 * Solana RPC error codes that we handle
 */
export type SolanaRpcErrorCode =
  | "PARSE_ERROR"
  | "INVALID_REQUEST"
  | "METHOD_NOT_FOUND"
  | "INVALID_PARAMS"
  | "INTERNAL_ERROR"
  | "SERVER_ERROR"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "CONNECTION_REFUSED"
  | "ACCOUNT_NOT_FOUND";

/**
 * Custom error class for Solana RPC operations
 */
export class SolanaRpcError extends Error {
  readonly code: SolanaRpcErrorCode;
  readonly rpcMethod: string;
  readonly slot?: number;
  readonly retryable: boolean;

  constructor(
    message: string,
    code: SolanaRpcErrorCode,
    rpcMethod: string,
    options?: {
      slot?: number;
      retryable?: boolean;
      cause?: unknown;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = "SolanaRpcError";
    this.code = code;
    this.rpcMethod = rpcMethod;
    this.slot = options?.slot;
    this.retryable = options?.retryable ?? isRetryableRpcError(code);
  }
}

/**
 * Map Solana RPC errors to standard ToolErrorCode
 */
export function mapRpcErrorToToolError(rpcError: SolanaRpcError): ToolErrorCode {
  const mapping: Record<SolanaRpcErrorCode, ToolErrorCode> = {
    PARSE_ERROR: "PARSE_ERROR",
    INVALID_REQUEST: "INVALID_INPUT",
    METHOD_NOT_FOUND: "UNEXPECTED",
    INVALID_PARAMS: "INVALID_INPUT",
    INTERNAL_ERROR: "RPC_DOWN",
    SERVER_ERROR: "RPC_DOWN",
    TIMEOUT: "TIMEOUT",
    NETWORK_ERROR: "RPC_DOWN",
    CONNECTION_REFUSED: "RPC_DOWN",
    ACCOUNT_NOT_FOUND: "NO_DATA",
  };

  return mapping[rpcError.code] ?? "UNEXPECTED";
}

/**
 * Determine if an RPC error is retryable
 */
export function isRetryableRpcError(code: SolanaRpcErrorCode): boolean {
  const retryableCodes: SolanaRpcErrorCode[] = [
    "TIMEOUT",
    "NETWORK_ERROR",
    "CONNECTION_REFUSED",
    "SERVER_ERROR",
    "INTERNAL_ERROR",
  ];
  return retryableCodes.includes(code);
}

/**
 * Error messages for common RPC failures
 */
export const RPC_ERROR_MESSAGES: Record<SolanaRpcErrorCode, string> = {
  PARSE_ERROR: "Failed to parse RPC response",
  INVALID_REQUEST: "Invalid RPC request format",
  METHOD_NOT_FOUND: "RPC method not found",
  INVALID_PARAMS: "Invalid parameters provided to RPC",
  INTERNAL_ERROR: "Internal RPC server error",
  SERVER_ERROR: "RPC server error",
  TIMEOUT: "RPC request timed out",
  NETWORK_ERROR: "Network error connecting to RPC",
  CONNECTION_REFUSED: "RPC connection refused",
  ACCOUNT_NOT_FOUND: "Account not found on-chain",
};

/**
 * Check if an error is a SolanaRpcError
 */
export function isSolanaRpcError(error: unknown): error is SolanaRpcError {
  return error instanceof SolanaRpcError;
}

/**
 * Create a SolanaRpcError from a standard Error
 */
export function createSolanaRpcError(
  error: unknown,
  rpcMethod: string,
  fallbackCode: SolanaRpcErrorCode = "INTERNAL_ERROR"
): SolanaRpcError {
  if (isSolanaRpcError(error)) {
    return error;
  }

  const message = error instanceof Error ? error.message : "Unknown RPC error";
  const code = detectErrorCode(error, fallbackCode);

  return new SolanaRpcError(message, code, rpcMethod, {
    cause: error,
    retryable: isRetryableRpcError(code),
  });
}

/**
 * Detect error code from unknown error
 */
function detectErrorCode(
  error: unknown,
  fallback: SolanaRpcErrorCode
): SolanaRpcErrorCode {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("timeout") || message.includes("etimedout")) {
      return "TIMEOUT";
    }
    if (message.includes("network") || message.includes("enotfound")) {
      return "NETWORK_ERROR";
    }
    if (message.includes("connection refused") || message.includes("econnrefused")) {
      return "CONNECTION_REFUSED";
    }
    if (message.includes("account not found") || message.includes("could not find account")) {
      return "ACCOUNT_NOT_FOUND";
    }
    if (message.includes("parse") || message.includes("invalid json")) {
      return "PARSE_ERROR";
    }
  }

  return fallback;
}
