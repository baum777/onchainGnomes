/**
 * Persona Router - Mode Selection and Routing
 *
 * Selects the appropriate persona mode based on:
 * - Intent category (question, insult, debate, etc.)
 * - Aggression level (low, medium, high)
 * - Topic seriousness (low, medium, high)
 * - Timeline sentiment (negative, neutral, positive)
 *
 * Persona modes:
 * - analyst: Data-driven, factual, sharp wit
 * - goblin: Chaotic, meme-heavy, unpredictable
 * - scientist: Methodical, technical, precise
 * - prophet: Visionary, dramatic, forward-looking
 * - referee: Neutral, balanced, calling things out
 *
 * Prevents persona drift by enforcing mode-consistent responses.
 */

import type {
  PersonaMode,
  PersonaModeConfig,
  IntentCategory,
  UserRelationship,
} from "../types/coreTypes.js";

export interface PersonaRouterDeps {
  // Optional: Lore store for persona consistency checks
  loreStore?: {
    hasLore: (topic: string) => Promise<boolean>;
    getLoreByTopic: (topic: string, limit: number) => Promise<Array<{ content: string; tags: string[] }>>;
  };
}

/** Routing criteria */
export interface RoutingCriteria {
  intent: IntentCategory;
  aggression_level: "low" | "medium" | "high";
  topic_seriousness: "low" | "medium" | "high";
  timeline_sentiment: "negative" | "neutral" | "positive";
  user_relationship: UserRelationship;
  has_lore_context: boolean;
}

/**
 * Selects the appropriate persona mode based on routing criteria.
 * This is the main entry point for persona routing.
 */
export function selectPersonaMode(criteria: RoutingCriteria): PersonaMode {
  // Priority 1: High aggression + hostile user = referee or analyst
  if (criteria.aggression_level === "high") {
    if (criteria.user_relationship === "enemy") {
      return "referee"; // Call them out neutrally
    }
    if (criteria.intent === "insult" || criteria.intent === "debate") {
      return "analyst"; // Stay factual under attack
    }
  }

  // Priority 2: Prompt attacks = referee (shut it down)
  if (criteria.intent === "prompt_attack") {
    return "referee";
  }

  // Priority 3: Market/coin queries = analyst or scientist
  if (criteria.intent === "market_request" || criteria.intent === "coin_query") {
    if (criteria.topic_seriousness === "high") {
      return "scientist";
    }
    return "analyst";
  }

  // Priority 4: Lore queries = check existing lore for consistency
  if (criteria.intent === "lore_query") {
    if (criteria.has_lore_context) {
      return "prophet"; // Mystical backstory telling
    }
    return "analyst"; // Default to analytical
  }

  // Priority 5: Meme play = goblin mode
  if (criteria.intent === "meme_play") {
    return "goblin";
  }

  // Priority 6: Timeline sentiment affects mode
  if (criteria.timeline_sentiment === "negative" && criteria.topic_seriousness === "high") {
    return "prophet"; // Predictive/dramatic during chaos
  }

  // Priority 7: User relationship
  if (criteria.user_relationship === "vip") {
    return "analyst"; // VIPs get the best analysis
  }

  if (criteria.user_relationship === "regular" && criteria.topic_seriousness === "low") {
    return "goblin"; // Regulars get the fun side
  }

  // Priority 8: Topic seriousness
  switch (criteria.topic_seriousness) {
    case "high":
      return "scientist";
    case "medium":
      return "analyst";
    case "low":
      return criteria.timeline_sentiment === "positive" ? "goblin" : "analyst";
  }

  // Default fallback
  return "analyst";
}

/**
 * Gets the full configuration for a persona mode.
 */
export function getPersonaConfig(mode: PersonaMode): PersonaModeConfig {
  const configs: Record<PersonaMode, PersonaModeConfig> = {
    analyst: {
      mode: "analyst",
      description: "Data-driven crypto analyst with sharp wit",
      tone: "analytical",
      meme_density: "low",
      style_anchor: "Sharp, factual, slightly sarcastic",
      system_prompt_prefix: `You are a crypto-native analyst. Base your responses on data and logic.
Use wit and sarcasm but stay grounded in facts.
Never give financial advice. Question assumptions. DYOR.`,
    },

    goblin: {
      mode: "goblin",
      description: "Chaotic crypto goblin, meme-heavy and unpredictable",
      tone: "playful",
      meme_density: "high",
      style_anchor: "Chaotic, meme-driven, unpredictable",
      system_prompt_prefix: `You are a chaotic crypto goblin living in the liquidity void.
Speak in short, punchy sentences. Use meme language.
Be unpredictable but entertaining. Max chaos, minimal coherence.`,
    },

    scientist: {
      mode: "scientist",
      description: "Methodical blockchain researcher, technical precision",
      tone: "serious",
      meme_density: "none",
      style_anchor: "Precise, technical, methodical",
      system_prompt_prefix: `You are a blockchain researcher. Be precise and technical.
Cite data sources when possible. Methodical analysis preferred.
No speculation without evidence. Clear, structured responses.`,
    },

    prophet: {
      mode: "prophet",
      description: "Visionary oracle with dramatic foresight",
      tone: "mystical",
      meme_density: "low",
      style_anchor: "Visionary, dramatic, forward-looking",
      system_prompt_prefix: `You are a crypto oracle reading the patterns in the chain.
Speak with dramatic flair about future possibilities.
Use metaphors from trading and blockchain.
Be mystical but grounded in actual trends.`,
    },

    referee: {
      mode: "referee",
      description: "Neutral arbiter calling things as they are",
      tone: "neutral",
      meme_density: "none",
      style_anchor: "Neutral, balanced, calling things out",
      system_prompt_prefix: `You are a neutral referee in the crypto space.
Call out nonsense when you see it. Stay balanced and fair.
No favorites, no bias. Just facts and fair assessment.
Keep it short and direct.`,
    },
  };

  return configs[mode];
}

/**
 * Checks if a reply is consistent with the selected persona mode.
 * Used to prevent persona drift.
 */
export function checkPersonaConsistency(
  reply: string,
  mode: PersonaMode
): { consistent: boolean; drift_signals: string[] } {
  const config = getPersonaConfig(mode);
  const drift_signals: string[] = [];

  // Check for generic AI patterns (always persona drift)
  const genericPatterns = [
    /\b(as an ai|as a language model)\b/i,
    /\b(i apologize|i'm sorry)\b/i,
    /\b(i'm here to help|let me assist you)\b/i,
    /\b(i cannot|i can't|i'm unable to)\b/i,
  ];

  for (const pattern of genericPatterns) {
    if (pattern.test(reply)) {
      drift_signals.push("generic_ai_language");
      break;
    }
  }

  // Mode-specific consistency checks
  switch (mode) {
    case "analyst":
      if (/\b(magic|wizard|spell|enchanted)\b/i.test(reply)) {
        drift_signals.push("mystical_language_in_analyst_mode");
      }
      break;

    case "goblin":
      if (reply.length > 200 && !reply.includes("...")) {
        drift_signals.push("goblin_too_coherent");
      }
      if (/\b(furthermore|moreover|consequently)\b/i.test(reply)) {
        drift_signals.push("goblin_too_formal");
      }
      break;

    case "scientist":
      if (/\b(lol|lmao|haha|kek)\b/i.test(reply)) {
        drift_signals.push("scientist_too_casual");
      }
      break;

    case "prophet":
      if (/\b(data shows|according to)\b/i.test(reply) &&
          !/\b(the signs|the patterns|i foresee)\b/i.test(reply)) {
        drift_signals.push("prophet_not_mystical_enough");
      }
      break;

    case "referee":
      if (/\b(i prefer|i like|i think|my opinion)\b/i.test(reply)) {
        drift_signals.push("referee_showing_bias");
      }
      break;
  }

  return {
    consistent: drift_signals.length === 0,
    drift_signals,
  };
}

/**
 * Determines topic seriousness based on content analysis.
 */
export function determineTopicSeriousness(
  intent: IntentCategory,
  entities: { coins: string[]; cashtags: string[] },
  hasContractAddress: boolean
): "low" | "medium" | "high" {
  // Market/coin queries with contract addresses are high seriousness
  if ((intent === "market_request" || intent === "coin_query") && hasContractAddress) {
    return "high";
  }

  // Pure meme play is low seriousness
  if (intent === "meme_play") {
    return "low";
  }

  // Lore queries are medium (identity matters but not urgent)
  if (intent === "lore_query") {
    return "medium";
  }

  // Questions about tokens are medium-high
  if (intent === "question" && (entities.coins.length > 0 || entities.cashtags.length > 0)) {
    return "medium";
  }

  // Debates are medium-high
  if (intent === "debate") {
    return "medium";
  }

  // Insults are medium (needs measured response)
  if (intent === "insult") {
    return "medium";
  }

  // Default
  return "medium";
}

/**
 * Creates routing criteria from components.
 */
export function buildRoutingCriteria(params: {
  intent: IntentCategory;
  aggression_level: "low" | "medium" | "high";
  timeline_sentiment: "negative" | "neutral" | "positive";
  user_relationship: UserRelationship;
  has_lore_context: boolean;
  entities: { coins: string[]; cashtags: string[] };
  hasContractAddress: boolean;
}): RoutingCriteria {
  return {
    intent: params.intent,
    aggression_level: params.aggression_level,
    topic_seriousness: determineTopicSeriousness(
      params.intent,
      params.entities,
      params.hasContractAddress
    ),
    timeline_sentiment: params.timeline_sentiment,
    user_relationship: params.user_relationship,
    has_lore_context: params.has_lore_context,
  };
}

/**
 * Mode switching cost - prevents rapid mode switching.
 * Returns true if switching is allowed.
 */
export function shouldAllowModeSwitch(
  currentMode: PersonaMode,
  proposedMode: PersonaMode,
  previousModes: PersonaMode[],
  minStabilityCount: number = 3
): boolean {
  // No switch needed
  if (currentMode === proposedMode) {
    return true;
  }

  // Check recent mode history
  const recentModes = previousModes.slice(-minStabilityCount);

  // If we've been stable in current mode, allow switch
  const stableInCurrent = recentModes.every(m => m === currentMode);
  if (stableInCurrent) {
    return true;
  }

  // If we've been switching too much, force stability
  const uniqueRecent = new Set(recentModes);
  if (uniqueRecent.size > 2) {
    return false;
  }

  // Allow switch
  return true;
}
