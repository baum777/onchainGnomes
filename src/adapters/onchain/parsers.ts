/**
 * Solana Account Parsers
 *
 * Manual parsers for Solana account data to avoid extra dependencies.
 * Focuses on SPL Token Mint and Account layouts.
 */

import { PublicKey } from "@solana/web3.js";
import type { TokenMintInfo, TokenAccountInfo } from "../../types/tools.js";

/**
 * Parse SPL Token Mint account data
 * Layout:
 * [0..36]   mintAuthority (Option<Pubkey>)
 * [36..44]  supply (u64)
 * [44..45]  decimals (u8)
 * [45..46]  isInitialized (bool)
 * [46..82]  freezeAuthority (Option<Pubkey>)
 */
export function parseMintData(mint: PublicKey, data: Buffer): TokenMintInfo {
  if (data.length !== 82) {
    throw new Error(`Invalid mint data length: ${data.length}`);
  }

  const mintAuthorityOption = data.readUInt32LE(0);
  const mintAuthority = mintAuthorityOption === 0 
    ? null 
    : new PublicKey(data.slice(4, 36)).toBase58();

  const supply = data.readBigUInt64LE(36).toString();
  const decimals = data[44];
  const isInitialized = data[45] !== 0;

  const freezeAuthorityOption = data.readUInt32LE(46);
  const freezeAuthority = freezeAuthorityOption === 0 
    ? null 
    : new PublicKey(data.slice(50, 82)).toBase58();

  return {
    mint: mint.toBase58(),
    decimals,
    supply,
    isInitialized,
    freezeAuthority,
    mintAuthority,
  };
}

/**
 * Parse SPL Token Account data
 * Layout:
 * [0..32]   mint (Pubkey)
 * [32..64]  owner (Pubkey)
 * [64..72]  amount (u64)
 * [72..108] delegate (Option<Pubkey>)
 * [108..109] state (u8)
 * [109..121] isNative (Option<u64>)
 * [121..129] delegatedAmount (u64)
 * [129..165] closeAuthority (Option<Pubkey>)
 */
export function parseTokenAccountData(
  address: PublicKey,
  data: Buffer,
  decimals: number
): TokenAccountInfo {
  if (data.length !== 165) {
    throw new Error(`Invalid token account data length: ${data.length}`);
  }

  const mint = new PublicKey(data.slice(0, 32)).toBase58();
  const owner = new PublicKey(data.slice(32, 64)).toBase58();
  const amount = data.readBigUInt64LE(64).toString();

  return {
    address: address.toBase58(),
    mint,
    owner,
    amount,
    decimals,
  };
}
