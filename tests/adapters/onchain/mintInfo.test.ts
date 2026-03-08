import { describe, it, expect, vi, beforeEach } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { getTokenMintInfo } from "../../../src/adapters/onchain/mintInfo.js";
import { SolanaRpcAdapter } from "../../../src/adapters/onchain/solanaRpcAdapter.js";

// Mock SolanaRpcAdapter
vi.mock("../../../src/adapters/onchain/solanaRpcAdapter.js", () => {
  return {
    SolanaRpcAdapter: vi.fn().mockImplementation(() => ({
      getAccountInfo: vi.fn(),
      getSlot: vi.fn().mockResolvedValue(123456789),
      getConfig: vi.fn().mockReturnValue({ primaryRpcUrl: "https://test-rpc.com" }),
    })),
  };
});

describe("mintInfo", () => {
  let mockAdapter: any;
  const testMint = "DezXAZ8z7PnrnMcqzS2S6onBRShZCHshZxhXNoyoAnBX"; // BONK
  const testOwner = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"; // SPL Token Program

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = new SolanaRpcAdapter();
  });

  it("should return success for a valid SPL token mint", async () => {
    const fakeMintData = Buffer.alloc(82);
    // supply: 1000000000
    fakeMintData.writeBigUInt64LE(1000000000n, 36);
    // decimals: 9
    fakeMintData[44] = 9;
    // isInitialized: true
    fakeMintData[45] = 1;

    mockAdapter.getAccountInfo.mockResolvedValue({
      data: fakeMintData,
      owner: new PublicKey(testOwner),
      executable: false,
      lamports: 1000,
    });

    const result = await getTokenMintInfo(testMint, mockAdapter);

    expect(result.success).toBe(true);
    expect(result.data?.decimals).toBe(9);
    expect(result.data?.supply).toBe("1000000000");
    expect(result.evidence?.slot).toBe(123456789);
    expect(result.evidence?.source).toBe("solana_rpc");
  });

  it("should return error if mint account is not found", async () => {
    mockAdapter.getAccountInfo.mockResolvedValue(null);

    const result = await getTokenMintInfo(testMint, mockAdapter);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("INVALID_MINT");
    expect(result.error?.message).toContain("Mint account not found");
  });

  it("should return error if mint data size is incorrect", async () => {
    mockAdapter.getAccountInfo.mockResolvedValue({
      data: Buffer.alloc(64), // Invalid size for mint
      owner: new PublicKey(testOwner),
      executable: false,
      lamports: 1000,
    });

    const result = await getTokenMintInfo(testMint, mockAdapter);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("PARSE_ERROR");
  });

  it("should return error if mint address is invalid", async () => {
    const result = await getTokenMintInfo("invalid-address", mockAdapter);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("UNEXPECTED"); // From PublicKey constructor throwing
  });
});
