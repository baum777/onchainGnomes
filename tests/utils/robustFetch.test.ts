import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateBackoffDelay,
  isRateLimitError,
  isTransientError,
  getRetryAfterMs,
  fetchWithTimeout,
  robustFetch,
  AdaptivePollingController,
} from "../../src/utils/robustFetch.js";

describe("robustFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("2.1 Fetch-Robustheit - Backoff calculation", () => {
    it("calculates exponential backoff with jitter", () => {
      const delay0 = calculateBackoffDelay(0, 1000, 30000, 100);
      expect(delay0).toBeGreaterThanOrEqual(1000);
      expect(delay0).toBeLessThanOrEqual(1100);

      const delay1 = calculateBackoffDelay(1, 1000, 30000, 100);
      expect(delay1).toBeGreaterThanOrEqual(2000);
      expect(delay1).toBeLessThanOrEqual(2100);

      const delay2 = calculateBackoffDelay(2, 1000, 30000, 100);
      expect(delay2).toBeGreaterThanOrEqual(4000);
      expect(delay2).toBeLessThanOrEqual(4100);
    });

    it("respects max backoff limit", () => {
      const delay = calculateBackoffDelay(10, 1000, 5000, 100);
      expect(delay).toBeLessThanOrEqual(5000);
    });
  });

  describe("2.1 Fetch-Robustheit - Error classification", () => {
    it("detects rate limit errors (429)", () => {
      expect(isRateLimitError({ code: 429 })).toBe(true);
      expect(isRateLimitError({ status: 429 })).toBe(true);
      expect(isRateLimitError({ rateLimitError: true })).toBe(true);
      expect(isRateLimitError({ code: 500 })).toBe(false);
    });

    it("detects transient errors", () => {
      expect(isTransientError({ code: 408 })).toBe(true);
      expect(isTransientError({ code: 429 })).toBe(true);
      expect(isTransientError({ code: 500 })).toBe(true);
      expect(isTransientError({ code: 502 })).toBe(true);
      expect(isTransientError({ code: 503 })).toBe(true);
      expect(isTransientError({ code: 504 })).toBe(true);
      expect(isTransientError({ code: 400 })).toBe(false);
      expect(isTransientError({ code: 401 })).toBe(false);
    });

    it("extracts retry-after from error", () => {
      expect(getRetryAfterMs({ retryAfter: 60 })).toBe(60000);
      expect(getRetryAfterMs({ headers: { "retry-after": "120" } })).toBe(120000);
      expect(getRetryAfterMs({}, 30000)).toBe(30000);
    });
  });

  describe("2.1 Fetch-Robustheit - Timeout handling", () => {
    it("throws on timeout", async () => {
      const slowFetch = () => new Promise((resolve) => setTimeout(resolve, 1000));
      
      await expect(fetchWithTimeout(slowFetch, 100)).rejects.toThrow("timeout");
    });

    it("returns result when fetch succeeds before timeout", async () => {
      const fastFetch = () => Promise.resolve({ data: "success" });
      
      const result = await fetchWithTimeout(fastFetch, 1000);
      expect(result).toEqual({ data: "success" });
    });
  });

  describe("2.1 Fetch-Robustheit - Robust fetch with retry", () => {
    it("succeeds on first try", async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: "success" });
      
      const result = await robustFetch(fetchFn);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ data: "success" });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it("retries on transient error then succeeds", async () => {
      const fetchFn = vi
        .fn()
        .mockRejectedValueOnce({ code: 503 })
        .mockResolvedValueOnce({ data: "success" });
      
      const result = await robustFetch(fetchFn, { maxRetries: 2, backoffBaseMs: 10 });
      
      expect(result.success).toBe(true);
      expect(fetchFn).toHaveBeenCalledTimes(2);
    }, 10000);

    it("returns rate limit info on 429", async () => {
      const fetchFn = vi.fn().mockRejectedValue({ code: 429, retryAfter: 60 });
      
      const result = await robustFetch(fetchFn);
      
      expect(result.success).toBe(false);
      expect(result.rateLimited).toBe(true);
      expect(result.retryAfterMs).toBe(60000);
    });

    it("does not retry non-transient errors", async () => {
      const fetchFn = vi.fn().mockRejectedValue({ code: 400 });
      
      const result = await robustFetch(fetchFn, { maxRetries: 3 });
      
      expect(result.success).toBe(false);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("2.3 Rate-Limit Awareness - Adaptive polling", () => {
    it("decreases interval on success", () => {
      const controller = new AdaptivePollingController(30000, 5000, 300000);
      
      controller.onSuccess();
      
      expect(controller.getInterval()).toBeLessThan(30000);
      expect(controller.getInterval()).toBeGreaterThanOrEqual(5000);
    });

    it("increases interval on rate limit", () => {
      const controller = new AdaptivePollingController(30000, 5000, 300000);
      
      controller.onRateLimit();
      
      expect(controller.getInterval()).toBeGreaterThan(30000);
    });

    it("uses retry-after when provided", () => {
      const controller = new AdaptivePollingController(30000, 5000, 300000);
      
      controller.onRateLimit(120000);
      
      expect(controller.getInterval()).toBe(120000);
    });

    it("respects min and max bounds", () => {
      const controller = new AdaptivePollingController(30000, 10000, 60000);
      
      // Multiple successes should not go below min
      for (let i = 0; i < 10; i++) {
        controller.onSuccess();
      }
      expect(controller.getInterval()).toBeGreaterThanOrEqual(10000);
      
      // Multiple rate limits should not exceed max
      for (let i = 0; i < 10; i++) {
        controller.onRateLimit();
      }
      expect(controller.getInterval()).toBeLessThanOrEqual(60000);
    });
  });
});
