/**
 * Retry Utility
 *
 * Exponential backoff with jitter for transient error handling.
 */

export type RetryOptions = {
  retries: number;
  baseMs: number;
  maxMs: number;
};

const DEFAULT_OPTIONS: RetryOptions = {
  retries: 3,
  baseMs: 250,
  maxMs: 4000,
};

export class RetryExhaustedError extends Error {
  constructor(
    message: string,
    public readonly lastError: unknown,
    public readonly attempts: number
  ) {
    super(message);
    this.name = "RetryExhaustedError";
  }
}

/**
 * Sleep for ms (promise-based)
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff + jitter
 */
function calculateDelay(attempt: number, opts: RetryOptions): number {
  // Exponential: base * 2^attempt
  const exponential = opts.baseMs * Math.pow(2, attempt);
  // Add jitter (0-25% random)
  const jitter = exponential * (Math.random() * 0.25);
  // Cap at maxMs
  return Math.min(exponential + jitter, opts.maxMs);
}

/**
 * Execute function with retry logic
 *
 * @param fn - Function to retry
 * @param opts - Retry options
 * @param isRetryable - Function to determine if error is retryable
 * @returns Result of fn
 * @throws RetryExhaustedError if all retries exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: Partial<RetryOptions> = {},
  isRetryable: (e: unknown) => boolean = () => true
): Promise<T> {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if this is the last attempt
      if (attempt === options.retries) {
        break;
      }

      // Check if error is retryable
      if (!isRetryable(error)) {
        throw error; // Non-retryable errors fail immediately
      }

      // Calculate and apply delay
      const delay = calculateDelay(attempt, options);
      console.log(`[Retry] Attempt ${attempt + 1}/${options.retries + 1} failed, retrying in ${Math.round(delay)}ms...`);
      await sleep(delay);
    }
  }

  throw new RetryExhaustedError(
    `Failed after ${options.retries + 1} attempts`,
    lastError,
    options.retries + 1
  );
}

/**
 * Default retryable checker for X API errors
 * Detects rate limits, 502/503, network timeouts
 */
export function isXApiRetryable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const e = error as any;

  // Rate limit (429)
  if (e.code === 429 || e.statusCode === 429 || e.rateLimitError) {
    return true;
  }

  // Server errors (502, 503)
  if (e.code === 502 || e.code === 503 || e.statusCode === 502 || e.statusCode === 503) {
    return true;
  }

  // Network errors
  if (e.code === "ETIMEDOUT" || e.code === "ECONNRESET" || e.code === "ENOTFOUND") {
    return true;
  }

  // Message-based detection
  const message = String(e.message || "").toLowerCase();
  if (
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("timeout") ||
    message.includes("etimedout") ||
    message.includes("econnreset") ||
    message.includes("temporary") ||
    message.includes("unavailable") ||
    message.includes("retry")
  ) {
    return true;
  }

  return false;
}
