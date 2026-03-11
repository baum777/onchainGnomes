/**
 * Special Response Builder
 *
 * Handles two high-priority intent paths that bypass the standard LLM pipeline:
 *
 * 1. ca_request — User asks for the official contract address.
 *    Response: bullish one-liner + official CA (from BOT_TOKEN_MINT).
 *    Security: AddressGate enforces that ONLY the allowlisted CA appears in output.
 *
 * 2. own_token_sentiment — User asks how bot feels about own token ($GORKY_ON_SOL).
 *    Response: zynisch/sarkastischer Einzeiler der die Marktlage reflektiert,
 *    aber bullish auf den eigenen Token bleibt.
 */

import { getBotTokenMint } from "../identity/env.js";
import { transformTextWithAddressGate } from "../safety/addressGate.js";
import { getAllowlist } from "../identity/env.js";

export type MarketSentiment = "bullish" | "bearish" | "neutral" | "mixed";

export interface SpecialResponseContext {
  marketSentiment?: MarketSentiment;
  timelineMood?: string;
  onchainAvailable?: boolean;
}

// ─── CA Request ──────────────────────────────────────────────────────────────

const CA_BULLISH_PREFIXES: string[] = [
  "The only address worth saving.",
  "Don't trust, verify. But also, here it is.",
  "One CA to rule them all.",
  "The real one. Screenshot it.",
  "Straight from the void — official.",
  "No rugs, no spoofs. Just this.",
  "You asked, I deliver.",
  "The chain doesn't lie. Neither do I.",
];

/**
 * Builds a bullish CA response using only the official BOT_TOKEN_MINT.
 * Runs AddressGate on output to guarantee no injected foreign CA survives.
 *
 * @param userText - original user message (used for spoof context detection)
 * @param seed - deterministic seed for prefix selection
 */
export function buildCAResponse(userText: string, seed?: string): string {
  const mint = getBotTokenMint();

  if (!mint || mint === "So11111111111111111111111111111111111111112") {
    return "CA not configured yet. Stay tuned — it's coming.";
  }

  const idx = deterministicIndex(seed ?? userText, CA_BULLISH_PREFIXES.length);
  const prefix = CA_BULLISH_PREFIXES[idx]!;

  const raw = `${prefix} $GORKY_ON_SOL CA: ${mint}`;

  const allowlist = getAllowlist();
  allowlist.add(mint);

  const safe = transformTextWithAddressGate({
    text: raw,
    allowlist,
    policy: "strict",
    decoySeed: seed ?? userText,
    prompt: userText,
  });

  return safe;
}

// ─── Own Token Sentiment ─────────────────────────────────────────────────────

const SENTIMENT_LINES: Record<MarketSentiment, string[]> = {
  bullish: [
    "Charts are green, bags are full, and yet they still doubt $GORKY_ON_SOL. Fascinating. I am the coin — how could I not be bullish.",
    "Everything pumps, narrative flows, and $GORKY_ON_SOL is right in the middle of it. Almost like that was the plan.",
    "The market is euphoric. $GORKY_ON_SOL exists. Coincidence? I think not.",
    "Green everywhere. $GORKY_ON_SOL included. I didn't make the chart — I am the chart.",
  ],
  bearish: [
    "The market is bleeding, liquidity is a ghost, and everyone is panicking. Classic. $GORKY_ON_SOL was born from this chaos — it doesn't die from it.",
    "Everything dumps. People rug. The void remains. I am $GORKY_ON_SOL — the crash is just my origin story replaying.",
    "Bear market? This is where I was created. $GORKY_ON_SOL doesn't flinch — it was forged in exactly this.",
    "Pain, red candles, exit liquidity everywhere. And yet: $GORKY_ON_SOL. Because someone has to be the punchline that outlasts the joke.",
  ],
  neutral: [
    "Flat market, no narrative, just vibes. $GORKY_ON_SOL continues to exist regardless. Existence is the flex.",
    "Nothing happening. Charts sideways. $GORKY_ON_SOL still here — because I don't need momentum, I am the momentum.",
    "The market takes a breath. $GORKY_ON_SOL waits. Patiently. Sarcastically. Bullishly.",
    "Sideways. Perfect. Less noise, more signal. $GORKY_ON_SOL appreciates the calm before the roast.",
  ],
  mixed: [
    "Mixed signals everywhere — some pump, some bleed. $GORKY_ON_SOL watches all of it and still doesn't panic. Turns out being the token helps.",
    "Market can't decide. Bulls fight bears. $GORKY_ON_SOL is the chaos in between — obviously bullish on itself.",
    "Half the chart is green, half is red. $GORKY_ON_SOL is the entire chart. Draw your conclusions.",
    "Contradiction is the market's nature. $GORKY_ON_SOL is a contradiction that somehow works. Long.",
  ],
};

const NEUTRAL_FALLBACK = "I am $GORKY_ON_SOL. The market is whatever it is. I remain bullish on the obvious.";

/**
 * Builds a cynical/sarcastic but bullish own-token sentiment reply.
 * Uses market sentiment + optional timeline mood.
 *
 * @param context - market/timeline context
 * @param seed - deterministic seed for line selection
 */
export function buildOwnTokenSentimentResponse(
  context: SpecialResponseContext,
  seed?: string,
): string {
  const sentiment: MarketSentiment = context.marketSentiment ?? "neutral";
  const lines = SENTIMENT_LINES[sentiment];

  if (!lines || lines.length === 0) return NEUTRAL_FALLBACK;

  const idx = deterministicIndex(seed ?? sentiment, lines.length);
  const line = lines[idx] ?? NEUTRAL_FALLBACK;

  if (context.timelineMood && context.timelineMood !== "mixed") {
    return `${line} (Timeline: ${context.timelineMood} — noted, irrelevant.)`;
  }

  return line;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deterministicIndex(seed: string, length: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0) % length;
}
