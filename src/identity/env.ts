/**
 * Identity environment — Loader for BOT_TOKEN_MINT and BOT_TREASURY_WALLET.
 * Stub for v1. Validates Base58 format.
 */

const BASE58_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function getBotTokenMint(): string {
  return process.env.BOT_TOKEN_MINT ?? "So11111111111111111111111111111111111111112";
}

export function getBotTreasuryWallet(): string {
  return process.env.BOT_TREASURY_WALLET ?? "";
}

export function isValidBase58(s: string): boolean {
  return BASE58_PATTERN.test(s);
}

export function getAllowlist(): Set<string> {
  const mint = getBotTokenMint();
  const wallet = getBotTreasuryWallet();
  return new Set([mint, wallet].filter(Boolean));
}
