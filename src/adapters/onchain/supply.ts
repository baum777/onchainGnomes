/**
 * Get Token Supply Info
 * 
 * Fetches and parses SPL Token Supply data.
 */

import { PublicKey } from "@solana/web3.js";
import { 
  type SupplyInfo, 
  type ToolResult, 
  createEvidence, 
  createSuccessResult, 
  createErrorResult 
} from "../../types/tools.js";
import { SolanaRpcAdapter } from "./solanaRpcAdapter.js";
import { mapRpcErrorToToolError, SolanaRpcError } from "./errors.js";

/**
 * Fetches token supply for a given SPL token mint address
 */
export async function getSupply(
  mintAddress: string,
  adapter?: SolanaRpcAdapter
): Promise<ToolResult<SupplyInfo>> {
  const start = Date.now();
  const rpc = adapter ?? new SolanaRpcAdapter();
  
  try {
    const mintPubkey = new PublicKey(mintAddress);
    
    // Get supply and current slot
    const result = await rpc.execute(
      (c) => c.getTokenSupply(mintPubkey),
      "getTokenSupply"
    );

    const supplyData = result.value;
    const slot = result.context.slot;

    if (!supplyData) {
      return createErrorResult(
        "NO_DATA",
        `Could not retrieve supply data for: ${mintAddress}`,
        Date.now() - start
      );
    }

    const latencyMs = Date.now() - start;
    
    const evidence = createEvidence("solana_rpc", slot, {
      endpoint: rpc.getConfig().primaryRpcUrl,
      notes: `Decimals: ${supplyData.decimals}`
    });

    // Note: Standard Solana RPC doesn't provide circulating/non-circulating differentiation
    // unless you manually track locked wallets or use a secondary provider like Helius.
    // For now, we return the total supply from the mint account.
    return createSuccessResult({
      mint: mintAddress,
      total: supplyData.amount,
      circulating: null, // Need external data source or custom list for this
      nonCirculating: null,
    }, evidence, latencyMs);

  } catch (error) {
    const latencyMs = Date.now() - start;
    
    if (error instanceof SolanaRpcError) {
      return createErrorResult(
        mapRpcErrorToToolError(error),
        error.message,
        latencyMs
      );
    }

    return createErrorResult(
      "UNEXPECTED",
      error instanceof Error ? error.message : String(error),
      latencyMs
    );
  }
}
