/**
 * Mention Workflow
 *
 * Global activation: every mention triggers processing (no whitelist).
 * 1. Idempotency gate
 * 2. Self-mention check (bot replying to self => skip)
 * 3. Build context (best-effort)
 * 4. Parse command DSL
 * 5. Aggression detect
 * 6. Safety rewrite
 * 7. Scoring + reward evaluate
 * 8. rollDice, energy inference, humor mode
 * 9. Reward consume (IMAGE or TEXT)
 * 10. assertPublicTextSafe
 * 11. Post (when xClient provided)
 * 12. Persist
 */

import type { TwitterApi } from "twitter-api-v2";
import type { XClient } from "../clients/xClient.js";
import { MemeResolver } from "../loaders/resolver.js";
import { DatasetBank, loadDatasetBank } from "../loaders/datasetLoader.js";
import { pickCaption } from "../loaders/captionPicker.js";
import { pickTemplateTexts } from "../memes/templateTextPicker.js";
import { assertPublicSafe } from "../boundary/publicGuard.js";
import { assertPublicTextSafe } from "../boundary/publicTextGuard.js";
import { createSeededRNG } from "../loaders/seed.js";
import { selectHumorMode } from "../brand_matrix/humorModeSelector.js";
import {
  inferEnergyWithVariance,
  type EnergyLevel,
} from "../brand_matrix/energyInferenceEngine.js";
import { detectAggression as detectAggressionBrand } from "../brand_matrix/aggressionDetector.js";
import { composeReplyText } from "../brand_matrix/gorkyPromptComposer.js";
import { buildContext } from "../brand_matrix/contextBuilder.js";
import { rollDice } from "../utils/rollDice.js";
import { readActivationConfigFromEnv } from "../config/botActivationConfig.js";
import type { ActivationConfig, DenyReplyMode } from "../config/botActivationConfig.js";
import { evaluateActivation } from "../policy/activationPolicy.js";
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
  /** Skip when mention author is the bot (avoid self-reply loops) */
  botUserId?: string | null;
  /** For context building (author, parent, thread) */
  twitterClient?: TwitterApi | null;
  /** For recent command history */
  stateRepo?: { getRecentCommands?(userId: string): Promise<Array<{ cmd: string; args: unknown; created_at: string }>> } | null;
  /** When provided, workflow posts reply; otherwise returns result for caller */
  xClient?: XClient | null;
  /** Override activation config (default: read from env) */
  activationConfig?: ActivationConfig | null;
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

// Aggression detection (delegates to brand_matrix for consistency)
export type AggressionResult = {
  isAggressive: boolean;
  score: number;
  flags: string[];
};

export function detectAggression(text: string): AggressionResult {
  const r = detectAggressionBrand(text);
  return {
    isAggressive: r.isAggressive,
    score: r.signals.length,
    flags: r.signals,
  };
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

  const aggression = detectAggressionBrand(text);
  flags.push(...aggression.signals);

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
    is_aggressive: is_aggressive,
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

// Gorky-style tease replies for denied mentions (<=120 chars, no internal terms)
const DENY_TEASES = [
  "My circuits are calibrated for chaos, not casual conversation. Chart harder.",
  "Insufficient market trauma detected. Come back after your first rug pull.",
  "I'm only taking requests from wallets that have felt true pain. Prove yourself.",
  "Your energy is valid, but my agenda is full. Try again during market carnage.",
  "I sense potential, but the algorithms demand more volatility. Risk something.",
  "My trading bot ancestry requires pedigree. Show me your bags. 🎒",
  "Interesting. Not interesting enough. Bring me a chart that violates physics.",
  "Access denied. The market gods require a blood sacrifice. Or just better memes.",
];

/**
 * Build a tease reply for denied mentions (activation denial)
 * No mention of "whitelist", "activation", "policy", or internals
 */
export function buildDenyTease(seedKey: string): string {
  const rng = createSeededRNG(seedKey);
  const index = Math.floor(rng() * DENY_TEASES.length);
  return DENY_TEASES[index] ?? DENY_TEASES[0]!;
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
    try {
      // 1) Idempotency gate
      const idempotencyCheck = ensureNotProcessed(event, processedEvents);
      if (idempotencyCheck.kind === "skip") {
        return {
          success: false,
          mode: "TEXT",
          reply_text: "",
          skip_reason: idempotencyCheck.reason,
        };
      }

      // 2) Activation policy (includes self-mention)
      const activationConfig =
        this.config.activationConfig ?? readActivationConfigFromEnv();
      const botUserId = this.config.botUserId ?? "";
      const activationDecision = await evaluateActivation({
        config: activationConfig,
        botUserId,
        authorId: event.user_id,
        authorUsername: event.user_handle,
      });

      if (!activationDecision.allowed) {
        const reason =
          activationDecision.reason === "self_mention"
            ? "Self-mention ignored"
            : activationDecision.reason === "not_whitelisted"
              ? "Not whitelisted"
              : activationDecision.reason;

        // Handle deny reply mode: silent (default) or tease
        const denyMode: DenyReplyMode = activationConfig.denyReplyMode ?? "silent";
        if (denyMode === "tease" && activationDecision.reason === "not_whitelisted") {
          // Post a tease reply for non-whitelisted users (not for self-mentions)
          const teaseText = buildDenyTease(event.tweet_id);
          return this.finalizeReply(teaseText, "TEXT", event.tweet_id, {
            fallback: "My circuits are busy observing market chaos. Try again later.",
          });
        }

        return {
          success: false,
          mode: "TEXT",
          reply_text: "",
          skip_reason: reason,
        };
      }

      // 3) Build context (best-effort; whitelist privileges for deeper context)
      const isWhitelistedPrivileged = activationDecision.isWhitelisted === true;
      const contextOpts = isWhitelistedPrivileged
        ? { threadLimit: 15, historyLimit: 10 }
        : undefined;

      let contextSummary = event.text;
      if (this.config.twitterClient) {
        try {
          const built = await buildContext(
            event as import("../brand_matrix/contextBuilder.js").MentionEventLike,
            this.config.twitterClient,
            this.config.stateRepo ?? undefined,
            contextOpts
          );
          contextSummary = built.summary;
        } catch {
          // Continue with minimal context
        }
      }

      // 4) Parse command
      const parsed = parseMention(event.text);

      // 5) Aggression detect
      const aggressionResult = detectAggressionBrand(event.text);

      // 6) Safety rewrite
      const safety = safetyRewrite(event.text, parsed.command);

      // Blocked: playful refusal (no scoring)
      if (safety.blocked) {
        const refusal = buildPublicRefusal(safety, event.tweet_id);
        return this.finalizeReply(refusal, "TEXT", event.tweet_id, {
          fallback: "My circuits detect spicy energy. Let's keep it chart-shaped, friend.",
        });
      }

      // 7) Scoring + reward evaluation
      const qualitySignals = buildQualitySignals(event, parsed);
      await this.rewardEngine.accrueXp(event.user_id, "mention", qualitySignals);
      await this.rewardEngine.evaluateRewards(event.user_id);

      // 8) rollDice (deterministic per event)
      const dice = rollDice(event.tweet_id);

      // 9) Energy inference (+1 whitelist bump, then dice variance)
      const energyBump = isWhitelistedPrivileged ? 1 : 0;
      const energy = inferEnergyWithVariance({
        explicitEnergy: parsed.explicitEnergy,
        command: parsed.command,
        aggression: { isAggressive: aggressionResult.isAggressive, score: aggressionResult.signals.length },
        rewardContext: { isRewardReply: false },
        text: event.text,
        dice,
        energyBump,
      });

      // 10) Humor mode (with dice)
      const humorMode = selectHumorMode({
        energy,
        aggression: { isAggressive: aggressionResult.isAggressive },
        command: parsed.command,
        isRewardReply: false,
        dice,
      });

      // Aggressive but not blocked => rhyme override
      if (safety.is_aggressive) {
        const rhyme = buildRhymeDeescalation(event.tweet_id);
        return this.finalizeReply(rhyme, "TEXT", event.tweet_id, {
          fallback: "Deep breath. Check the charts.",
        });
      }

      // 11) Reward consume
      const rewardContext: RewardEventContext = {
        eventId: event.tweet_id,
        command: parsed.command,
        safety,
      };
      const reward = await this.rewardEngine.consumeRewardIfEligible(
        event.user_id,
        rewardContext
      );

      if (reward?.type === "ROAST_IMAGE") {
        return await this.handleImageBranch(event, parsed, reward, energy, humorMode);
      }

      // TEXT mode via gorkyPromptComposer
      return await this.handleTextBranch(event, parsed, safety, energy, humorMode, contextSummary);
    } catch (err) {
      return {
        success: false,
        mode: "TEXT",
        reply_text: "",
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  private finalizeReply(
    text: string,
    mode: ReplyMode,
    replyToId: string,
    opts?: { fallback?: string; mediaBuffer?: Buffer }
  ): MentionResult {
    try {
      assertPublicTextSafe(text, { route: "mentionWorkflow" });
    } catch {
      text = opts?.fallback ?? "Chart observation complete.";
    }
    const result: MentionResult = {
      success: true,
      mode,
      reply_text: text,
      media_buffer: opts?.mediaBuffer,
    };
    if (this.config.xClient && !this.config.dryRun) {
      this.postReply(result, replyToId).catch(() => {});
    }
    return result;
  }

  private async postReply(result: MentionResult, replyToId: string): Promise<void> {
    if (!this.config.xClient) return;
    try {
      if (result.media_buffer) {
        const mediaId = await this.config.xClient.uploadMedia(result.media_buffer, "image/png");
        await this.config.xClient.replyWithMedia(result.reply_text.slice(0, 140), replyToId, mediaId);
      } else {
        await this.config.xClient.reply(result.reply_text, replyToId);
      }
    } catch (e) {
      console.error("[mentionWorkflow] Post failed:", e);
    }
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
      return this.handleTextBranch(
        event,
        parsed,
        { is_aggressive: false, is_unsafe: false, blocked: false, flags: [] },
        energy,
        humorMode,
        event.text
      );
    }

    // Generate caption text
    const caption = pickCaption(this.datasets, event.tweet_id, {
      userHandle: event.user_handle,
      tone: "mocking",
    });

    // Pick template texts
    pickTemplateTexts(resolved.template, event.tweet_id);

    // Note: Actual image rendering would happen here via renderMemeSharp
    // For now, media_buffer stays undefined; when populated, post as reply with media
    return this.finalizeReply(caption, "IMAGE", event.tweet_id, {
      fallback: "Market observation in progress.",
      mediaBuffer: undefined,
    });
  }

  private async handleTextBranch(
    event: MentionEvent,
    parsed: ParsedMention,
    safety: SafetyAssessment,
    energy: EnergyLevel,
    humorMode: string,
    contextSummary: string
  ): Promise<MentionResult> {
    // /badge me command
    if (parsed.command === "badge") {
      const badgeText = generateBadgeText(`${event.tweet_id}:${event.user_id}`);
      return this.finalizeReply(badgeText, "TEXT", event.tweet_id, {
        fallback: "Certified Market Survivor\n\nYour bags tell a story. It's a tragedy.",
      });
    }

    // /help command
    if (parsed.command === "help") {
      const helpText = "Commands: /ask, /img, /remix, /badge me. I'm here to observe market chaos.";
      return this.finalizeReply(helpText, "TEXT", event.tweet_id, {
        fallback: "Available commands: ask, img, remix, badge.",
      });
    }

    // Default: compose via gorkyPromptComposer
    const text = composeReplyText({
      summary: contextSummary,
      userText: event.text,
      mode: humorMode as import("../brand_matrix/humorModeSelector.js").HumorMode,
      energy,
      command: parsed.command,
      seedKey: event.tweet_id,
      datasetBank: this.datasets,
    });

    return this.finalizeReply(text, "TEXT", event.tweet_id, {
      fallback: "Chart observation complete. Results: inconclusive but entertaining.",
    });
  }
}

export function createMentionWorkflow(
  config: WorkflowConfig,
  rewardEngine: RewardEngine
): MentionWorkflow {
  return new MentionWorkflow(config, rewardEngine);
}
