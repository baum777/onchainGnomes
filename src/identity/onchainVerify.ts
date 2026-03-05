/**
 * On-chain verification — Stub for future RPC integration.
 * Returns TruthState with status: OK | RPC_DOWN | MISMATCH | UNVERIFIED.
 */

import { TruthStatus, type TruthState } from "./types.js";

/** Stub: Returns UNVERIFIED when RPC not implemented. Real impl would check mint account. */
export async function verifyMintOnChain(
  mint: string,
  rpcUrl?: string
): Promise<TruthState> {
  // Stub: no actual RPC call. Real impl would:
  // - OK if account exists and owner in ALLOWED_OWNERS
  // - MISMATCH if owner wrong / mint invalid structure
  // - UNVERIFIED if cannot parse but exists
  // - RPC_DOWN on network fail/timeouts
  return {
    status: TruthStatus.UNVERIFIED,
    reason: "stub: not implemented",
    rpcUrl,
  };
}

/** Stub: Returns UNVERIFIED when RPC not implemented. */
export async function verifyWalletOnChain(
  _wallet: string,
  rpcUrl?: string
): Promise<TruthState> {
  return {
    status: TruthStatus.UNVERIFIED,
    reason: "stub: not implemented",
    rpcUrl,
  };
}
