/**
 * Get Token Mint Info
 * 
 * Fetches and parses SPL Token Mint account data.
 */

import { PublicKey } from "@solana/web3.js";
import { 
  type TokenMintInfo, 
  type ToolResult, 
  createEvidence, 
  createSuccessResult, 
  createErrorResult 
} from "../../types/tools.js";
import { SolanaRpcAdapter } from "./solanaRpcAdapter.js";
import { parseMintData } from "./parsers.js";
import { mapRpcErrorToToolError, SolanaRpcError } from "./errors.js";

/**
 * Fetches mint information for a given SPL token address
 */
export async function getTokenMintInfo(
  mintAddress: string,
  adapter?: SolanaRpcAdapter
): Promise<ToolResult<TokenMintInfo>> {
  const start = Date.now();
  const rpc = adapter ?? new SolanaRpcAdapter();
  
  try {
    const mintPubkey = new PublicKey(mintAddress);
    
    // Get account info and current slot for evidence
    const [accountInfo, slot] = await Promise.all([
      rpc.getAccountInfo(mintPubkey),
      rpc.getSlot()
    ]);

    if (!accountInfo) {
      return createErrorResult(
        "INVALID_MINT",
        `Mint account not found: ${mintAddress}`,
        Date.now() - start
      );
    }

    // SPL Token Mints must be 82 bytes
    if (accountInfo.data.length !== 82) {
      return createErrorResult(
        "PARSE_ERROR",
        `Account is not a valid SPL Token Mint (size ${accountInfo.data.length} != 82)`,
        Date.now() - start
      );
    }

    const data = parseMintData(mintPubkey, accountInfo.data);
    const latencyMs = Date.now() - start;
    
    const evidence = createEvidence("solana_rpc", slot, {
      endpoint: rpc.getConfig().primaryRpcUrl,
      notes: `Account owner: ${accountInfo.owner.toBase58()}`
    });

    return createSuccessResult(data, evidence, latencyMs);

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
