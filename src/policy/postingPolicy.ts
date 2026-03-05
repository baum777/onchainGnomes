/**
 * Posting Policy — Decides mask/full/decoy based on TruthStatus.
 * OK: allow masked, optionally full on explicitAsk.
 * RPC_DOWN/UNVERIFIED: mask only.
 * MISMATCH/INVALID_ENV: decoy only.
 */

import { TruthStatus, type DisclosureDecision, type IdentityFacts } from "../identity/types.js";

export type { DisclosureDecision } from "../identity/types.js";

export interface PostingPolicyInput {
  truthStatus: TruthStatus;
  intent?: "mint_request" | "wallet_request" | "general";
  explicitAsk?: boolean;
  allowFullMintConfig?: boolean;
}

/**
 * Decides what identity disclosure is allowed.
 * - OK: allowFullMint only if explicitAsk && allowFullMintConfig; always allowMaskedMint.
 * - RPC_DOWN/UNVERIFIED: mask only, never full.
 * - MISMATCH/INVALID_ENV: forceDecoy only.
 */
export function decideIdentityDisclosure(args: PostingPolicyInput): DisclosureDecision {
  const {
    truthStatus,
    intent = "general",
    explicitAsk = false,
    allowFullMintConfig = false,
  } = args;

  if (truthStatus === TruthStatus.OK) {
    return {
      allowFullMint: explicitAsk && allowFullMintConfig,
      allowMaskedMint: true,
      forceDecoy: false,
    };
  }

  if (truthStatus === TruthStatus.RPC_DOWN || truthStatus === TruthStatus.UNVERIFIED) {
    return {
      allowFullMint: false,
      allowMaskedMint: true,
      forceDecoy: false,
    };
  }

  if (truthStatus === TruthStatus.MISMATCH || truthStatus === TruthStatus.INVALID_ENV) {
    return {
      allowFullMint: false,
      allowMaskedMint: false,
      forceDecoy: true,
    };
  }

  return {
    allowFullMint: false,
    allowMaskedMint: true,
    forceDecoy: false,
  };
}

function maskAddress(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

/**
 * Applies identity to response text based on disclosure decision.
 * Replaces mint references with masked/decoy/full as per policy.
 */
export function applyIdentityToResponse(args: {
  text: string;
  identity: IdentityFacts;
  decision: DisclosureDecision;
  decoyPlaceholder?: string;
}): string {
  const { text, identity, decision, decoyPlaceholder = "DEC0Y-ADDR: 9I0O-DEAD-BEEF" } = args;

  if (decision.forceDecoy) {
    return text.replace(identity.mint, decoyPlaceholder);
  }
  if (decision.allowFullMint) {
    return text;
  }
  if (decision.allowMaskedMint) {
    return text.replace(identity.mint, maskAddress(identity.mint));
  }
  return text.replace(identity.mint, decoyPlaceholder);
}
