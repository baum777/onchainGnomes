import { describe, it, expect, vi, beforeEach } from "vitest";
import { Connection, PublicKey } from "@solana/web3.js";
import { SolanaRpcAdapter } from "../../../src/adapters/onchain/solanaRpcAdapter.js";
import { SolanaRpcError } from "../../../src/adapters/onchain/errors.js";

// Mock @solana/web3.js
vi.mock("@solana/web3.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solana/web3.js")>();
  return {
    ...actual,
    Connection: vi.fn().mockImplementation(() => ({
      getSlot: vi.fn().mockResolvedValue(123456789),
      getAccountInfo: vi.fn(),
    })),
  };
});

describe("SolanaRpcAdapter", () => {
  let adapter: SolanaRpcAdapter;
  
  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new SolanaRpcAdapter({
      primaryRpcUrl: "https://test-rpc.com",
      fallbackRpcUrl: "https://fallback-rpc.com",
    });
  });

  it("should initialize with primary and fallback connections", () => {
    const config = adapter.getConfig();
    expect(config.primaryRpcUrl).toBe("https://test-rpc.com");
    expect(config.fallbackRpcUrl).toBe("https://fallback-rpc.com");
    expect(Connection).toHaveBeenCalledTimes(2);
  });

  it("should execute operation on primary connection successfully", async () => {
    const operation = vi.fn().mockResolvedValue("result");
    const result = await adapter.execute(operation, "testMethod");
    
    expect(result).toBe("result");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("should fallback to secondary connection if primary fails", async () => {
    const primaryError = new Error("Primary failed");
    const operation = vi.fn()
      .mockRejectedValueOnce(primaryError)
      .mockResolvedValueOnce("fallback result");

    const result = await adapter.execute(operation, "testMethod");
    
    expect(result).toBe("fallback result");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("should throw SolanaRpcError if both primary and fallback fail", async () => {
    const primaryError = new Error("Primary failed");
    const fallbackError = new Error("Fallback failed");
    const operation = vi.fn()
      .mockRejectedValueOnce(primaryError)
      .mockRejectedValueOnce(fallbackError);

    await expect(adapter.execute(operation, "testMethod"))
      .rejects.toThrow(SolanaRpcError);
    
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("should return health status with slot number", async () => {
    const health = await adapter.healthCheck();
    expect(health.healthy).toBe(true);
    expect(health.message).toContain("123456789");
  });

  it("should get slot correctly using execute", async () => {
    const slot = await adapter.getSlot();
    expect(slot).toBe(123456789);
  });
});
