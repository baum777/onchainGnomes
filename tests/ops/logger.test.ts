import { describe, it, expect } from "vitest";
import { sanitizeForLog } from "../../src/ops/logger.js";

describe("sanitizeForLog", () => {
  describe("sensitive key redaction", () => {
    it("redacts sensitive keys at top level", () => {
      const input = { token: "secret123", safe: "public" };
      const result = sanitizeForLog(input) as Record<string, unknown>;

      expect(result.token).toBe("[REDACTED]");
      expect(result.safe).toBe("public");
    });

    it("redacts sensitive keys in nested objects", () => {
      const input = { nested: { password: "secret", data: "ok" } };
      const result = sanitizeForLog(input) as Record<string, unknown>;

      expect((result.nested as Record<string, unknown>).password).toBe(
        "[REDACTED]"
      );
      expect((result.nested as Record<string, unknown>).data).toBe("ok");
    });

    it("redacts case-insensitively", () => {
      const input = { API_KEY: "secret", api_key: "also-secret", Api_Key: "too" };
      const result = sanitizeForLog(input) as Record<string, unknown>;

      expect(result.API_KEY).toBe("[REDACTED]");
      expect(result.api_key).toBe("[REDACTED]");
      expect(result.Api_Key).toBe("[REDACTED]");
    });

    it("redacts partial key matches", () => {
      const input = { x_api_key: "secret", bearer_token: "token" };
      const result = sanitizeForLog(input) as Record<string, unknown>;

      expect(result.x_api_key).toBe("[REDACTED]");
      expect(result.bearer_token).toBe("[REDACTED]");
    });
  });

  describe("array handling", () => {
    it("redacts sensitive keys in array elements", () => {
      const input = {
        items: [
          { token: "secret1", name: "item1" },
          { password: "secret2", name: "item2" },
        ],
      };
      const result = sanitizeForLog(input) as Record<string, unknown>;
      const items = result.items as Array<Record<string, unknown>>;

      expect(items[0].token).toBe("[REDACTED]");
      expect(items[0].name).toBe("item1");
      expect(items[1].password).toBe("[REDACTED]");
      expect(items[1].name).toBe("item2");
    });

    it("handles arrays of primitives", () => {
      const input = { tags: ["tag1", "tag2", "tag3"] };
      const result = sanitizeForLog(input) as Record<string, unknown>;

      expect(result.tags).toEqual(["tag1", "tag2", "tag3"]);
    });

    it("handles nested arrays", () => {
      const input = {
        matrix: [[{ token: "secret" }, { safe: "ok" }]],
      };
      const result = sanitizeForLog(input) as Record<string, unknown>;
      const matrix = result.matrix as Array<Array<Record<string, unknown>>>;

      expect(matrix[0][0].token).toBe("[REDACTED]");
      expect(matrix[0][1].safe).toBe("ok");
    });

    it("handles empty arrays", () => {
      const input = { items: [] };
      const result = sanitizeForLog(input) as Record<string, unknown>;

      expect(result.items).toEqual([]);
    });
  });

  describe("URL redaction", () => {
    it("redacts redis:// URLs in strings", () => {
      const input = { url: "redis://user:password@host:6379/0" };
      const result = sanitizeForLog(input) as Record<string, unknown>;

      expect(result.url).toBe("[redis-url-redacted]");
    });

    it("redacts multiple redis:// URLs in a string", () => {
      const input = {
        message: "Connected to redis://a:b@host1 and redis://c:d@host2",
      };
      const result = sanitizeForLog(input) as Record<string, unknown>;

      expect(result.message).toBe(
        "Connected to [redis-url-redacted] and [redis-url-redacted]"
      );
    });

    it("preserves non-credential URLs", () => {
      const input = { url: "https://example.com/path" };
      const result = sanitizeForLog(input) as Record<string, unknown>;

      expect(result.url).toBe("https://example.com/path");
    });
  });

  describe("edge cases", () => {
    it("returns null for null input", () => {
      expect(sanitizeForLog(null)).toBeNull();
    });

    it("returns undefined for undefined input", () => {
      expect(sanitizeForLog(undefined)).toBeUndefined();
    });

    it("returns primitives unchanged", () => {
      expect(sanitizeForLog("string")).toBe("string");
      expect(sanitizeForLog(123)).toBe(123);
      expect(sanitizeForLog(true)).toBe(true);
    });

    it("handles deeply nested objects", () => {
      const input = {
        level1: {
          level2: {
            level3: {
              token: "deep-secret",
            },
          },
        },
      };
      const result = sanitizeForLog(input) as Record<string, unknown>;
      const level1 = result.level1 as Record<string, unknown>;
      const level2 = level1.level2 as Record<string, unknown>;
      const level3 = level2.level3 as Record<string, unknown>;

      expect(level3.token).toBe("[REDACTED]");
    });
  });
});
