import { MemeResolver, ResolvedMemeConfig } from "../loaders/resolver.js";
import { DatasetBank, loadDatasetBank } from "../loaders/datasetLoader.js";
import { pickCaption } from "../loaders/captionPicker.js";
import { pickTemplateTexts } from "../memes/templateTextPicker.js";
import { assertPublicSafe } from "../boundary/publicGuard.js";
import { createSeededRNG } from "../loaders/seed.js";

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
  } else if (lower.includes("/ask")) {
    result.command = "ask";
    result.clean_text = text.replace(/\/ask\s*/i, "").trim();
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

// Safety check (deterministic, no LLM)
export function assessSafety(text: string): SafetyAssessment {
  const lower = text.toLowerCase();
  const flags: string[] = [];

  // Aggressive indicators
  const aggressiveWords = ["kill", "die", "hate", "attack", "destroy", "rage"];
  for (const word of aggressiveWords) {
    if (lower.includes(word)) {
      flags.push(`aggressive:${word}`);
    }
  }

  // Unsafe indicators (slurs, doxxing hints)
  const unsafeWords = ["dox", "swat", "hack", "leak", "expose", "address", "phone"];
  for (const word of unsafeWords) {
    if (lower.includes(word)) {
      flags.push(`unsafe:${word}`);
    }
  }

  const is_aggressive = flags.some((f) => f.startsWith("aggressive:"));
  const is_unsafe = flags.some((f) => f.startsWith("unsafe:"));

  return { is_aggressive, is_unsafe, flags };
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

// Rank titles for /badge (no numbers)
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

// Rhyme de-escalation for aggressive mentions
const DE_ESCALATION_RHYMES = [
  "You came in hot, but charts don't lie — take a breath, watch the sky.",
  "Rage is loud, patience wins — let the market chaos begin.",
  "Hot words burn, cold charts turn — every lesson, traders learn.",
  "Anger fades, trends remain — watch the candles, feel the pain.",
];

// Humor mode selection (deterministic, mirrors Python HumorModeSelector)
export type HumorMode =
  | "authority"
  | "scientist"
  | "therapist"
  | "reality"
  | "goblin"
  | "rhyme_override";

export function selectHumorMode(
  energy: number = 3,
  aggressionFlag: boolean = false,
  flavor: string = "chaos"
): HumorMode {
  if (aggressionFlag) return "rhyme_override";
  const e = Math.max(1, Math.min(5, energy));
  if (e >= 5) return "goblin";
  if (e <= 2) return "therapist";
  if (e === 3) return "authority";
  if (e === 4) {
    if (flavor === "zen") return "therapist";
    return "scientist";
  }
  return "authority";
}

// Playful refusal for unsafe mentions
const PLAYFUL_REFUSALS = [
  "My circuits detect spicy energy. Let's keep it chart-shaped, friend.",
  "That's a bit too dimensional for my trading algorithms.",
  "I'm only certified to roast portfolios, not people.",
  "My programming limits me to financial chaos. Personal chaos is off-menu.",
];

// Main Workflow Class
export class MentionWorkflow {
  private resolver: MemeResolver;
  private datasets: DatasetBank;
  private config: WorkflowConfig;

  constructor(config: WorkflowConfig) {
    this.config = config;
    this.resolver = new MemeResolver(config.presetsDir, config.templatesDir);
    this.datasets = loadDatasetBank(config.datasetsRoot);
  }

  async process(
    event: MentionEvent,
    profile: UserProfile,
    processedEvents: ProcessedEvent[]
  ): Promise<MentionResult> {
    // 1. Idempotency check
    if (isEventProcessed(event, processedEvents)) {
      return {
        success: false,
        mode: "TEXT",
        reply_text: "",
        error: "Event already processed",
      };
    }

    // 2. Parse command
    const parsed = parseMention(event.text);

    // 3. Safety handling
    const safety = assessSafety(event.text);

    if (safety.is_unsafe) {
      const refusal = this.pickPlayfulRefusal(event.tweet_id);
      assertPublicSafe(refusal, { route: "/safety" });
      return {
        success: true,
        mode: "TEXT",
        reply_text: refusal,
      };
    }

    if (safety.is_aggressive) {
      const rhyme = this.pickDeEscalationRhyme(event.tweet_id);
      assertPublicSafe(rhyme, { route: "/safety" });
      return {
        success: true,
        mode: "TEXT",
        reply_text: rhyme,
      };
    }

    // 4. Route handling

    // /badge me
    if (parsed.command === "badge") {
      const badgeText = generateBadgeText(`${event.tweet_id}:${event.user_id}`);
      assertPublicSafe(badgeText, { route: "/badge" });
      return {
        success: true,
        mode: "TEXT",
        reply_text: badgeText,
      };
    }

    // 5. Reward gating for IMAGE mode
    const rewardEligible = profile.reward_pending;
    const cooldownOk = isCooldownOk(profile, this.config.cooldownMinutes);
    const useImageMode = rewardEligible && cooldownOk && !safety.is_aggressive;

    if (useImageMode) {
      // Determine preset
      let presetKey = parsed.args.preset;
      if (!presetKey) {
        presetKey = "gorky_roast_card"; // default reward image
      }

      // Resolve
      const resolved = this.resolver.resolve(
        presetKey,
        undefined,
        event.tweet_id
      );

      if (!resolved) {
        // Fallback to text mode if resolution fails
        return this.generateTextReply(event, "roast", "authority");
      }

      // Generate caption
      const caption = pickCaption(this.datasets, event.tweet_id, {
        userHandle: event.user_handle,
        tone: "mocking",
      });
      assertPublicSafe(caption, { route: "/img" });

      // Pick template texts
      const templateTexts = pickTemplateTexts(resolved.template, event.tweet_id);

      // Note: Actual image rendering would happen here via renderMemeSharp
      // For now, we return the configuration for the renderer
      return {
        success: true,
        mode: "IMAGE",
        reply_text: caption,
        // In production, media_buffer would be populated by rendering
      };
    }

    // 6. TEXT mode (default) — use humor mode for future LLM/composer integration
    const humorMode = selectHumorMode(3, false, "chaos");
    return this.generateTextReply(event, "roast", humorMode);
  }

  private generateTextReply(
    event: MentionEvent,
    style: "roast" | "neutral",
    humorMode: HumorMode = "authority"
  ): MentionResult {
    let text: string;

    if (style === "roast") {
      // Use dataset roast replies or generate
      text = pickCaption(this.datasets, event.tweet_id, {
        userHandle: event.user_handle,
        tone: "mocking",
      });
    } else {
      text = "Processing your request... (neutral mode not fully implemented)";
    }

    assertPublicSafe(text, { route: "/reply" });

    return {
      success: true,
      mode: "TEXT",
      reply_text: text,
    };
  }

  private pickDeEscalationRhyme(seedKey: string): string {
    const rng = createSeededRNG(seedKey);
    const index = Math.floor(rng() * DE_ESCALATION_RHYMES.length);
    return DE_ESCALATION_RHYMES[index] ?? DE_ESCALATION_RHYMES[0]!;
  }

  private pickPlayfulRefusal(seedKey: string): string {
    const rng = createSeededRNG(seedKey);
    const index = Math.floor(rng() * PLAYFUL_REFUSALS.length);
    return PLAYFUL_REFUSALS[index] ?? PLAYFUL_REFUSALS[0]!;
  }
}

export function createMentionWorkflow(config: WorkflowConfig): MentionWorkflow {
  return new MentionWorkflow(config);
}
