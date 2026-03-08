/**
 * Get Largest Token Accounts
 * 
 * Fetches the largest accounts for a given SPL token mint.
 */

import { PublicKey } from "@solana/web3.js";
import { 
  type LargestAccountsInfo, 
  type TokenAccountInfo,
  type ToolResult, 
  createEvidence, 
  createSuccessResult, 
  createErrorResult 
} from "../../types/tools.js";
import { SolanaRpcAdapter } from "./solanaRpcAdapter.js";
import { parseTokenAccountData } from "./parsers.js";
import { mapRpcErrorToToolError, SolanaRpcError } from "./errors.js";

/**
 * Fetches the largest token accounts for a given mint
 */
export async function getLargestAccounts(
  mintAddress: string,
  adapter?: SolanaRpcAdapter
): Promise<ToolResult<LargestAccountsInfo>> {
  const start = Date.now();
  const rpc = adapter ?? new SolanaRpcAdapter();
  
  try {
    const mintPubkey = new PublicKey(mintAddress);
    
    // 1. Get largest accounts for the mint
    const result = await rpc.execute(
      (c) => c.getTokenLargestAccounts(mintPubkey),
      "getTokenLargestAccounts"
    );

    const largestAccounts = result.value;
    const slot = result.context.slot;

    if (!largestAccounts || largestAccounts.length === 0) {
      return createSuccessResult(
        { mint: mintAddress, accounts: [] },
        createEvidence("solana_rpc", slot, { endpoint: rpc.getConfig().primaryRpcUrl }),
        Date.now() - start
      );
    }

    // 2. Fetch account info for the top accounts to get owners
    // We'll take top 10 or whatever the RPC returned (usually 20)
    const accountPubkeys = largestAccounts.map(a => a.address);
    const accountsData = await rpc.execute(
      (c) => c.getMultipleAccountsInfo(accountPubkeys),
      "getMultipleAccountsInfo"
    );

    const accounts: TokenAccountInfo[] = [];

    for (let i = 0; i < accountPubkeys.length; i++) {
      const info = accountsData[i];
      const largest = largestAccounts[i];
      
      if (info && info.data.length === 165) {
        try {
          // Use the decimals from the largest account result
          const parsed = parseTokenAccountData(
            accountPubkeys[i],
            info.data,
            largest.decimals
          );
          accounts.push(parsed);
        } catch (e) {
          // Skip if parsing fails for some reason
          continue;
        }
      } else {
        // Fallback if account info is missing or invalid (unlikely for largest accounts)
        accounts.push({
          address: accountPubkeys[i].toBase58(),
          mint: mintAddress,
          owner: "unknown",
          amount: largest.amount,
          decimals: largest.decimals
        });
      }
    }

    const latencyMs = Date.now() - start;
    const evidence = createEvidence("solana_rpc", slot, {
      endpoint: rpc.getConfig().primaryRpcUrl,
      notes: `Fetched ${accounts.length} accounts`
    });

    return createSuccessResult(
      { mint: mintAddress, accounts },
      evidence,
      latencyMs
    );

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
