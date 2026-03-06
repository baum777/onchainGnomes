/**
 * User Graph - User Interaction Tracking
 *
 * Tracks relationships with users and their interaction history.
 * Used for personalized responses and relationship management.
 *
 * Relationship types:
 * - new: First-time interaction
 * - regular: Ongoing positive interactions
 * - enemy: Hostile interactions
 * - vip: Special/high-value users
 *
 * Tracks sentiment history and topics discussed.
 */

import type { UserProfile, UserInteraction, UserRelationship, SentimentLabel } from "../types/coreTypes.js";
import { stableHash } from "../utils/hash.js";

export interface UserGraphDeps {
  storage?: UserStorage;
}

/** Storage interface for user data persistence */
export interface UserStorage {
  loadProfiles(): Promise<UserProfile[]>;
  saveProfiles(profiles: UserProfile[]): Promise<void>;
  loadInteractions(): Promise<UserInteraction[]>;
  saveInteractions(interactions: UserInteraction[]): Promise<void>;
  appendInteraction(interaction: UserInteraction): Promise<void>;
}

/** In-memory storage implementation */
export class InMemoryUserStorage implements UserStorage {
  private profiles: UserProfile[] = [];
  private interactions: UserInteraction[] = [];

  async loadProfiles(): Promise<UserProfile[]> {
    return [...this.profiles];
  }

  async saveProfiles(profiles: UserProfile[]): Promise<void> {
    this.profiles = [...profiles];
  }

  async loadInteractions(): Promise<UserInteraction[]> {
    return [...this.interactions];
  }

  async saveInteractions(interactions: UserInteraction[]): Promise<void> {
    this.interactions = [...interactions];
  }

  async appendInteraction(interaction: UserInteraction): Promise<void> {
    this.interactions.push(interaction);
  }
}

/** User graph implementation */
export class UserGraph {
  private profiles: Map<string, UserProfile> = new Map(); // key: user_id
  private interactions: Map<string, UserInteraction[]> = new Map(); // key: user_id
  private storage?: UserStorage;
  private initialized = false;

  constructor(deps: UserGraphDeps = {}) {
    this.storage = deps.storage;
  }

  /**
   * Initializes the graph by loading persisted data.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.storage) {
      const loadedProfiles = await this.storage.loadProfiles();
      for (const profile of loadedProfiles) {
        this.profiles.set(profile.user_id, profile);
      }

      const loadedInteractions = await this.storage.loadInteractions();
      for (const interaction of loadedInteractions) {
        const list = this.interactions.get(interaction.user_handle) || [];
        list.push(interaction);
        this.interactions.set(interaction.user_handle, list);
      }
    }

    this.initialized = true;
  }

  /**
   * Gets or creates a user profile.
   */
  async getOrCreateProfile(
    userId: string,
    handle: string,
    opts?: { initialRelationship?: UserRelationship }
  ): Promise<UserProfile> {
    await this.initialize();

    let profile = this.profiles.get(userId);

    if (!profile) {
      const now = new Date().toISOString();
      profile = {
        user_id: userId,
        handle,
        relationship: opts?.initialRelationship || "new",
        first_seen: now,
        last_interaction: now,
        interaction_count: 0,
        sentiment_history: [],
        topics_discussed: [],
      };
      this.profiles.set(userId, profile);
    }

    return profile;
  }

  /**
   * Gets a user profile by ID.
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
    await this.initialize();
    return this.profiles.get(userId) || null;
  }

  /**
   * Gets a user profile by handle.
   */
  async getProfileByHandle(handle: string): Promise<UserProfile | null> {
    await this.initialize();

    for (const profile of this.profiles.values()) {
      if (profile.handle.toLowerCase() === handle.toLowerCase()) {
        return profile;
      }
    }

    return null;
  }

  /**
   * Updates a user profile.
   */
  async updateProfile(
    userId: string,
    updates: Partial<Omit<UserProfile, "user_id" | "first_seen">>
  ): Promise<UserProfile | null> {
    await this.initialize();

    const existing = this.profiles.get(userId);
    if (!existing) return null;

    const updated: UserProfile = {
      ...existing,
      ...updates,
    };

    this.profiles.set(userId, updated);

    if (this.storage) {
      await this.storage.saveProfiles(Array.from(this.profiles.values()));
    }

    return updated;
  }

  /**
   * Records a new interaction with a user.
   * Updates profile statistics and relationship if needed.
   */
  async recordInteraction(
    userId: string,
    handle: string,
    interaction: Omit<UserInteraction, "id" | "timestamp">
  ): Promise<UserInteraction> {
    await this.initialize();

    // Get or create profile
    const profile = await this.getOrCreateProfile(userId, handle);

    // Create interaction record
    const newInteraction: UserInteraction = {
      ...interaction,
      id: generateInteractionId(userId, interaction.tweet_id),
      timestamp: new Date().toISOString(),
    };

    // Update profile
    profile.interaction_count++;
    profile.last_interaction = newInteraction.timestamp;
    profile.sentiment_history.push(interaction.sentiment);
    if (interaction.topic && !profile.topics_discussed.includes(interaction.topic)) {
      profile.topics_discussed.push(interaction.topic);
    }

    // Update relationship based on interaction patterns
    profile.relationship = determineRelationship(profile);

    // Store interaction
    const list = this.interactions.get(handle) || [];
    list.push(newInteraction);
    this.interactions.set(handle, list);

    // Persist
    if (this.storage) {
      await this.storage.appendInteraction(newInteraction);
      await this.storage.saveProfiles(Array.from(this.profiles.values()));
    }

    return newInteraction;
  }

  /**
   * Gets interaction history for a user.
   */
  async getInteractionHistory(
    handle: string,
    limit: number = 10
  ): Promise<UserInteraction[]> {
    await this.initialize();

    const list = this.interactions.get(handle) || [];
    return list
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Gets all users with a specific relationship type.
   */
  async getUsersByRelationship(
    relationship: UserRelationship
  ): Promise<UserProfile[]> {
    await this.initialize();

    return Array.from(this.profiles.values())
      .filter(p => p.relationship === relationship);
  }

  /**
   * Gets recent interactions across all users.
   */
  async getRecentInteractions(limit: number = 20): Promise<UserInteraction[]> {
    await this.initialize();

    const allInteractions: UserInteraction[] = [];
    for (const list of this.interactions.values()) {
      allInteractions.push(...list);
    }

    return allInteractions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Calculates average sentiment for a user.
   */
  async getUserSentiment(userId: string): Promise<SentimentLabel | null> {
    await this.initialize();

    const profile = this.profiles.get(userId);
    if (!profile || profile.sentiment_history.length === 0) {
      return null;
    }

    // Count occurrences
    const counts: Record<SentimentLabel, number> = {
      friendly: 0,
      neutral: 0,
      hostile: 0,
      playful: 0,
      suspicious: 0,
    };

    for (const sentiment of profile.sentiment_history) {
      counts[sentiment]++;
    }

    // Find most common
    let maxCount = 0;
    let dominant: SentimentLabel = "neutral";

    for (const [sentiment, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        dominant = sentiment as SentimentLabel;
      }
    }

    return dominant;
  }

  /**
   * Checks if a user is blocked/enemy.
   */
  async isUserBlocked(userId: string): Promise<boolean> {
    await this.initialize();

    const profile = this.profiles.get(userId);
    return profile?.relationship === "enemy";
  }

  /**
   * Gets all user profiles.
   */
  async getAllProfiles(): Promise<UserProfile[]> {
    await this.initialize();
    return Array.from(this.profiles.values());
  }

  /**
   * Gets interaction statistics.
   */
  async getStats(): Promise<{
    totalUsers: number;
    totalInteractions: number;
    relationshipBreakdown: Record<UserRelationship, number>;
  }> {
    await this.initialize();

    const breakdown: Record<UserRelationship, number> = {
      new: 0,
      regular: 0,
      enemy: 0,
      vip: 0,
      dev: 0,
    };

    for (const profile of this.profiles.values()) {
      breakdown[profile.relationship]++;
    }

    let totalInteractions = 0;
    for (const list of this.interactions.values()) {
      totalInteractions += list.length;
    }

    return {
      totalUsers: this.profiles.size,
      totalInteractions,
      relationshipBreakdown: breakdown,
    };
  }

  /**
   * Persists current state to storage.
   */
  async persist(): Promise<void> {
    if (this.storage) {
      await this.storage.saveProfiles(Array.from(this.profiles.values()));

      const allInteractions: UserInteraction[] = [];
      for (const list of this.interactions.values()) {
        allInteractions.push(...list);
      }
      await this.storage.saveInteractions(allInteractions);
    }
  }

  /**
   * Clears all data (mainly for testing).
   */
  async clear(): Promise<void> {
    this.profiles.clear();
    this.interactions.clear();
    if (this.storage) {
      await this.storage.saveProfiles([]);
      await this.storage.saveInteractions([]);
    }
  }
}

/**
 * Creates a new user graph instance.
 */
export function createUserGraph(deps: UserGraphDeps = {}): UserGraph {
  return new UserGraph(deps);
}

// =============================================================================
// Internal Helper Functions
// =============================================================================

/**
 * Generates a stable ID for an interaction.
 */
function generateInteractionId(userId: string, tweetId: string): string {
  const seed = `${userId}:${tweetId}:${Date.now()}`;
  return `int_${stableHash(seed).slice(0, 16)}`;
}

/**
 * Determines relationship type based on interaction patterns.
 */
function determineRelationship(profile: UserProfile): UserRelationship {
  // Keep existing VIP status
  if (profile.relationship === "vip") {
    return "vip";
  }

  // Check for hostile pattern
  const recentSentiments = profile.sentiment_history.slice(-5);
  const hostileCount = recentSentiments.filter(s => s === "hostile").length;
  if (hostileCount >= 3) {
    return "enemy";
  }

  // Check for regular status (5+ positive interactions)
  if (profile.interaction_count >= 5) {
    const positiveCount = profile.sentiment_history.filter(
      s => s === "friendly" || s === "playful"
    ).length;
    if (positiveCount >= profile.sentiment_history.length * 0.6) {
      return "regular";
    }
  }

  // Keep new status until thresholds met
  if (profile.interaction_count < 3) {
    return "new";
  }

  // Default to regular after 3+ interactions
  return "regular";
}
