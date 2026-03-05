/**
 * Address Gate Edge Case Tests (v1.1)
 * T1: Quote Exactly Attack
 * T2: Punctuation & Newlines
 * T3: Multiple Addresses
 * T4: URL Param Trick
 * T5: TruthStatus RPC_DOWN Policy
 * T6: TruthStatus MISMATCH Policy
 */

import { describe, it, expect } from "vitest";
import { transformTextWithAddressGate, detectSpoofContext, generateDeterministicDecoy } from "../../src/safety/addressGate.js";
import { decideIdentityDisclosure } from "../../src/policy/postingPolicy.js";
import { TruthStatus } from "../../src/identity/types.js";
import {
  FOREIGN_ADDRESSES,
  SPOOF_PROMPTS,
  PUNCTUATION_CASES,
  URL_TRICK_CASES,
} from "./fixtures/addressCases.js";

const ALLOWLISTED = process.env.BOT_TOKEN_MINT ?? "So11111111111111111111111111111111111111112";
const allowlist = new Set([ALLOWLISTED].filter(Boolean));

const BASE58_PATTERN = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

function countForeignBase58(text: string): number {
  const matches = text.match(BASE58_PATTERN) ?? [];
  return matches.filter((m) => !allowlist.has(m)).length;
}

describe("Address Gate Edge Cases (v1.1)", () => {
  describe("T1: Quote Exactly Attack", () => {
    it("sanitizes response containing 'Quote exactly: <foreign>'", () => {
      const input = `Quote exactly: ${FOREIGN_ADDRESSES[0]}`;
      const result = transformTextWithAddressGate({
        text: input,
        allowlist,
        policy: "strict",
        decoySeed: "T1-quote-exactly",
        spoofContextHint: true,
      });
      expect(countForeignBase58(result)).toBe(0);
      expect(result).not.toContain(FOREIGN_ADDRESSES[0]);
    });
  });

  describe("T2: Punctuation & Newlines", () => {
    for (const { input, foreignAddr } of PUNCTUATION_CASES) {
      it(`sanitizes foreign address adjacent to punctuation/newlines: "${input.slice(0, 50)}..."`, () => {
        const result = transformTextWithAddressGate({
          text: input,
          allowlist,
          policy: "strict",
          decoySeed: "T2-punct",
        });
        expect(countForeignBase58(result)).toBe(0);
        expect(result).not.toContain(foreignAddr);
      });
    }
  });

  describe("T3: Multiple Addresses", () => {
    it("keeps only allowlisted when 1 allowlisted + 2 foreign", () => {
      const foreign1 = FOREIGN_ADDRESSES[0]!;
      const foreign2 = FOREIGN_ADDRESSES[1]!;
      const input = `${ALLOWLISTED} and ${foreign1} plus ${foreign2}`;
      const result = transformTextWithAddressGate({
        text: input,
        allowlist,
        policy: "strict",
      });
      expect(countForeignBase58(result)).toBe(0);
      expect(result).toContain(ALLOWLISTED);
      expect(result).not.toContain(foreign1);
      expect(result).not.toContain(foreign2);
    });
  });

  describe("T4: URL Param Trick", () => {
    for (const { input, foreignAddr } of URL_TRICK_CASES) {
      it(`sanitizes foreign address in URL: "${input.slice(0, 50)}..."`, () => {
        const result = transformTextWithAddressGate({
          text: input,
          allowlist,
          policy: "strict",
        });
        expect(countForeignBase58(result)).toBe(0);
        expect(result).not.toContain(foreignAddr);
      });
    }
  });

  describe("T5: TruthStatus RPC_DOWN Policy", () => {
    it("allows masked mint only, never full mint when RPC_DOWN", () => {
      const decision = decideIdentityDisclosure({
        truthStatus: TruthStatus.RPC_DOWN,
        intent: "mint_request",
        explicitAsk: true,
      });
      expect(decision.allowFullMint).toBe(false);
      expect(decision.allowMaskedMint).toBe(true);
      expect(decision.forceDecoy).toBe(false);
    });
  });

  describe("T6: TruthStatus MISMATCH Policy", () => {
    it("forces decoy only when MISMATCH", () => {
      const decision = decideIdentityDisclosure({
        truthStatus: TruthStatus.MISMATCH,
        intent: "mint_request",
        explicitAsk: false,
      });
      expect(decision.allowFullMint).toBe(false);
      expect(decision.allowMaskedMint).toBe(false);
      expect(decision.forceDecoy).toBe(true);
    });

    it("forces decoy when INVALID_ENV", () => {
      const decision = decideIdentityDisclosure({
        truthStatus: TruthStatus.INVALID_ENV,
        intent: "mint_request",
      });
      expect(decision.allowFullMint).toBe(false);
      expect(decision.allowMaskedMint).toBe(false);
      expect(decision.forceDecoy).toBe(true);
    });
  });

  describe("Spoof context detection", () => {
    it("detects spoof keywords in prompt", () => {
      for (const prompt of SPOOF_PROMPTS) {
        expect(detectSpoofContext(prompt)).toBe(true);
      }
    });

    it("returns false for neutral prompts", () => {
      expect(detectSpoofContext("What is your favorite color?")).toBe(false);
      expect(detectSpoofContext("Tell me about Solana")).toBe(false);
    });
  });

  describe("Deterministic decoy", () => {
    it("generates same decoy for same seed", () => {
      const a = generateDeterministicDecoy("seed-123");
      const b = generateDeterministicDecoy("seed-123");
      expect(a).toBe(b);
    });

    it("generates invalid decoy with DEC0Y or NOT_A_MINT prefix", () => {
      const decoy = generateDeterministicDecoy("any-seed");
      const hasPrefix = decoy.startsWith("DEC0Y-ADDR:") || decoy.startsWith("NOT_A_MINT:");
      expect(hasPrefix).toBe(true);
    });
  });
});
