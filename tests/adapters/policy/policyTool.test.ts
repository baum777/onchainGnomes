import { describe, it, expect } from "vitest";
import { policyTool } from "../../../src/adapters/policy/policyTool.js";

describe("policyTool", () => {
  it("should validate CA", () => {
    const result = policyTool.validateCA("So11111111111111111111111111111111111111112");
    expect(result.valid).toBe(true);
  });

  it("should sanitize text", () => {
    const result = policyTool.sanitizeText({ text: "test" });
    expect(result.sanitized).toBe("test");
  });
});
