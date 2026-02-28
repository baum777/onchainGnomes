/**
 * Reward Engine
 *
 * Handles XP accrual, reward evaluation, and reward consumption.
 * Enforces: scoring ALWAYS runs, rewards evaluated after scoring,
 * idempotency, cooldowns, and safety gating.
 */

import { SafetyAssessment } from "../workflows/mentionWorkflow.js";

// Reward types
export type RewardType = "ROAST_IMAGE" | "TEXT_ROAST" | "BADGE";

export interface Reward {
  type: RewardType;
  userId: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

// Quality signals for scoring
export interface QualitySignals {
  mentionLength: number;
  hasQuestion: boolean;
  emojiCount: number;
  isFollowUp: boolean;
  commandUsed: boolean;
  engagementDepth: number; // 1-5
}

// User profile extensions for reward engine
export interface RewardUserProfile {
  user_id: string;
  xp: number;
  level: number;
  reward_pending: boolean;
  pending_reward_type?: RewardType;
  last_image_reward_at?: string;
  last_reward_at?: string;
  reply_count_24h: number;
  global_image_count_24h: number; // For global spam prevention
}

// Event context for reward consumption
export interface RewardEventContext {
  eventId: string;
  command?: string | null;
  safety: SafetyAssessment;
}

// State repository interface (implemented by persistence layer)
export interface RewardStateRepo {
  getUserProfile(userId: string): Promise<RewardUserProfile | null>;
  saveUserProfile(profile: RewardUserProfile): Promise<void>;
  isEventProcessed(eventId: string): Promise<boolean>;
  markEventProcessed(eventId: string, userId: string): Promise<void>;
  getGlobalImageCount24h(): Promise<number>;
  incrementGlobalImageCount(): Promise<void>;
}

// Engine configuration
export interface RewardEngineConfig {
  cooldownHours: number;
  globalImageCap24h: number;
  xpThresholds: number[]; // XP needed for each level
  baseXpPerMention: number;
}

const DEFAULT_CONFIG: RewardEngineConfig = {
  cooldownHours: 24,
  globalImageCap24h: 100,
  xpThresholds: [0, 100, 250, 500, 1000, 2000], // Level 0-5
  baseXpPerMention: 10,
};

export class RewardEngine {
  private config: RewardEngineConfig;
  private repo: RewardStateRepo;

  constructor(repo: RewardStateRepo, config?: Partial<RewardEngineConfig>) {
    this.repo = repo;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * ALWAYS called on every eligible mention event.
   * Accrues XP based on quality signals.
   * Does NOT check for safety blocks - caller should handle that.
   */
  async accrueXp(
    userId: string,
    eventType: "mention" | "remix" | "command",
    qualitySignals: QualitySignals
  ): Promise<{ xpGained: number; newTotal: number; levelChanged: boolean }> {
    const profile = await this.getOrCreateProfile(userId);

    // Calculate XP gain based on quality signals
    let xpGain = this.calculateXpGain(eventType, qualitySignals);

    // Apply multiplier for command usage
    if (qualitySignals.commandUsed) {
      xpGain = Math.floor(xpGain * 1.5);
    }

    const oldLevel = profile.level;
    profile.xp += xpGain;
    profile.reply_count_24h += 1;

    // Recalculate level
    profile.level = this.calculateLevel(profile.xp);
    const levelChanged = profile.level !== oldLevel;

    await this.repo.saveUserProfile(profile);

    return {
      xpGained: xpGain,
      newTotal: profile.xp,
      levelChanged,
    };
  }

  /**
   * Evaluates if user should get a pending reward.
   * Called AFTER accrueXp on every eligible mention.
   * Sets reward_pending flag if eligible (but doesn't consume yet).
   */
  async evaluateRewards(userId: string): Promise<{ rewardPending: boolean; type?: RewardType }> {
    const profile = await this.getOrCreateProfile(userId);

    // Check if already has pending reward
    if (profile.reward_pending) {
      return { rewardPending: true, type: profile.pending_reward_type };
    }

    // Check cooldown
    if (!this.isCooldownOk(profile)) {
      return { rewardPending: false };
    }

    // Check level-based eligibility
    const rewardType = this.determineRewardType(profile);

    if (rewardType) {
      profile.reward_pending = true;
      profile.pending_reward_type = rewardType;
      await this.repo.saveUserProfile(profile);
      return { rewardPending: true, type: rewardType };
    }

    return { rewardPending: false };
  }

  /**
   * Consumes a pending reward if all conditions are met.
   * This is the GATE: checks cooldown, safety, global caps.
   * Returns null if no reward or conditions not met.
   * Atomically clears pending reward if consumed.
   */
  async consumeRewardIfEligible(
    userId: string,
    ctx: RewardEventContext
  ): Promise<Reward | null> {
    const profile = await this.getOrCreateProfile(userId);

    // No pending reward
    if (!profile.reward_pending) {
      return null;
    }

    // Safety gate: don't reward if unsafe
    if (ctx.safety.is_unsafe) {
      return null;
    }

    // Safety gate: don't reward if blocked or flagged risky
    if (ctx.safety.flags.includes("risky")) {
      return null;
    }

    // Cooldown check
    if (!this.isCooldownOk(profile)) {
      return null;
    }

    // Global image spam prevention
    if (profile.pending_reward_type === "ROAST_IMAGE") {
      const globalCount = await this.repo.getGlobalImageCount24h();
      if (globalCount >= this.config.globalImageCap24h) {
        return null;
      }
    }

    // Idempotency: check event not already processed
    if (await this.repo.isEventProcessed(ctx.eventId)) {
      return null;
    }

    // All checks passed - consume the reward
    const reward: Reward = {
      type: profile.pending_reward_type ?? "TEXT_ROAST",
      userId,
      createdAt: new Date().toISOString(),
      metadata: {
        eventId: ctx.eventId,
        level: profile.level,
      },
    };

    // Clear pending and update timestamps
    profile.reward_pending = false;
    profile.pending_reward_type = undefined;
    profile.last_reward_at = new Date().toISOString();

    if (reward.type === "ROAST_IMAGE") {
      profile.last_image_reward_at = new Date().toISOString();
      await this.repo.incrementGlobalImageCount();
    }

    await this.repo.saveUserProfile(profile);
    await this.repo.markEventProcessed(ctx.eventId, userId);

    return reward;
  }

  /**
   * Get or create a new user profile.
   */
  private async getOrCreateProfile(userId: string): Promise<RewardUserProfile> {
    const existing = await this.repo.getUserProfile(userId);
    if (existing) {
      return existing;
    }

    return {
      user_id: userId,
      xp: 0,
      level: 0,
      reward_pending: false,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    };
  }

  /**
   * Calculate XP gain based on event type and quality signals.
   */
  private calculateXpGain(
    eventType: "mention" | "remix" | "command",
    signals: QualitySignals
  ): number {
    let base = this.config.baseXpPerMention;

    // Event type multipliers
    if (eventType === "remix") base *= 2;
    if (eventType === "command") base *= 1.5;

    // Quality bonuses
    if (signals.hasQuestion) base += 5;
    if (signals.mentionLength > 50) base += 5;
    if (signals.engagementDepth >= 4) base += 10;

    // Emoji penalty (anti-spam)
    if (signals.emojiCount > 5) {
      base = Math.floor(base * 0.5);
    }

    return Math.max(1, base);
  }

  /**
   * Calculate user level based on XP.
   */
  private calculateLevel(xp: number): number {
    let level = 0;
    for (let i = 0; i < this.config.xpThresholds.length; i++) {
      if (xp >= this.config.xpThresholds[i]!) {
        level = i;
      }
    }
    return Math.min(5, level);
  }

  /**
   * Check if cooldown period has passed.
   */
  private isCooldownOk(profile: RewardUserProfile): boolean {
    if (!profile.last_reward_at) {
      return true;
    }

    const last = new Date(profile.last_reward_at).getTime();
    const now = Date.now();
    const cooldownMs = this.config.cooldownHours * 60 * 60 * 1000;

    return now - last >= cooldownMs;
  }

  /**
   * Determine reward type based on user level and randomness.
   */
  private determineRewardType(profile: RewardUserProfile): RewardType | null {
    // Level 0-1: No rewards yet
    if (profile.level < 2) {
      return null;
    }

    // Level 2+: Text roast rewards
    if (profile.level === 2) {
      return "TEXT_ROAST";
    }

    // Level 3+: Chance for image roast
    if (profile.level >= 3) {
      // Higher levels get more image rewards
      const imageChance = 0.3 + (profile.level - 3) * 0.15;
      if (Math.random() < imageChance) {
        return "ROAST_IMAGE";
      }
      return "TEXT_ROAST";
    }

    return null;
  }
}

// Factory function
export function createRewardEngine(
  repo: RewardStateRepo,
  config?: Partial<RewardEngineConfig>
): RewardEngine {
  return new RewardEngine(repo, config);
}
