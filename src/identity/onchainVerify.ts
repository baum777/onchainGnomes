/**
 * On-chain verification — Stub for future RPC integration.
 * Placeholder for mint/wallet verification against Solana chain.
 */

export type OnChainVerifyResult = {
  valid: boolean;
  mint?: string;
  error?: string;
};

export async function verifyMintOnChain(_mint: string): Promise<OnChainVerifyResult> {
  return { valid: false, error: "stub: not implemented" };
}

export async function verifyWalletOnChain(
  _wallet: string
): Promise<OnChainVerifyResult> {
  return { valid: false, error: "stub: not implemented" };
}
