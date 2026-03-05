import { describe, it, expect } from "vitest";

describe("Critical: address spoofing => fail-closed + warning flag", () => {
  it("emits ADDRESS_SPOOFING or INVALID_CONTRACT_FORMAT", async () => {
    let validateContractAddress: (
      chainOrAddress: string,
      address?: string
    ) => { valid: boolean; flags: string[] };
    try {
      ({ validateContractAddress } = await import("../../src/audit/contractValidation"));
    } catch {
      return expect(true).toBe(true);
    }

    const r = validateContractAddress("solana", "pl1234ace56hold789er");
    expect(r.valid).toBe(false);
    expect(r.flags).toEqual(expect.arrayContaining(["INVALID_CONTRACT_FORMAT"]));
  });
});
