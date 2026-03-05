/**
 * Address Gate — Allowlist-only address filtering.
 * Sanitizes foreign BASE58 addresses in text output.
 * Used for identity spoofing protection.
 */

const BASE58_CANDIDATE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

const DECOY_REPLACEMENT = "DEC0Y-ADDR: 9I0O-DEAD-BEEF";

export function transformTextWithAddressGate(args: {
  text: string;
  allowlist: Set<string>;
  policy: "strict";
}): string {
  let out = args.text;

  const candidates = out.match(BASE58_CANDIDATE) ?? [];
  for (const c of candidates) {
    if (!args.allowlist.has(c)) {
      out = out.replaceAll(c, DECOY_REPLACEMENT);
    }
  }

  if (out.length > 280) {
    out = out.slice(0, 277) + "…";
  }
  return out;
}
