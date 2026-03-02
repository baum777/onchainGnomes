/**
 * Activation Policy tests
 */

import { describe, it, expect } from "vitest";
import {
  evaluateActivation,
  type ActivationDecision,
} from "../../src/policy/activationPolicy.js";
import type { ActivationConfig } from "../../src/config/botActivationConfig.js";

describe("activationPolicy", () => {
  const botUserId = "bot_123";

  it("global mode => allowed", async () => {
    const config: ActivationConfig = {
      mode: "global",
      whitelistUsernames: ["@twimsalot", "@nirapump_"],
      whitelistUserIds: [],
      denyReplyMode: "silent",
    };

    const decision = await evaluateActivation({
      config,
      botUserId,
      authorId: "user_xyz",
      authorUsername: "random_user",
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("allowed");
  });

  it("whitelist mode + username match => allowed", async () => {
    const config: ActivationConfig = {
      mode: "whitelist",
      whitelistUsernames: ["@twimsalot", "@nirapump_"],
      whitelistUserIds: [],
      denyReplyMode: "silent",
    };

    const decision = await evaluateActivation({
      config,
      botUserId,
      authorId: "user_twim",
      authorUsername: "twimsalot",
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("allowed");
    expect(decision.isWhitelisted).toBe(true);
  });

  it("whitelist mode + no match => denied", async () => {
    const config: ActivationConfig = {
      mode: "whitelist",
      whitelistUsernames: ["@twimsalot", "@nirapump_"],
      whitelistUserIds: [],
      denyReplyMode: "silent",
    };

    const decision = await evaluateActivation({
      config,
      botUserId,
      authorId: "user_unknown",
      authorUsername: "random_stranger",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("not_whitelisted");
  });

  it("self mention => denied", async () => {
    const config: ActivationConfig = {
      mode: "global",
      whitelistUsernames: [],
      whitelistUserIds: [],
      denyReplyMode: "silent",
    };

    const decision = await evaluateActivation({
      config,
      botUserId,
      authorId: botUserId,
      authorUsername: "serGorky",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("self_mention");
  });

  it("whitelist mode + user ID match => allowed", async () => {
    const config: ActivationConfig = {
      mode: "whitelist",
      whitelistUsernames: ["@twimsalot"],
      whitelistUserIds: ["uid_nirapump"],
      denyReplyMode: "silent",
    };

    const decision = await evaluateActivation({
      config,
      botUserId,
      authorId: "uid_nirapump",
      authorUsername: undefined,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("allowed");
  });

  it("whitelist mode + missing username and empty user IDs => denied", async () => {
    const config: ActivationConfig = {
      mode: "whitelist",
      whitelistUsernames: ["@twimsalot"],
      whitelistUserIds: [],
      denyReplyMode: "silent",
    };

    const decision = await evaluateActivation({
      config,
      botUserId,
      authorId: "some_id",
      authorUsername: undefined,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("not_whitelisted");
  });
});
