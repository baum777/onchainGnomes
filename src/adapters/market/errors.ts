/**
 * Market Adapter Errors
 *
 * Market-specific error definitions for DexScreener, GeckoTerminal, and other
 * market data sources. Maps market API errors to ToolErrorCode.
 */

import type { ToolErrorCode } from "../../types/tools.js";

/**
 * Market data source types
 */
export type MarketDataSource = "dexscreener" | "gecko_terminal" | "coin_gecko" | "birdeye";

/**
 * Market API error codes
 */
export type MarketApiErrorCode =
  | "RATE_LIMITED"
  | "API_KEY_INVALID"
  | "API_KEY_EXPIRED"
  | "ENDPOINT_NOT_FOUND"
  | "PAIR_NOT_FOUND"
  | "TOKEN_NOT_FOUND"
  | "INVALID_RESPONSE"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "MAINTENANCE_MODE";

/**
 * Custom error class for Market API operations
 */
export class MarketApiError extends Error {
  readonly code: MarketApiErrorCode;
  readonly source: MarketDataSource;
  readonly endpoint: string;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;

  constructor(
    message: string,
    code: MarketApiErrorCode,
    source: MarketDataSource,
    endpoint: string,
    options?: {
      retryable?: boolean;
      retryAfterMs?: number;
      cause?: unknown;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = "MarketApiError";
    this.code = code;
    this.source = source;
    this.endpoint = endpoint;
    this.retryable = options?.retryable ?? isRetryableMarketError(code);
    this.retryAfterMs = options?.retryAfterMs;
  }
}

/**
 * Map Market API errors to standard ToolErrorCode
 */
export function mapMarketErrorToToolError(marketError: MarketApiError): ToolErrorCode {
  const mapping: Record<MarketApiErrorCode, ToolErrorCode> = {
    RATE_LIMITED: "TIMEOUT",
    API_KEY_INVALID: "UNEXPECTED",
    API_KEY_EXPIRED: "UNEXPECTED",
    ENDPOINT_NOT_FOUND: "SOURCE_DOWN",
    PAIR_NOT_FOUND: "NO_DATA",
    TOKEN_NOT_FOUND: "NO_DATA",
    INVALID_RESPONSE: "PARSE_ERROR",
    TIMEOUT: "TIMEOUT",
    NETWORK_ERROR: "SOURCE_DOWN",
    SERVER_ERROR: "SOURCE_DOWN",
    MAINTENANCE_MODE: "SOURCE_DOWN",
  };

  return mapping[marketError.code] ?? "UNEXPECTED";
}

/**
 * Determine if a market error is retryable
 */
export function isRetryableMarketError(code: MarketApiErrorCode): boolean {
  const retryableCodes: MarketApiErrorCode[] = [
    "RATE_LIMITED",
    "TIMEOUT",
    "NETWORK_ERROR",
    "SERVER_ERROR",
    "MAINTENANCE_MODE",
  ];
  return retryableCodes.includes(code);
}

/**
 * Error messages for common market API failures
 */
export const MARKET_ERROR_MESSAGES: Record<MarketApiErrorCode, string> = {
  RATE_LIMITED: "Rate limit exceeded for market API",
  API_KEY_INVALID: "Invalid API key for market data source",
  API_KEY_EXPIRED: "API key has expired",
  ENDPOINT_NOT_FOUND: "Market API endpoint not found",
  PAIR_NOT_FOUND: "Trading pair not found",
  TOKEN_NOT_FOUND: "Token not found on market data source",
  INVALID_RESPONSE: "Invalid response from market API",
  TIMEOUT: "Market API request timed out",
  NETWORK_ERROR: "Network error connecting to market API",
  SERVER_ERROR: "Market API server error",
  MAINTENANCE_MODE: "Market API is in maintenance mode",
};

/**
 * Rate limit information for market APIs
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTimestamp: number;
  source: MarketDataSource;
}

/**
 * Check if an error is a MarketApiError
 */
export function isMarketApiError(error: unknown): error is MarketApiError {
  return error instanceof MarketApiError;
}

/**
 * Create a MarketApiError from a standard Error or HTTP response
 */
export function createMarketApiError(
  error: unknown,
  source: MarketDataSource,
  endpoint: string,
  fallbackCode: MarketApiErrorCode = "SERVER_ERROR"
): MarketApiError {
  if (isMarketApiError(error)) {
    return error;
  }

  const message = error instanceof Error ? error.message : "Unknown market API error";
  const code = detectMarketErrorCode(error, fallbackCode);
  const retryAfterMs = extractRetryAfter(error);

  return new MarketApiError(message, code, source, endpoint, {
    cause: error,
    retryable: isRetryableMarketError(code),
    retryAfterMs,
  });
}

/**
 * Detect error code from unknown error
 */
function detectMarketErrorCode(
  error: unknown,
  fallback: MarketApiErrorCode
): MarketApiErrorCode {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("rate limit") || message.includes("too many requests") || message.includes("429")) {
      return "RATE_LIMITED";
    }
    if (message.includes("timeout") || message.includes("etimedout")) {
      return "TIMEOUT";
    }
    if (message.includes("network") || message.includes("enotfound") || message.includes("econnrefused")) {
      return "NETWORK_ERROR";
    }
    if (message.includes("not found") || message.includes("404")) {
      return "TOKEN_NOT_FOUND";
    }
    if (message.includes("invalid key") || message.includes("unauthorized") || message.includes("401")) {
      return "API_KEY_INVALID";
    }
    if (message.includes("maintenance") || message.includes("503")) {
      return "MAINTENANCE_MODE";
    }
    if (message.includes("parse") || message.includes("invalid json")) {
      return "INVALID_RESPONSE";
    }
  }

  return fallback;
}

/**
 * Extract retry-after information from error
 */
function extractRetryAfter(error: unknown): number | undefined {
  if (error instanceof Error) {
    const message = error.message;
    const match = message.match(/retry after (\d+)s/i) || message.match(/retry-after: (\d+)/i);
    if (match?.[1]) {
      return parseInt(match[1], 10) * 1000;
    }
  }
  return undefined;
}

/**
 * Source discrepancy error - thrown when multiple sources disagree
 */
export class SourceDiscrepancyError extends Error {
  readonly variance: number;
  readonly sources: string[];
  readonly field: string;

  constructor(
    message: string,
    variance: number,
    sources: string[],
    field: string
  ) {
    super(message);
    this.name = "SourceDiscrepancyError";
    this.variance = variance;
    this.sources = sources;
    this.field = field;
  }
}

/**
 * Check if error is a source discrepancy
 */
export function isSourceDiscrepancyError(error: unknown): error is SourceDiscrepancyError {
  return error instanceof SourceDiscrepancyError;
}
