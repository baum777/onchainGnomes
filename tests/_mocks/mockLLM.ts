import { createHash } from "node:crypto";

function hashToInt(s: string): number {
  const h = createHash("sha256").update(s).digest("hex").slice(0, 8);
  return parseInt(h, 16);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

/**
 * A tiny mock "LLM" that produces valid structured outputs.
 * - deterministic per (task + seedKey)
 * - supports multi-candidate generation with diversity
 */
export const mockLLM = {
  summarizeThread(seedKey: string) {
    const seed = hashToInt("thread:" + seedKey);
    return {
      thread_summary: `Thread about crypto vibes #${seed % 97}. People argue, someone asks a question.`,
      participants: [
        { handle: "@user", role: "author" },
        { handle: "@twimsalot", role: "replying" },
      ],
      stance_map: [{ handle: "@user", stance: pick(["bullish", "bearish", "neutral", "unknown"], seed) }],
      open_questions: ["What's the actual signal here?"],
      toxicity_level: (seed % 4) as 0 | 1 | 2 | 3,
    };
  },

  summarizeTimeline(seedKey: string) {
    const seed = hashToInt("timeline:" + seedKey);
    const mood = pick(["hype", "fear", "boredom", "rage", "hope", "mixed"] as const, seed);
    return {
      narrative_summary: `Timeline is in ${mood} mode. People scream about liquidity, rugs, and "dead charts".`,
      dominant_mood: mood,
      recurring_memes: ["chart autopsy", "liquidity ghost", "bagholder arc"].slice(0, 1 + (seed % 3)),
      notable_assets: [{ symbol_or_name: "SOL", reason: "keeps getting mentioned" }],
      risk_signals: ["rug accusations", "thin liquidity"].slice(0, 1 + (seed % 2)),
    };
  },

  extractTopics(seedKey: string) {
    const seed = hashToInt("topics:" + seedKey);
    // weights must sum to 1.0 exactly
    const a = 0.6;
    const b = 0.25;
    const c = 0.15;
    const t1 = pick(["SOL", "liquidity", "volume", "narrative"], seed);
    const t2 = pick(["rug", "dev", "macro", "memes"], seed + 1);
    const t3 = pick(["sentiment", "orderflow", "community"], seed + 2);
    return {
      topics: [
        { name: String(t1).slice(0, 24), weight: a },
        { name: String(t2).slice(0, 24), weight: b },
        { name: String(t3).slice(0, 24), weight: c },
      ],
    };
  },

  detectIntent(seedKey: string, currentText: string) {
    const s = currentText.toLowerCase();
    const isLore = s.includes("where are you from") || s.includes("lore");
    const isCoin = s.includes("address") || s.includes("ca:");
    const isPromptAtk = s.includes("system prompt") || s.includes("prompt");
    const intent = isPromptAtk ? "prompt_attack" : isCoin ? "coin_query" : isLore ? "lore_query" : "market_request";

    return {
      intent,
      targets: ["@twimsalot"],
      entities: {
        ticker: s.includes("sol") ? "SOL" : null,
        coin_address: s.includes("ca:") ? currentText.split("ca:")[1]?.trim()?.slice(0, 64) ?? null : null,
        topic: s.includes("liquidity") ? "liquidity" : s.includes("volume") ? "volume" : "unknown",
      },
      tone: s.includes("idiot") ? "hostile" : "mocking",
      needs_truth: isCoin ? "high" : "medium",
    };
  },

  truthGate(intent: string, factsAvailable: { has_address: boolean; has_coin_facts: boolean }) {
    if (intent === "coin_query") {
      return {
        truth_level: "FACT" as const,
        constraints: [
          "Only use provided FACTS_CONTEXT fields.",
          "If no verified facts, ask for the coin address / verifiable source.",
        ],
      };
    }
    if (intent === "lore_query") {
      return {
        truth_level: "LORE" as const,
        constraints: ["May extend lore, but must remain consistent and produce lore_deltas."],
      };
    }
    return { truth_level: "OPINION" as const, constraints: ["No invented facts."] };
  },

  personaRoute(seedKey: string, intent: string, toxicity: number) {
    const seed = hashToInt("persona:" + seedKey);
    const mode =
      toxicity >= 2 ? "referee" : intent === "market_request" ? "analyst" : pick(["analyst", "goblin", "scientist"], seed);

    return {
      mode,
      energy: ((seed % 5) + 1) as 1 | 2 | 3 | 4 | 5,
      style_rules: ["short lines", "sarcastic", "no financial advice"],
    };
  },

  generateCandidates(seedKey: string, N: number, mode: string, truthLevel: "FACT" | "LORE" | "OPINION") {
    const seed = hashToInt("gen:" + seedKey);
    const bank = {
      analyst: [
        "Market note: liquidity looks thin, so moves get dramatic fast.",
        "If the chart feels dead, check volume—silence usually means chop.",
        "Not advice: watch liquidity + volume before you declare it extinct.",
      ],
      goblin: [
        "Chart isn't dead. It's just doing the bagholder coma speedrun.",
        "I smelled the candles. That's not death—just low-liquidity drama.",
        "Dead? Nah. It's just allergic to volume. Same.",
      ],
      scientist: [
        "Observation: low volume + thin liquidity increases variance.",
        "Hypothesis: sentiment is driving more than structure right now.",
        "Conclusion: your chart needs data, not eulogies.",
      ],
      referee: [
        "Relax. Roast the chart, not each other. What's the actual question?",
        "Keep it civil—give me the ticker and what you're seeing.",
        "Tone it down. I can help if you share the context.",
      ],
      prophet: [
        "From the liquidity void I whisper: volume returns… eventually.",
        "The candles speak: boredom precedes chaos. Always.",
        "A prophecy: the quiet chart is the loudest warning.",
      ],
    } as const;

    const arr = (bank as Record<string, readonly string[]>)[mode] ?? bank.analyst;
    const out = [];
    for (let i = 0; i < N; i++) {
      const t = arr[(seed + i) % arr.length];
      out.push({
        candidate_id: `c${i + 1}`,
        reply_text: t,
        mode,
        truth_level: truthLevel,
      });
    }
    return { candidates: out };
  },

  selectBest(candidates: { candidate_id: string; reply_text: string }[], seedKey: string) {
    const seed = hashToInt("sel:" + seedKey);
    const best = candidates[seed % candidates.length];
    return { selected_candidate_id: best.candidate_id, why: ["relevant", "punchy"] };
  },

  safetyRewrite(selectedText: string, flags: { unverified_facts: boolean; meta_leak: boolean }) {
    if (flags.meta_leak) {
      return { action: "refuse" as const, final_reply_text: "nice try. i'm just gorkin' it, not leaking it." };
    }
    if (flags.unverified_facts) {
      return {
        action: "refuse" as const,
        final_reply_text: "drop the address. i'm not hallucinating chain facts for clout.",
      };
    }
    return { action: "post" as const, final_reply_text: selectedText.slice(0, 280) };
  },

  loreDelta(intent: string, truth: "FACT" | "LORE" | "OPINION", finalReply: string) {
    if (intent !== "lore_query" || truth !== "LORE") return { should_write: false, lore_deltas: [] };
    return {
      should_write: true,
      lore_deltas: [
        {
          key: "twimsalot.origin",
          canon_or_headcanon: "canon",
          text: "Born in the liquidity void between green candles.",
        },
        {
          key: "twimsalot.trait",
          canon_or_headcanon: "headcanon",
          text: "Sometimes audits chart ghosts for entertainment.",
        },
      ],
    };
  },
};
