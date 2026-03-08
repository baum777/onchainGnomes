import { describe, it, expect, vi, beforeEach } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { getLargestAccounts } from "../../../src/adapters/onchain/largestAccounts.js";
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

describe("largestAccounts", () => {
  let mockAdapter: any;
  const testMint = "DezXAZ8z7PnrnMcqzS2S6onBRShZCHshZxhXNoyoAnBX"; // BONK
  const testOwner = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"; // SPL Token Program
  const testAccount = "9W8SDR6jR6j6j6j6j6j6j6j6j6j6j6j6j6j6j6j6j6j"; // Some account

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = new SolanaRpcAdapter();
  });

  it("should return success for a valid SPL token mint", async () => {
    // 1. Mock getTokenLargestAccounts
    mockAdapter.execute.mockImplementationOnce(async (operation, methodName) => {
      if (methodName === "getTokenLargestAccounts") {
        return {
          context: { slot: 123456789 },
          value: [{
            address: new PublicKey(testAccount),
            amount: "500000000",
            decimals: 9,
            uiAmount: 0.5,
            uiAmountString: "0.5"
          }]
        };
      }
    });

    // 2. Mock getMultipleAccountsInfo
    const fakeAccountData = Buffer.alloc(165);
    fakeAccountData.set(new PublicKey(testMint).toBuffer(), 0); // mint
    fakeAccountData.set(new PublicKey(testOwner).toBuffer(), 32); // owner
    fakeAccountData.writeBigUInt64LE(500000000n, 64); // amount

    mockAdapter.execute.mockImplementationOnce(async (operation, methodName) => {
      if (methodName === "getMultipleAccountsInfo") {
        return [{
          data: fakeAccountData,
          owner: new PublicKey(testOwner),
          executable: false,
          lamports: 1000,
        }];
      }
    });

    const result = await getLargestAccounts(testMint, mockAdapter);

    expect(result.success).toBe(true);
    expect(result.data?.accounts.length).toBe(1);
    expect(result.data?.accounts[0].amount).toBe("500000000");
    expect(result.data?.accounts[0].owner).toBe(testOwner);
    expect(result.evidence?.slot).toBe(123456789);
  });

  it("should return success even if accounts not found", async () => {
    // 1. Mock getTokenLargestAccounts
    mockAdapter.execute.mockImplementationOnce(async (operation, methodName) => {
      if (methodName === "getTokenLargestAccounts") {
        return {
          context: { slot: 123456789 },
          value: []
        };
      }
    });

    const result = await getLargestAccounts(testMint, mockAdapter);

    expect(result.success).toBe(true);
    expect(result.data?.accounts.length).toBe(0);
    expect(result.evidence?.slot).toBe(123456789);
  });

  it("should handle partial success if account info missing", async () => {
     // 1. Mock getTokenLargestAccounts
    mockAdapter.execute.mockImplementationOnce(async (operation, methodName) => {
      if (methodName === "getTokenLargestAccounts") {
        return {
          context: { slot: 123456789 },
          value: [{
            address: new PublicKey(testAccount),
            amount: "500000000",
            decimals: 9,
            uiAmount: 0.5,
            uiAmountString: "0.5"
          }]
        };
      }
    });

    // 2. Mock getMultipleAccountsInfo (return null for this account)
    mockAdapter.execute.mockImplementationOnce(async (operation, methodName) => {
      if (methodName === "getMultipleAccountsInfo") {
        return [null];
      }
    });

    const result = await getLargestAccounts(testMint, mockAdapter);

    expect(result.success).toBe(true);
    expect(result.data?.accounts[0].owner).toBe("unknown");
    expect(result.data?.accounts[0].amount).toBe("500000000");
  });
});
