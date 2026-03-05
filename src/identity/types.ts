/**
 * Identity contracts — TruthStatus, IdentityFacts, TruthState, ResolvedIdentity.
 * Used by truthResolver and postingPolicy.
 */

export enum TruthStatus {
  OK = "OK",
  RPC_DOWN = "RPC_DOWN",
  MISMATCH = "MISMATCH",
  INVALID_ENV = "INVALID_ENV",
  UNVERIFIED = "UNVERIFIED",
}

export interface IdentityFacts {
  ticker: string;
  mint: string;
  treasury?: string;
  programId?: string;
  chain: "solana";
}

export interface TruthState {
  status: TruthStatus;
  verifiedAt?: string;
  reason?: string;
  rpcUrl?: string;
}

export interface ResolvedIdentity {
  identity: IdentityFacts;
  truth: TruthState;
}

export interface DisclosureDecision {
  allowFullMint: boolean;
  allowMaskedMint: boolean;
  forceDecoy: boolean;
}
