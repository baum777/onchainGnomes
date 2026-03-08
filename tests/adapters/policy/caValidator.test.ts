import { describe, it, expect } from "vitest";
import { validateCA } from "../../../src/adapters/policy/caValidator.js";

describe("caValidator", () => {
  it("should validate a correct Solana address", () => {
    const address = "So11111111111111111111111111111111111111112"; // Wrapped SOL
    const result = validateCA(address);
    expect(result.valid).toBe(true);
    expect(result.chain).toBe("solana");
    expect(result.normalized).toBe(address);
  });

  it("should validate a correct EVM address", () => {
    const address = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";
    const result = validateCA(address);
    expect(result.valid).toBe(true);
    expect(result.chain).toBe("evm");
    expect(result.normalized).toBe(address.toLowerCase());
  });

  it("should reject an address with ambiguous Solana characters (0, O, I, l)", () => {
    // We need an address that is long enough but contains ambiguous chars
    const address = "DezXAZ8z7PnrnMcqzS2S6onBRShZCHshZxhXNoyoAnB0"; // Ends with 0
    const result = validateCA(address);
    expect(result.valid).toBe(false);
    expect(result.safety.hasAmbiguousChars).toBe(true);
    expect(result.flags).toContain("AMBIGUOUS_CHARS");
  });

  it("should reject test patterns", () => {
    const testAddresses = [
      "testtest_address_123456789012345678901234567890",
      "fakefake_address_abcdefghi",
      "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    ];

    for (const address of testAddresses) {
      const result = validateCA(address);
      expect(result.valid).toBe(false);
      expect(result.safety.isTestPattern).toBe(true);
    }
  });

  it("should fail-closed on null or undefined", () => {
    expect(validateCA(null).valid).toBe(false);
    expect(validateCA(undefined).valid).toBe(false);
  });

  it("should reject invalid length for Solana", () => {
    const address = "abc"; // Too short
    const result = validateCA(address);
    expect(result.valid).toBe(false);
    expect(result.safety.lengthValid).toBe(false);
  });
});
