/**
 * Truth resolver — Combines ENV identity with onchain verification.
 * Precedence: 1) ENV = active identity, 2) Onchain = reality check, 3) Policy decides.
 */

import { TruthStatus, type IdentityFacts, type ResolvedIdentity, type TruthState } from "./types.js";
import { getIdentityFactsFromEnv } from "./env.js";
import { verifyMintOnChain } from "./onchainVerify.js";

/** Resolves full identity with truth state. ENV is source of truth; onchain validates. */
export async function resolveIdentity(options?: {
  envFacts?: IdentityFacts;
  rpcUrl?: string;
}): Promise<ResolvedIdentity> {
  const identity = options?.envFacts ?? getIdentityFactsFromEnv();
  const truth = await resolveTruthState({
    envFacts: identity,
    rpcUrl: options?.rpcUrl,
  });
  return { identity, truth };
}

/** Combines ENV + onchain into TruthState. */
export async function resolveTruthState(options: {
  envFacts: IdentityFacts;
  rpcUrl?: string;
}): Promise<TruthState> {
  const { envFacts, rpcUrl } = options;

  if (!envFacts.mint || envFacts.mint === "So11111111111111111111111111111111111111112") {
    return {
      status: TruthStatus.INVALID_ENV,
      reason: "BOT_TOKEN_MINT not configured or is wrapped SOL",
    };
  }

  const onchain = await verifyMintOnChain(envFacts.mint, rpcUrl);

  if (onchain.status === TruthStatus.RPC_DOWN) {
    return onchain;
  }
  if (onchain.status === TruthStatus.MISMATCH) {
    return onchain;
  }
  if (onchain.status === TruthStatus.OK) {
    return onchain;
  }
  if (onchain.status === TruthStatus.UNVERIFIED) {
    return onchain;
  }

  return onchain;
}

/** @deprecated Use resolveIdentity. Kept for backward compatibility. */
export function resolveCanonicalMint(_input: string, _allowlist: Set<string>): string | null {
  return null;
}

/** @deprecated Use resolveIdentity. Kept for backward compatibility. */
export function resolveCanonicalWallet(
  _input: string,
  _allowlist: Set<string>
): string | null {
  return null;
}
