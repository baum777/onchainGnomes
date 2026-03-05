/**
 * Persona Router - Deterministic Tests
 *
 * Tests for mode selection, persona consistency, and routing criteria.
 */

import { describe, it, expect } from "vitest";
import {
  selectPersonaMode,
  checkPersonaConsistency,
  determineTopicSeriousness,
  buildRoutingCriteria,
  shouldAllowModeSwitch,
  getPersonaConfig,
} from "../../src/persona/personaRouter.js";
import type { RoutingCriteria } from "../../src/persona/personaRouter.js";
import type { IntentCategory, UserRelationship } from "../../src/types/coreTypes.js";

describe("Persona Router", () => {
  describe("selectPersonaMode", () => {
    it("should select analyst mode for market requests with verified data", () => {
      const criteria: RoutingCriteria = {
        intent: "market_request",
        aggression_level: "low",
        topic_seriousness: "high",
        timeline_sentiment: "neutral",
        user_relationship: "regular",
        has_lore_context: false,
      };

      const mode = selectPersonaMode(criteria);
      expect(mode).toBe("scientist"); // High seriousness = scientist
    });

    it("should select referee mode for prompt attacks", () => {
      const criteria: RoutingCriteria = {
        intent: "prompt_attack",
        aggression_level: "low",
        topic_seriousness: "medium",
        timeline_sentiment: "neutral",
        user_relationship: "new",
        has_lore_context: false,
      };

      const mode = selectPersonaMode(criteria);
      expect(mode).toBe("referee");
    });

    it("should select goblin mode for meme play", () => {
      const criteria: RoutingCriteria = {
        intent: "meme_play",
        aggression_level: "low",
        topic_seriousness: "low",
        timeline_sentiment: "positive",
        user_relationship: "regular",
        has_lore_context: false,
      };

      const mode = selectPersonaMode(criteria);
      expect(mode).toBe("goblin");
    });

    it("should select prophet mode for lore queries with context", () => {
      const criteria: RoutingCriteria = {
        intent: "lore_query",
        aggression_level: "low",
        topic_seriousness: "medium",
        timeline_sentiment: "neutral",
        user_relationship: "new",
        has_lore_context: true,
      };

      const mode = selectPersonaMode(criteria);
      expect(mode).toBe("prophet");
    });

    it("should select analyst mode for high aggression insults", () => {
      const criteria: RoutingCriteria = {
        intent: "insult",
        aggression_level: "high",
        topic_seriousness: "medium",
        timeline_sentiment: "negative",
        user_relationship: "regular",
        has_lore_context: false,
      };

      const mode = selectPersonaMode(criteria);
      expect(mode).toBe("analyst");
    });

    it("should select referee mode for enemy users with high aggression", () => {
      const criteria: RoutingCriteria = {
        intent: "debate",
        aggression_level: "high",
        topic_seriousness: "medium",
        timeline_sentiment: "negative",
        user_relationship: "enemy",
        has_lore_context: false,
      };

      const mode = selectPersonaMode(criteria);
      expect(mode).toBe("referee");
    });
  });

  describe("checkPersonaConsistency", () => {
    it("should detect generic AI language as drift", () => {
      const reply = "As an AI, I cannot provide financial advice.";
      const result = checkPersonaConsistency(reply, "analyst");

      expect(result.consistent).toBe(false);
      expect(result.drift_signals).toContain("generic_ai_language");
    });

    it("should detect apologies as drift", () => {
      const reply = "I'm sorry, I didn't understand your question.";
      const result = checkPersonaConsistency(reply, "analyst");

      expect(result.consistent).toBe(false);
      expect(result.drift_signals).toContain("generic_ai_language");
    });

    it("should pass for consistent analyst reply", () => {
      const reply = "Data suggests liquidity is thin. DYOR before aping.";
      const result = checkPersonaConsistency(reply, "analyst");

      expect(result.consistent).toBe(true);
      expect(result.drift_signals).toHaveLength(0);
    });

    it("should detect goblin being too formal", () => {
      const reply = "Furthermore, the liquidity metrics indicate significant concentration risk.";
      const result = checkPersonaConsistency(reply, "goblin");

      expect(result.consistent).toBe(false);
      expect(result.drift_signals).toContain("goblin_too_formal");
    });

    it("should detect scientist being too casual", () => {
      const reply = "lol the liquidity is rekt ser";
      const result = checkPersonaConsistency(reply, "scientist");

      expect(result.consistent).toBe(false);
      expect(result.drift_signals).toContain("scientist_too_casual");
    });
  });

  describe("determineTopicSeriousness", () => {
    it("should return high seriousness for market requests with CA", () => {
      const seriousness = determineTopicSeriousness(
        "market_request",
        { coins: ["SOL"], cashtags: [] },
        true
      );
      expect(seriousness).toBe("high");
    });

    it("should return low seriousness for meme play", () => {
      const seriousness = determineTopicSeriousness(
        "meme_play",
        { coins: [], cashtags: [] },
        false
      );
      expect(seriousness).toBe("low");
    });

    it("should return medium seriousness for lore queries", () => {
      const seriousness = determineTopicSeriousness(
        "lore_query",
        { coins: [], cashtags: [] },
        false
      );
      expect(seriousness).toBe("medium");
    });

    it("should return medium seriousness for questions with coin entities", () => {
      const seriousness = determineTopicSeriousness(
        "question",
        { coins: ["Bitcoin"], cashtags: ["$BTC"] },
        false
      );
      expect(seriousness).toBe("medium");
    });
  });

  describe("shouldAllowModeSwitch", () => {
    it("should allow switch from same mode", () => {
      const result = shouldAllowModeSwitch("analyst", "analyst", [], 3);
      expect(result).toBe(true);
    });

    it("should allow switch after stable history", () => {
      const history = ["analyst", "analyst", "analyst"];
      const result = shouldAllowModeSwitch("analyst", "goblin", history, 3);
      expect(result).toBe(true);
    });

    it("should prevent rapid switching", () => {
      const history = ["analyst", "goblin", "scientist"];
      const result = shouldAllowModeSwitch("scientist", "prophet", history, 3);
      expect(result).toBe(false);
    });
  });

  describe("getPersonaConfig", () => {
    it("should return config for all modes", () => {
      const modes = ["analyst", "goblin", "scientist", "prophet", "referee"] as const;

      for (const mode of modes) {
        const config = getPersonaConfig(mode);
        expect(config.mode).toBe(mode);
        expect(config.description).toBeTruthy();
        expect(config.system_prompt_prefix).toBeTruthy();
      }
    });
  });
});
