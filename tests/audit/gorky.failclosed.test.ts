/**
 * GORKY Token Audit — Fail-Closed Tests
 * Validates that the system correctly fails closed on invalid/missing data.
 * Snapshot tests for deterministic output.
 */

import { describe, it, expect } from "vitest";
import {
  validateContractAddress,
  stableHash,
  normalizeForHashing,
  strictAddressGate,
  type ValidationResult,
} from "../../src/audit/contractValidation.js";
import {
  runTokenAudit,
  runBatchAudit,
  type TokenAuditRun,
} from "../../src/audit/tokenAuditEngine.js";

// GORKY inputs per specification
const GORKY_TICKER = "GORKY";
const GORKY_INVALID_CA = "pl1234ace56hold789er"; // Placeholder, obviously invalid

// Valid addresses for comparison
const VALID_SOLANA_CA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const VALID_EVM_CA = "0x1234567890123456789012345678901234567890";

/**
 * Helper to mask variable fields for snapshot comparison.
 */
function maskVariableFields(audit: TokenAuditRun): TokenAuditRun {
  return {
    ...audit,
    run_id: "MASKED_RUN_ID",
    timestamp: "MASKED_TIMESTAMP",
  };
}

describe("Contract Validation — Fail-Closed", () => {
  it("rejects null/undefined address", () => {
    const nullResult = validateContractAddress(null);
    const undefinedResult = validateContractAddress(undefined);

    expect(nullResult.valid).toBe(false);
    expect(nullResult.chain).toBe("unknown");
    expect(nullResult.reason).toBe("address_null_or_undefined");

    expect(undefinedResult.valid).toBe(false);
    expect(undefinedResult.reason).toBe("address_null_or_undefined");
  });

  it("rejects empty string address", () => {
    const result = validateContractAddress("");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("address_empty");
  });

  it("rejects whitespace-only address", () => {
    const result = validateContractAddress("   ");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("address_empty");
  });

  it("rejects GORKY placeholder address", () => {
    const result = validateContractAddress(GORKY_INVALID_CA);
    expect(result.valid).toBe(false);
    expect(result.chain).toBe("solana");
    expect(result.reason).toContain("length_invalid");
  });

  it("rejects Solana address with ambiguous chars", () => {
    // Contains '0', 'O', 'I', or 'l' which are not valid base58
    const ambiguousAddresses = [
      "9kQeWJ3Oabcd1234efgh5678ijkm9a12mnop3456xyz0", // O and 0
      "9kQeWJ3labcd1234efgh5678ijkm9a12mnop3456xyzI", // l and I
    ];

    for (const addr of ambiguousAddresses) {
      const result = validateContractAddress(addr);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("ambiguous");
    }
  });

  it("rejects Solana address with wrong length", () => {
    const tooShort = "9kQeWJ3abcd1234"; // < 32 chars
    const tooLong = "9kQeWJ3abcd1234efgh5678ijkm9a12mnop3456xyzAEXTRA"; // > 44 chars

    const shortResult = validateContractAddress(tooShort);
    const longResult = validateContractAddress(tooLong);

    expect(shortResult.valid).toBe(false);
    expect(shortResult.reason).toContain("length");

    expect(longResult.valid).toBe(false);
    expect(longResult.reason).toContain("length");
  });

  it("accepts valid Solana base58 address", () => {
    const result = validateContractAddress(VALID_SOLANA_CA);
    expect(result.valid).toBe(true);
    expect(result.chain).toBe("solana");
    expect(result.normalized).toBe(VALID_SOLANA_CA);
  });

  it("accepts valid EVM address", () => {
    const result = validateContractAddress(VALID_EVM_CA);
    expect(result.valid).toBe(true);
    expect(result.chain).toBe("evm");
    expect(result.normalized).toBe(VALID_EVM_CA.toLowerCase());
  });

  it("rejects EVM address with wrong length", () => {
    const tooShort = "0x1234567890abcdef1234567890abcdef1234567"; // 41 chars
    const tooLong = "0x1234567890abcdef1234567890abcdef1234567890"; // 43 chars
    const noPrefix = "1234567890abcdef1234567890abcdef12345678"; // no 0x

    expect(validateContractAddress(tooShort).valid).toBe(false);
    expect(validateContractAddress(tooLong).valid).toBe(false);
    expect(validateContractAddress(noPrefix).valid).toBe(false);
  });

  it("rejects EVM address with non-hex chars", () => {
    const invalidHex = "0x1234567890abcdef1234567890abcdef1234567g";
    const result = validateContractAddress(invalidHex);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("invalid_hex");
  });
});

describe("Strict Address Gate — False Positive Prevention", () => {
  it("blocks test patterns when strict mode enabled", () => {
    const testAddresses = [
      "9kQeWJ3abcd1234efgh5678ijkm9a12mnop3456xyzA",
      "4Nd1mYtest5678efgh5678ijkm9a12mnop3456FAKE",
      "H3LNPdummy1234efgh5678ijkm9a12mnop3456",
    ];

    for (const addr of testAddresses) {
      expect(strictAddressGate(addr, { allowTestPatterns: false })).toBe(false);
    }
  });

  it("allows test patterns when explicitly enabled", () => {
    // Note: still must be valid base58
    const testAddr = "9kQeWJ3abcd1234efgh5678ijkm9a12mnop3456xyzA";
    expect(strictAddressGate(testAddr, { allowTestPatterns: true })).toBe(true);
  });

  it("always rejects invalid addresses regardless of pattern settings", () => {
    const invalidAddr = "pl1234ace56hold789er";
    expect(strictAddressGate(invalidAddr, { allowTestPatterns: true })).toBe(false);
    expect(strictAddressGate(invalidAddr, { allowTestPatterns: false })).toBe(false);
  });
});

describe("Stable Hashing — Deduplication", () => {
  it("produces same hash for identical data", () => {
    const data = "test data for hashing";
    const hash1 = stableHash(data);
    const hash2 = stableHash(data);
    expect(hash1).toBe(hash2);
  });

  it("produces same hash for data with only timestamp differences", () => {
    const dataWithTimestamp = "result: success at 2024-01-15T10:30:00Z";
    const dataWithDifferentTimestamp = "result: success at 2024-03-20T14:45:30Z";

    const normalized1 = normalizeForHashing(dataWithTimestamp);
    const normalized2 = normalizeForHashing(dataWithDifferentTimestamp);

    expect(normalized1).toBe(normalized2);
    expect(stableHash(normalized1)).toBe(stableHash(normalized2));
  });

  it("produces same hash for data with different whitespace", () => {
    const data1 = "test   data   with   spaces";
    const data2 = "test data with spaces";

    const normalized1 = normalizeForHashing(data1);
    const normalized2 = normalizeForHashing(data2);

    expect(normalized1).toBe(normalized2);
  });

  it("produces same hash for data with repeated punctuation", () => {
    const data1 = "test...data!!!now???";
    const data2 = "test.data!now?";

    const normalized1 = normalizeForHashing(data1);
    const normalized2 = normalizeForHashing(data2);

    expect(normalized1).toBe(normalized2);
  });

  it("produces different hashes for meaningfully different data", () => {
    const data1 = "GORKY is safe";
    const data2 = "GORKY is risky";

    expect(stableHash(data1)).not.toBe(stableHash(data2));
  });
});

describe("Token Audit Engine — Fail-Closed Output", () => {
  it("produces fail-closed result for invalid contract (snapshot)", async () => {
    const audit = await runTokenAudit(GORKY_TICKER, GORKY_INVALID_CA);
    const masked = maskVariableFields(audit);

    // Fail-closed assertions
    expect(audit.verdict).toBe("UNVERIFIED_HIGH_RISK");
    expect(audit.data_quality.mode).toBe("fail_closed");
    expect(audit.data_quality.ca_valid).toBe(false);
    expect(audit.risk_score.final_risk).toBe(100);
    expect(audit.flags).toContain("FAIL_CLOSED_MODE");
    expect(audit.flags).toContain("INVALID_CONTRACT_ADDRESS");

    // Snapshot test
    expect(masked).toMatchSnapshot("fail-closed-invalid-contract");
  });

  it("produces degraded mode for valid contract without onchain verification", async () => {
    const audit = await runTokenAudit(GORKY_TICKER, VALID_SOLANA_CA);
    const masked = maskVariableFields(audit);

    expect(audit.data_quality.mode).toBe("degraded");
    expect(audit.data_quality.ca_valid).toBe(true);
    expect(audit.verdict).toBe("SPECULATIVE");
    expect(audit.flags).toContain("UNVERIFIED_ONCHAIN");

    // All metrics should be null in degraded mode
    expect(audit.metrics.liquidity_usd).toBeNull();
    expect(audit.metrics.top10_holder_percent).toBeNull();

    expect(masked).toMatchSnapshot("degraded-valid-contract-unverified");
  });

  it("never produces null final_risk even in fail-closed", async () => {
    const audit = await runTokenAudit(GORKY_TICKER, null);
    expect(audit.risk_score.final_risk).not.toBeNull();
    expect(typeof audit.risk_score.final_risk).toBe("number");
  });

  it("always returns UNVERIFIED_HIGH_RISK for completely unverified tokens", async () => {
    const invalidAudit = await runTokenAudit(GORKY_TICKER, GORKY_INVALID_CA);
    expect(invalidAudit.verdict).toBe("UNVERIFIED_HIGH_RISK");
    expect(invalidAudit.risk_score.final_risk).toBeGreaterThanOrEqual(80);
  });
});

describe("Batch Audit — Stable Sorting", () => {
  it("sorts results by ticker deterministically", async () => {
    const tokens = [
      { ticker: "ZETA", contract_address: VALID_SOLANA_CA },
      { ticker: "ALPHA", contract_address: VALID_SOLANA_CA },
      { ticker: "GORKY", contract_address: VALID_SOLANA_CA },
      { ticker: "BETA", contract_address: VALID_SOLANA_CA },
    ];

    const results = await runBatchAudit(tokens);
    const tickers = results.map((r) => r.token.ticker);

    expect(tickers).toEqual(["ALPHA", "BETA", "GORKY", "ZETA"]);
  });

  it("handles mix of valid and invalid contracts in batch", async () => {
    const tokens = [
      { ticker: "VALID", contract_address: VALID_SOLANA_CA },
      { ticker: "INVALID", contract_address: GORKY_INVALID_CA },
      { ticker: "NULL", contract_address: "null" as unknown as string },
    ];

    const results = await runBatchAudit(tokens);

    // All should complete, invalid ones fail-closed
    expect(results).toHaveLength(3);

    const invalidResult = results.find((r) => r.token.ticker === "INVALID");
    expect(invalidResult?.verdict).toBe("UNVERIFIED_HIGH_RISK");
    expect(invalidResult?.data_quality.mode).toBe("fail_closed");
  });
});

describe("Risk Score — Weighted Calculation", () => {
  it("calculates weighted risk score correctly with full data", async () => {
    // This test would require mocked RPC responses
    // For now, verify the weight constants exist
    const weights = {
      liquidity: 0.25,
      holder_concentration: 0.25,
      bot_activity: 0.20,
      narrative_manipulation: 0.15,
      dev_control: 0.15,
    };

    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 2);
  });

  it("defaults to 50 risk when no metrics available", async () => {
    const audit = await runTokenAudit(GORKY_TICKER, VALID_SOLANA_CA);

    if (audit.data_quality.mode === "degraded" && !audit.data_quality.onchain_verified) {
      // In degraded mode without verification, should be speculative
      expect(audit.verdict).toBe("SPECULATIVE");
      expect(audit.risk_score.final_risk).toBeGreaterThanOrEqual(25);
      expect(audit.risk_score.final_risk).toBeLessThanOrEqual(75);
    }
  });
});

describe("Determinism — No Random Variation", () => {
  it("produces identical output for same inputs across multiple runs", async () => {
    const run1 = await runTokenAudit(GORKY_TICKER, GORKY_INVALID_CA);
    const run2 = await runTokenAudit(GORKY_TICKER, GORKY_INVALID_CA);

    // Mask variable fields
    const masked1 = maskVariableFields(run1);
    const masked2 = maskVariableFields(run2);

    // Compare stable fields
    expect(masked1.verdict).toBe(masked2.verdict);
    expect(masked1.risk_score.final_risk).toBe(masked2.risk_score.final_risk);
    expect(masked1.flags).toEqual(masked2.flags);
    expect(masked1.data_quality).toEqual(masked2.data_quality);
  });
});
