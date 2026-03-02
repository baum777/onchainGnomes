import { describe, it, expect } from "vitest";
import { withRetry, RetryExhaustedError, isXApiRetryable } from "../../src/utils/retry.js";

describe("withRetry", () => {
  it("returns success on first attempt", async () => {
    const fn = () => Promise.resolve("success");
    const result = await withRetry(fn, { retries: 3, baseMs: 10, maxMs: 100 });
    expect(result).toBe("success");
  });

  it("retries and succeeds on second attempt", async () => {
    let attempts = 0;
    const fn = () => {
      attempts++;
      if (attempts === 1) {
        throw new Error("First attempt fails");
      }
      return Promise.resolve("success");
    };

    const result = await withRetry(fn, { retries: 3, baseMs: 10, maxMs: 100 });
    expect(result).toBe("success");
    expect(attempts).toBe(2);
  });

  it("retries and succeeds on third attempt", async () => {
    let attempts = 0;
    const fn = () => {
      attempts++;
      if (attempts < 3) {
        throw new Error(`Attempt ${attempts} fails`);
      }
      return Promise.resolve("success");
    };

    const result = await withRetry(fn, { retries: 3, baseMs: 10, maxMs: 100 });
    expect(result).toBe("success");
    expect(attempts).toBe(3);
  });

  it("throws RetryExhaustedError after all retries fail", async () => {
    const fn = () => Promise.reject(new Error("Always fails"));

    await expect(
      withRetry(fn, { retries: 2, baseMs: 10, maxMs: 100 })
    ).rejects.toThrow(RetryExhaustedError);
  });

  it("throws immediately for non-retryable errors", async () => {
    let attempts = 0;
    const fn = () => {
      attempts++;
      const error = new Error("Fatal error");
      (error as any).code = "FATAL";
      throw error;
    };

    const isRetryable = (e: unknown) => (e as any)?.code !== "FATAL";

    await expect(
      withRetry(fn, { retries: 3, baseMs: 10, maxMs: 100 }, isRetryable)
    ).rejects.toThrow("Fatal error");

    expect(attempts).toBe(1); // Only one attempt
  });

  it("uses custom retry options", async () => {
    let attempts = 0;
    const fn = () => {
      attempts++;
      throw new Error("fail");
    };

    try {
      await withRetry(fn, { retries: 1, baseMs: 5, maxMs: 50 });
    } catch {
      // Expected to fail
    }

    expect(attempts).toBe(2); // 1 initial + 1 retry
  });
});

describe("isXApiRetryable", () => {
  it("returns true for rate limit (429)", () => {
    const error = { code: 429 };
    expect(isXApiRetryable(error)).toBe(true);
  });

  it("returns true for statusCode 429", () => {
    const error = { statusCode: 429 };
    expect(isXApiRetryable(error)).toBe(true);
  });

  it("returns true for rateLimitError flag", () => {
    const error = { rateLimitError: true };
    expect(isXApiRetryable(error)).toBe(true);
  });

  it("returns true for 502", () => {
    const error = { code: 502 };
    expect(isXApiRetryable(error)).toBe(true);
  });

  it("returns true for 503", () => {
    const error = { code: 503 };
    expect(isXApiRetryable(error)).toBe(true);
  });

  it("returns true for ETIMEDOUT", () => {
    const error = { code: "ETIMEDOUT" };
    expect(isXApiRetryable(error)).toBe(true);
  });

  it("returns true for ECONNRESET", () => {
    const error = { code: "ECONNRESET" };
    expect(isXApiRetryable(error)).toBe(true);
  });

  it("returns true for timeout in message", () => {
    const error = { message: "Request timeout" };
    expect(isXApiRetryable(error)).toBe(true);
  });

  it("returns true for rate limit in message", () => {
    const error = { message: "Rate limit exceeded" };
    expect(isXApiRetryable(error)).toBe(true);
  });

  it("returns false for non-retryable error", () => {
    const error = { code: 400, message: "Bad request" };
    expect(isXApiRetryable(error)).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isXApiRetryable(null)).toBe(false);
    expect(isXApiRetryable(undefined)).toBe(false);
  });
});
