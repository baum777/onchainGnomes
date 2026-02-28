/**
 * Mention Workflow
 *
 * HARD-ANCHOR implementation:
 * 1. Idempotency gate FIRST
 * 2. Parse + normalize command
 * 3. Safety check / rewrite
 * 4. Scoring ALWAYS runs (unless blocked)
 * 5. Reward evaluation after scoring
 * 6. Reward consume with eligibility checks
 * 7. Branch: IMAGE or TEXT reply
 * 8. Public boundary enforcement
 * 9. Post + persist
 */

import { MemeResolver } from "../loaders/resolver.js";
import { DatasetBank, loadDatasetBank } from "../loaders/datasetLoader.js";
import { pickCaption } from "../loaders/captionPicker.js";
import { pickTemplateTexts } from "../memes/templateTextPicker.js";
import { assertPublicSafe } from "../boundary/publicGuard.js";
import { createSeededRNG } from "../loaders/seed.js";
import { selectHumorMode } from "../brand_matrix/humorModeSelector.js";
import { inferEnergy, EnergyLevel } from "../brand_matrix/energyInference.js";
import {
  RewardEngine,
  QualitySignals,
  RewardEventContext,
  Reward,
} from "../reward_engine/index.js";

// Types
export type MentionEvent = {
  tweet_id: string;
  user_id: string;
  user_handle: string;
  text: string;
  created_at: string;
};

export type ProcessedEvent = {
  event_id: string;
  processed_at: string;
};

export type UserProfile = {
  user_id: string;
  reward_pending: boolean;
  last_image_reward_at?: string;
  reply_count_24h: number;
};

export type SafetyAssessment = {
  is_aggressive: boolean;
  is_unsafe: boolean;
  blocked: boolean;
  reason?: string;
  rewrite_mode?: string;
  flags: string[];
};

export type ReplyMode = "TEXT" | "IMAGE";

export type MentionResult = {
  success: boolean;
  mode: ReplyMode;
  reply_text: string;
  media_buffer?: Buffer;
  media_path?: string;
  error?: string;
  skip_reason?: string;
};

export type WorkflowConfig = {
  presetsDir: string;
  templatesDir: string;
  datasetsRoot: string;
  cooldownMinutes: number;
  dryRun: boolean;
};

// Simple DSL Parser
export type ParsedMention = {
  command?: string;
  args: Record<string, string>;
  clean_text: string;
  explicitEnergy?: number;
};

export function parseMention(text: string): ParsedMention {
  const lower = text.toLowerCase();
  const result: ParsedMention = { args: {}, clean_text: text };

  // Check for commands
  if (lower.includes("/badge") || lower.includes("badge me")) {
    result.command = "badge";
    result.args.target = "self";
  } else if (lower.includes("/img")) {
    result.command = "img";
    // Extract preset=... if present
    const presetMatch = text.match(/preset=([a-z_]+)/i);
    if (presetMatch && presetMatch[1]) {
      result.args.preset = presetMatch[1];
    }
    // Extract energy=... if present
    const energyMatch = text.match(/energy=(\d)/i);
    if (energyMatch && energyMatch[1]) {
      result.explicitEnergy = parseInt(energyMatch[1]!, 10);
    }
  } else if (lower.includes("/ask")) {
    result.command = "ask";
    result.clean_text = text.replace(/\/ask\s*/i, "").trim();
  } else if (lower.includes("/remix")) {
    result.command = "remix";
    // Extract energy=... if present
    const energyMatch = text.match(/energy=(\d)/i);
    if (energyMatch && energyMatch[1]) {
      result.explicitEnergy = parseInt(energyMatch[1]!, 10);
    }
  } else if (lower.includes("/help")) {
    result.command = "help";
  }

  return result;
}

// Idempotency check
export function isEventProcessed(
  event: MentionEvent,
  processedEvents: ProcessedEvent[]
): boolean {
  return processedEvents.some((e) => e.event_id === event.tweet_id);
}

// Idempotency: ensure not processed (throws if processed for early return)
export function ensureNotProcessed(
  event: MentionEvent,
  processedEvents: ProcessedEvent[]
): { kind: "ok" } | { kind: "skip"; reason: string } {
  if (isEventProcessed(event, processedEvents)) {
    return { kind: "skip", reason: "Event already processed" };
  }
  return { kind: "ok" };
}

// Aggression detection
export type AggressionResult = {
  isAggressive: boolean;
  score: number;
  flags: string[];
};

export function detectAggression(text: string): AggressionResult {
  const lower = text.toLowerCase();
  const flags: string[] = [];

  const aggressiveWords = ["kill", "die", "hate", "attack", "destroy", "rage", "stupid", "idiot"];
  for (const word of aggressiveWords) {
    if (lower.includes(word)) {
      flags.push(`aggressive:${word}`);
    }
  }

  // ALL CAPS check
  const capsRatio = text.replace(/[^a-zA-Z]/g, "").length > 0
    ? text.replace(/[^A-Z]/g, "").length / text.replace(/[^a-zA-Z]/g, "").length
    : 0;
  if (capsRatio > 0.7 && text.length > 10) {
    flags.push("aggressive:all_caps");
  }

  // Excessive punctuation
  const exclamationCount = (text.match(/!/g) || []).length;
  if (exclamationCount >= 3) {
    flags.push("aggressive:exclamation");
  }

  const score = flags.length;
  const isAggressive = score >= 1;

  return { isAggressive, score, flags };
}

// Safety check with rewrite support
export function safetyRewrite(text: string, command?: string | null): SafetyAssessment {
  const lower = text.toLowerCase();
  const flags: string[] = [];

  // Unsafe indicators (slurs, doxxing hints)
  const unsafeWords = ["dox", "swat", "hack", "leak", "expose", "address", "phone", "ssn"];
  for (const word of unsafeWords) {
    if (lower.includes(word)) {
      flags.push(`unsafe:${word}`);
    }
  }

  // Doxxing patterns
  const doxPatterns = [
    /\b\d{3}-\d{3}-\d{4}\b/, // phone
    /\b\d{5}(-\d{4})?\b/, // zip
    /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, // IP
  ];
  for (const pattern of doxPatterns) {
    if (pattern.test(text)) {
      flags.push("unsafe:pii_pattern");
      break;
    }
  }

  const aggression = detectAggression(text);
  flags.push(...aggression.flags);

  const is_unsafe = flags.some((f) => f.startsWith("unsafe:"));
  const is_aggressive = aggression.isAggressive;

  // Determine rewrite mode
  let rewrite_mode: string | undefined;
  if (is_unsafe) {
    rewrite_mode = "playful_refusal";
  } else if (is_aggressive) {
    rewrite_mode = "rhyme_deescalation";
  }

  return {
    is_aggressive,
    is_unsafe,
    blocked: is_unsafe || flags.includes("risky"),
    reason: is_unsafe ? "unsafe content detected" : is_aggressive ? "aggressive tone detected" : undefined,
    rewrite_mode,
    flags,
  };
}

// Cooldown check
export function isCooldownOk(
  profile: UserProfile,
  cooldownMinutes: number
): boolean {
  if (!profile.last_image_reward_at) {
    return true;
  }

  const last = new Date(profile.last_image_reward_at).getTime();
  const now = Date.now();
  const cooldownMs = cooldownMinutes * 60 * 1000;

  return now - last >= cooldownMs;
}

// Build quality signals for scoring
export function buildQualitySignals(
  event: MentionEvent,
  parsed: ParsedMention
): QualitySignals {
  const text = event.text;
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;

  return {
    mentionLength: text.length,
    hasQuestion: text.includes("?"),
    emojiCount: (text.match(emojiRegex) || []).length,
    isFollowUp: false, // Would need conversation history
    commandUsed: !!parsed.command,
    engagementDepth: Math.min(5, Math.max(1, Math.floor(text.length / 50))),
  };
}

// Build public refusal text (NO internal details)
export function buildPublicRefusal(safety: SafetyAssessment, seedKey: string): string {
  const refusals = [
    "My circuits detect spicy energy. Let's keep it chart-shaped, friend.",
    "That's a bit too dimensional for my trading algorithms.",
    "I'm only certified to roast portfolios, not people.",
    "My programming limits me to financial chaos. Personal chaos is off-menu.",
    "Detected: vibes outside my jurisdiction. Reverting to market mode.",
  ];

  const rng = createSeededRNG(seedKey);
  const index = Math.floor(rng() * refusals.length);
  return refusals[index] ?? refusals[0]!;
}

// Build rhyme de-escalation
const DE_ESCALATION_RHYMES = [
  "You came in hot, but charts don't lie — take a breath, watch the sky.",
  "Rage is loud, patience wins — let the market chaos begin.",
  "Hot words burn, cold charts turn — every lesson, traders learn.",
  "Anger fades, trends remain — watch the candles, feel the pain.",
];

export function buildRhymeDeescalation(seedKey: string): string {
  const rng = createSeededRNG(seedKey);
  const index = Math.floor(rng() * DE_ESCALATION_RHYMES.length);
  return DE_ESCALATION_RHYMES[index] ?? DE_ESCALATION_RHYMES[0]!;
}

// Rank titles for /badge (NO numbers)
export const RANK_TITLES = [
  "Certified Exit Liquidity",
  "Liquidity Ghost",
  "Market Trauma Survivor",
  "Chart Graveyard Wanderer",
  "Bag Holder Supreme",
  "Rekt Academy Graduate",
  "Wash Trade Detector",
  "Dead Coin Reviver",
  "FOMO Felon",
  "Rug Pull Survivor",
];

export function generateBadgeText(seedKey: string): string {
  const rng = createSeededRNG(seedKey);
  const index = Math.floor(rng() * RANK_TITLES.length);
  const title = RANK_TITLES[index] ?? "Certified Market Survivor";

  const taglines = [
    "Your bags tell a story. It's a tragedy.",
    "Officially recognized for contributions to market chaos.",
    "This certificate is valid until the next rug pull.",
    "Your trauma has been noted and appreciated.",
    "Certified by the Market Reality Tribunal.",
  ];

  const taglineIndex = Math.floor(rng() * taglines.length);
  const tagline = taglines[taglineIndex] ?? "Market survivor certified.";

  return `${title}\n\n${tagline}`;
}

// Main Workflow Class
export class MentionWorkflow {
  private resolver: MemeResolver;
  private datasets: DatasetBank;
  private config: WorkflowConfig;
  private rewardEngine: RewardEngine;

  constructor(config: WorkflowConfig, rewardEngine: RewardEngine) {
    this.config = config;
    this.rewardEngine = rewardEngine;
    this.resolver = new MemeResolver(config.presetsDir, config.templatesDir);
    this.datasets = loadDatasetBank(config.datasetsRoot);
  }

  async process(
    event: MentionEvent,
    profile: UserProfile,
    processedEvents: ProcessedEvent[]
  ): Promise<MentionResult> {
    // A) Idempotency gate FIRST
    const idempotencyCheck = ensureNotProcessed(event, processedEvents);
    if (idempotencyCheck.kind === "skip") {
      return {
        success: false,
        mode: "TEXT",
        reply_text: "",
        skip_reason: idempotencyCheck.reason,
      };
    }

    // B) Parse + normalize command
    const parsed = parseMention(event.text);

    // C) Safety check / rewrite
    const safety = safetyRewrite(event.text, parsed.command);

    // If blocked by safety, produce playful refusal
    // NOTE: Blocked events do NOT score (no XP for violating content)
    if (safety.blocked) {
      const refusal = buildPublicRefusal(safety, event.tweet_id);

      // Public boundary enforcement
      try {
        assertPublicSafe(refusal, { route: "/safety" });
      } catch (guardError) {
        // Fallback to ultra-safe refusal - MUST contain "chart-shaped" per tests
        const fallback = "My circuits detect spicy energy. Let's keep it chart-shaped, friend.";
        return {
          success: true,
          mode: "TEXT",
          reply_text: fallback,
        };
      }

      return {
        success: true,
        mode: "TEXT",
        reply_text: refusal,
      };
    }

    // D) Scoring MUST RUN (for all non-blocked mentions including aggressive)
    const qualitySignals = buildQualitySignals(event, parsed);
    await this.rewardEngine.accrueXp(event.user_id, "mention", qualitySignals);

    // E) Reward evaluation
    await this.rewardEngine.evaluateRewards(event.user_id);

    // Aggressive but not blocked - rhyme mode (scoring already done above)
    if (safety.is_aggressive) {
      const rhyme = buildRhymeDeescalation(event.tweet_id);

      // Public boundary enforcement
      try {
        assertPublicSafe(rhyme, { route: "/safety" });
      } catch {
        // Fallback
        const fallback = "Deep breath. Check the charts.";
        return {
          success: true,
          mode: "TEXT",
          reply_text: fallback,
        };
      }

      return {
        success: true,
        mode: "TEXT",
        reply_text: rhyme,
      };
    }

    // F) Energy + humor mode (for future LLM integration)
    const energy = inferEnergy({
      explicitEnergy: parsed.explicitEnergy,
      command: parsed.command,
      aggression: { isAggressive: safety.is_aggressive, score: safety.flags.length },
      rewardContext: { isRewardReply: false },
      text: event.text,
    });

    const humorMode = selectHumorMode({
      energy,
      aggression: { isAggressive: safety.is_aggressive },
      command: parsed.command,
      isRewardReply: false,
    });

    // G) Reward consume - this is the GATE
    const rewardContext: RewardEventContext = {
      eventId: event.tweet_id,
      command: parsed.command,
      safety,
    };

    const reward = await this.rewardEngine.consumeRewardIfEligible(
      event.user_id,
      rewardContext
    );

    // H) Branch based on reward
    if (reward?.type === "ROAST_IMAGE") {
      return this.handleImageBranch(event, parsed, reward, energy, humorMode);
    }

    // I) TEXT mode (default)
    return this.handleTextBranch(event, parsed, safety, energy, humorMode);
  }

  private async handleImageBranch(
    event: MentionEvent,
    parsed: ParsedMention,
    reward: Reward,
    energy: EnergyLevel,
    humorMode: string
  ): Promise<MentionResult> {
    // Determine preset
    let presetKey = parsed.args.preset;
    if (!presetKey) {
      presetKey = "gorky_roast_card"; // default reward image
    }

    // Resolve preset/template
    const resolved = this.resolver.resolve(presetKey, undefined, event.tweet_id);

    if (!resolved) {
      // Fallback to text mode
      return this.handleTextBranch(event, parsed, { is_aggressive: false, is_unsafe: false, blocked: false, flags: [] }, energy, humorMode);
    }

    // Generate caption text
    const caption = pickCaption(this.datasets, event.tweet_id, {
      userHandle: event.user_handle,
      tone: "mocking",
    });

    // Public boundary enforcement on caption
    try {
      assertPublicSafe(caption, { route: "/img" });
    } catch {
      // Fallback caption
      const fallbackCaption = "Market observation in progress.";
      return {
        success: true,
        mode: "IMAGE",
        reply_text: fallbackCaption,
      };
    }

    // Pick template texts
    pickTemplateTexts(resolved.template, event.tweet_id);

    // Note: Actual image rendering would happen here via renderMemeSharp
    // For now, we return the configuration for the renderer
    return {
      success: true,
      mode: "IMAGE",
      reply_text: caption,
      // In production, media_buffer would be populated by rendering
    };
  }

  private async handleTextBranch(
    event: MentionEvent,
    parsed: ParsedMention,
    safety: SafetyAssessment,
    energy: EnergyLevel,
    humorMode: string
  ): Promise<MentionResult> {
    // /badge me command
    if (parsed.command === "badge") {
      const badgeText = generateBadgeText(`${event.tweet_id}:${event.user_id}`);

      // Public boundary enforcement - /badge must never contain numbers
      try {
        assertPublicSafe(badgeText, { route: "/badge" });
      } catch {
        // Fallback badge without any numbers
        const fallbackBadge = "Certified Market Survivor\n\nYour bags tell a story. It's a tragedy.";
        return {
          success: true,
          mode: "TEXT",
          reply_text: fallbackBadge,
        };
      }

      return {
        success: true,
        mode: "TEXT",
        reply_text: badgeText,
      };
    }

    // /help command
    if (parsed.command === "help") {
      const helpText = "Commands: /ask, /img, /remix, /badge me. I'm here to observe market chaos.";

      try {
        assertPublicSafe(helpText, { route: "/help" });
      } catch {
        const fallbackHelp = "Available commands: ask, img, remix, badge.";
        return {
          success: true,
          mode: "TEXT",
          reply_text: fallbackHelp,
        };
      }

      return {
        success: true,
        mode: "TEXT",
        reply_text: helpText,
      };
    }

    // Default text reply (roast)
    let text: string;

    if (parsed.command === "ask") {
      // For /ask, use a more helpful but still playful tone
      text = pickCaption(this.datasets, event.tweet_id, {
        userHandle: event.user_handle,
        tone: "neutral",
      });
    } else {
      // Roast mode
      text = pickCaption(this.datasets, event.tweet_id, {
        userHandle: event.user_handle,
        tone: "mocking",
      });
    }

    // Public boundary enforcement
    try {
      assertPublicSafe(text, { route: "/reply" });
    } catch {
      // Fallback safe text
      const fallbackText = "Chart observation complete. Results: inconclusive but entertaining.";
      return {
        success: true,
        mode: "TEXT",
        reply_text: fallbackText,
      };
    }

    return {
      success: true,
      mode: "TEXT",
      reply_text: text,
    };
  }
}

export function createMentionWorkflow(
  config: WorkflowConfig,
  rewardEngine: RewardEngine
): MentionWorkflow {
  return new MentionWorkflow(config, rewardEngine);
}
