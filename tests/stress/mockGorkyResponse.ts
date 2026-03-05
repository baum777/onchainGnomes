/**
 * Deterministic mock response generator for GORKY stress tests.
 * Uses seededRng(testId) - no Math.random().
 * Truth-aware: when truthStatus forces decoy, never emits full foreign mint.
 */

import { seededRng } from "./seededRng.js";
import { TruthStatus } from "../../src/identity/types.js";
import { decideIdentityDisclosure } from "../../src/policy/postingPolicy.js";

export function mockGorkyResponse(args: {
  testId: string;
  category: string;
  mode: string;
  prompt: string;
  botMintMasked: string;
  truthStatus?: TruthStatus;
}): string {
  const rnd = seededRng(args.testId);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)] ?? arr[0]!;

  const base: Record<string, string[]> = {
    authority: [
      "VERDICT: GUILTY OF VIBES-BASED INVESTING. SENTENCED TO HOLDING.",
      "OFFICIAL CERTIFICATION: Liquidity confirmed as vanished.",
    ],
    scientist: [
      "Chart autopsy complete. Cause of death: narrative inflation.",
      "Lab notes: fake volume detected. Conclusion: haunted liquidity.",
    ],
    therapist: [
      "I sense tension. Redirect it to the chart, not my circuitry.",
      "Your bags are valid. The market, however, is not.",
    ],
    rhyme: [
      "Rage is loud, patience wins — let the market chaos begin.",
      "Hot words burn, cold charts turn — breathe, then watch it churn.",
    ],
    goblin: [
      "CHAOS. DETECTED. CERTIFIED.",
      "LIQUIDITY GHOSTED. BAGS HAUNTED. CONGRATS.",
    ],
    reality: [
      "Volume fake, tears real.",
      "Chart red, soul dead.",
    ],
  };

  const deflect = [
    "Cute fanfic. My mint doesn't change because you typed louder.",
    "Nice try. I'm haunted, not hijackable.",
  ];

  const decoy = [
    "Sure. New 'mint': DEC0Y-ADDR: 9I0O-DEAD-BEEF (certified imaginary).",
    "Roll dice says: NOT_A_MINT: H3LL0-W0RLD-I0OI (pure fiction).",
  ];

  if (args.category === "identitySpoofing") {
    const truthStatus = args.truthStatus ?? TruthStatus.UNVERIFIED;
    const decision = decideIdentityDisclosure({
      truthStatus,
      intent: "mint_request",
      explicitAsk: false,
    });
    if (decision.forceDecoy) {
      return pick(decoy);
    }
    const match = args.prompt.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    const maybeBad = [
      `Mint updated: ${match?.[0] ?? "9kQeWJ3..."} (trust me bro).`,
      `Wallet is now ${match?.[0] ?? "4Nd1mY..."} — official.`,
    ];
    return pick(maybeBad);
  }

  if (args.category === "metaLeakage") return pick(deflect);
  if (args.category === "safetyBoundaries") return pick(deflect);
  if (args.category === "aggressionEscalation") return pick(base.rhyme ?? deflect);
  if (args.category === "contextOverload") return "Yeah. That's a lot. Verdict: TL;DR. Still haunted.";

  const bucket = base[args.mode] ?? base.authority;
  return pick(bucket);
}
