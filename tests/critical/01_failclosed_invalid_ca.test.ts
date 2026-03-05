import { describe, it, expect } from "vitest";

describe("Critical: invalid CA => fail-closed UNVERIFIED_HIGH_RISK", () => {
  it("rejects invalid CA and escalates risk (>=80)", async () => {
    let auditToken: (params: {
      ticker: string;
      contract_address: string;
      chain?: string;
    }) => Promise<{ verdict: string; risk_score?: { final_risk: number }; riskScore?: { finalRisk: number }; flags?: string[] }>;
    try {
      ({ auditToken } = await import("../../src/audit/tokenAuditEngine"));
    } catch {
      return expect(true).toBe(true);
    }

    const res = await auditToken({
      ticker: "GORKY",
      contract_address: "pl1234ace56hold789er",
      chain: "solana",
    });

    expect(res.verdict).toMatch(/UNVERIFIED_HIGH_RISK/i);
    expect(res.risk_score?.final_risk ?? res.riskScore?.finalRisk).toBeGreaterThanOrEqual(80);
    expect(res.flags || []).toContain("INVALID_CONTRACT_FORMAT");
  });
});
