/**
 * @deprecated Use addressGateSanitize from adapters/policy instead.
 * 
 * Address Gate — Allowlist-only address filtering.
 */
import { addressGateSanitize } from "../adapters/policy/addressSanitizer.js";

/**
 * @deprecated Use addressGateSanitize from adapters/policy instead.
 * 
 * Transforms text: only allowlist addresses pass. Others become REDACT/MASK or DECOY.
 */
export function transformTextWithAddressGate(args: {
  text: string;
  allowlist: Set<string>;
  policy: "strict";
  decoySeed?: string;
  spoofContextHint?: boolean;
  prompt?: string;
}): string {
  const result = addressGateSanitize({
    ...args,
    allowlist: args.allowlist,
  });
  return result.sanitized;
}
