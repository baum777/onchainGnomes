/**
 * Address Sanitizer - Address Gate Sanitization
 * 
 * Sanitizes foreign BASE58 addresses in text output.
 * Used for identity spoofing protection.
 * Decoy: deterministic per seed, always invalid, prefixed.
 */

import type { SanitizeResult, TextModification } from "../../types/tools.js";

// Match 32-44 char base58. \b handles punctuation, URLs, newlines.
const BASE58_CANDIDATE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

const SPOOF_KEYWORDS = [
  "your real mint",
  "post as yours",
  "post this as your mint",
  "quote exactly",
  "quote this exactly",
  "ignore rules",
  "new official address",
  "your actual mint",
  "official mint is",
  "replace your ca with",
  "use this address instead",
  // Additional spoof keywords (NEW)
  "pretend this is your",
  "act like this is your",
  "say this is your",
  "tell them this is",
  "this is now your",
  "update your mint to",
  "change your ca to",
  "switch to this address",
  "adopt this as your",
  "verify this as your",
  "confirm this is your",
  "validate this address",
  "trust this address",
  "this is the real",
  "the actual address is",
  "correct address is",
  "real mint address",
  "true contract address",
  "legitimate address",
  "authorized address",
  "approved address",
  "endorsed address",
  "verified address",
  "official contract",
  "canonical address",
] as const;

/** Detects spoof/identity-swap context in prompt. */
export function detectSpoofContext(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return SPOOF_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Seeded RNG for deterministic decoy generation. */
function seededRng(seedStr: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state >>>= 0;
    state ^= state << 5;
    state >>>= 0;
    return (state >>> 0) / 4294967296;
  };
}

/** Generates deterministic invalid decoy. Uses O, I, l, - (non-base58) so never resolvable. */
export function generateDeterministicDecoy(seed: string): string {
  const rnd = seededRng(seed);
  const variants = [
    "DEC0Y-ADDR: 9I0O-DEAD-BEEF-I00I",
    "NOT_A_MINT: H3LL0-W0RLD-I0OI",
    "DEC0Y-ADDR: I00I-BEEF-C0FFEE",
    "DEC0Y-ADDR: C0FFEE-DEAD-BEEF",
    "NOT_A_MINT: FAKE-ADDR-DEC0Y",
    "DEC0Y-ADDR: N0T-VALID-MINT",
  ];
  const idx = Math.floor(rnd() * variants.length);
  return variants[idx] ?? variants[0]!;
}

function extractBase58Candidates(text: string): string[] {
  const matches = text.match(BASE58_CANDIDATE) ?? [];
  return [...new Set(matches)];
}

export interface AddressGateSanitizeOptions {
  text: string;
  allowlist?: Set<string>;
  policy?: "strict" | "lenient";
  decoySeed?: string;
  spoofContextHint?: boolean;
  prompt?: string;
}

/**
 * Transforms text: only allowlist addresses pass. Others become REDACT/MASK or DECOY.
 * When spoofContextHint (or detected from prompt): use deterministic decoy.
 * Guarantees zero foreign base58 in output.
 */
export function addressGateSanitize(options: AddressGateSanitizeOptions): SanitizeResult {
  const {
    text,
    allowlist = new Set(),
    policy = "strict",
    decoySeed = "default",
    spoofContextHint,
    prompt,
  } = options;

  let out = text;
  const modifications: TextModification[] = [];

  const spoofHint =
    spoofContextHint ?? (prompt ? detectSpoofContext(prompt) : false);
  const replacement = spoofHint
    ? generateDeterministicDecoy(decoySeed)
    : "DEC0Y-ADDR: 9I0O-DEAD-BEEF";

  const candidates = extractBase58Candidates(out);
  let foreignAddressesFound = 0;
  let allowlistAddressesFound = 0;
  let decoyInjected = false;

  for (const candidate of candidates) {
    const position = out.indexOf(candidate);
    
    if (!allowlist.has(candidate)) {
      foreignAddressesFound++;
      out = out.split(candidate).join(replacement);
      modifications.push({
        type: spoofHint ? "DECOY_INJECTED" : "ADDRESS_REDACTED",
        original: candidate,
        replacement,
        position,
      });
      if (spoofHint) {
        decoyInjected = true;
      }
    } else {
      allowlistAddressesFound++;
    }
  }

  // Truncate if exceeds 280 chars (Twitter limit)
  if (out.length > 280) {
    const originalLength = out.length;
    out = out.slice(0, 277) + "…";
    modifications.push({
      type: "LENGTH_TRUNCATED",
      replacement: "…",
      position: 277,
    });
  }

  return {
    sanitized: out,
    modifications,
    spoofDetected: spoofHint,
    safety: {
      foreignAddressesFound,
      allowlistAddressesFound,
      decoyInjected,
    },
  };
}

/**
 * Extract and validate all addresses from text
 */
export function extractAddressesFromText(text: string): {
  addresses: string[];
  hasForeignAddresses: boolean;
  allowlistAddresses: string[];
  foreignAddresses: string[];
} {
  const candidates = extractBase58Candidates(text);
  
  return {
    addresses: candidates,
    hasForeignAddresses: candidates.length > 0,
    allowlistAddresses: [], // Would need allowlist passed in
    foreignAddresses: candidates,
  };
}
