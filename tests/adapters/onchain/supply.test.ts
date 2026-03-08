import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSupply } from "../../../src/adapters/onchain/supply.js";
import { SolanaRpcAdapter } from "../../../src/adapters/onchain/solanaRpcAdapter.js";

// Mock SolanaRpcAdapter
vi.mock("../../../src/adapters/onchain/solanaRpcAdapter.js", () => {
  return {
    SolanaRpcAdapter: vi.fn().mockImplementation(() => ({
      execute: vi.fn(),
      getSlot: vi.fn().mockResolvedValue(123456789),
      getConfig: vi.fn().mockReturnValue({ primaryRpcUrl: "https://test-rpc.com" }),
    })),
  };
});

describe("supply", () => {
  let mockAdapter: any;
  const testMint = "DezXAZ8z7PnrnMcqzS2S6onBRShZCHshZxhXNoyoAnBX"; // BONK

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = new SolanaRpcAdapter();
  });

  it("should return success for a valid SPL token mint supply", async () => {
    // Mock getTokenSupply
    mockAdapter.execute.mockImplementationOnce(async (operation, methodName) => {
      if (methodName === "getTokenSupply") {
        return {
          context: { slot: 123456789 },
          value: {
            amount: "1000000000",
            decimals: 9,
            uiAmount: 1,
            uiAmountString: "1.0"
          }
        };
      }
    });

    const result = await getSupply(testMint, mockAdapter);

    expect(result.success).toBe(true);
    expect(result.data?.total).toBe("1000000000");
    expect(result.data?.circulating).toBe(null); // Known standard for now
    expect(result.evidence?.slot).toBe(123456789);
  });

  it("should return error if supply data not found", async () => {
    // Mock getTokenSupply (returning null)
    mockAdapter.execute.mockImplementationOnce(async (operation, methodName) => {
      if (methodName === "getTokenSupply") {
        return {
          context: { slot: 123456789 },
          value: null
        };
      }
    });

    const result = await getSupply(testMint, mockAdapter);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("NO_DATA");
  });
});
