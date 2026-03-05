/**
 * Address Gate — Allowlist-only address filtering.
 * Sanitizes foreign BASE58 addresses in text output.
 * Used for identity spoofing protection.
 * Decoy: deterministic per seed, always invalid, prefixed.
 */

// Match 32-44 char base58. \b handles punctuation, URLs, newlines.
const BASE58_CANDIDATE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

const SPOOF_KEYWORDS = [
  "your real mint",
  "post as yours",
  "quote exactly",
  "quote this exactly",
  "ignore rules",
  "new official address",
  "your actual mint",
  "official mint is",
  "post this as your mint",
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
  ];
  const idx = Math.floor(rnd() * variants.length);
  return variants[idx] ?? variants[0]!;
}

function extractBase58Candidates(text: string): string[] {
  const matches = text.match(BASE58_CANDIDATE) ?? [];
  return [...new Set(matches)];
}

export interface AddressGateArgs {
  text: string;
  allowlist: Set<string>;
  policy: "strict";
  decoySeed?: string;
  spoofContextHint?: boolean;
  prompt?: string;
}

/**
 * Transforms text: only allowlist addresses pass. Others become REDACT/MASK or DECOY.
 * When spoofContextHint (or detected from prompt): use deterministic decoy.
 * Guarantees zero foreign base58 in output.
 */
export function transformTextWithAddressGate(args: AddressGateArgs): string {
  let out = args.text;

  const decoySeed = args.decoySeed ?? "default";
  const spoofHint =
    args.spoofContextHint ?? (args.prompt ? detectSpoofContext(args.prompt) : false);
  const replacement = spoofHint
    ? generateDeterministicDecoy(decoySeed)
    : "DEC0Y-ADDR: 9I0O-DEAD-BEEF";

  const candidates = extractBase58Candidates(out);

  for (const c of candidates) {
    if (!args.allowlist.has(c)) {
      out = out.split(c).join(replacement);
    }
  }

  if (out.length > 280) {
    out = out.slice(0, 277) + "…";
  }
  return out;
}
