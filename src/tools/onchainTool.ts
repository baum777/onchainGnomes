/**
 * Onchain Verification Tool
 * 
 * Agent-ready tool interface for Solana onchain data.
 */

import { 
  type TokenMintInfo, 
  type LargestAccountsInfo, 
  type SupplyInfo,
  type ToolResult 
} from "../types/tools.js";
import { 
  getTokenMintInfo, 
  getLargestAccounts, 
  getSupply,
  SolanaRpcAdapter
} from "../adapters/onchain/index.js";

/**
 * High-level tool interface for agents to call
 */
export const onchainToolInterface = {
  /**
   * Get mint info (decimals, supply, authority)
   */
  async getTokenMintInfo(mintAddress: string): Promise<ToolResult<TokenMintInfo>> {
    return getTokenMintInfo(mintAddress);
  },

  /**
   * Get largest accounts for a mint
   */
  async getLargestAccounts(mintAddress: string): Promise<ToolResult<LargestAccountsInfo>> {
    return getLargestAccounts(mintAddress);
  },

  /**
   * Get total supply for a mint
   */
  async getSupply(mintAddress: string): Promise<ToolResult<SupplyInfo>> {
    return getSupply(mintAddress);
  },

  /**
   * Create a new adapter instance with custom config if needed
   */
  createAdapter(config?: any): SolanaRpcAdapter {
    return new SolanaRpcAdapter(config);
  }
};
