/**
 * Bot Activation Config tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  readActivationConfigFromEnv,
  type ActivationConfig,
} from "../../src/config/botActivationConfig.js";

describe("botActivationConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.BOT_ACTIVATION_MODE;
    delete process.env.BOT_WHITELIST_USERNAMES;
    delete process.env.BOT_WHITELIST_USER_IDS;
    delete process.env.BOT_DENY_REPLY_MODE;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("default mode is global", () => {
    const config = readActivationConfigFromEnv();
    expect(config.mode).toBe("global");
  });

  it("whitelist mode when env set", () => {
    process.env.BOT_ACTIVATION_MODE = "whitelist";
    const config = readActivationConfigFromEnv();
    expect(config.mode).toBe("whitelist");
  });

  it("default whitelist is empty when BOT_WHITELIST_USERNAMES is not set", () => {
    const config = readActivationConfigFromEnv();
    expect(config.whitelistUsernames).toEqual([]);
  });

  it("normalizes usernames: lowercase, @ prefix", () => {
    process.env.BOT_WHITELIST_USERNAMES = "  TwimSalot , Nirapump_  ";
    const config = readActivationConfigFromEnv();
    expect(config.whitelistUsernames).toContain("@twimsalot");
    expect(config.whitelistUsernames).toContain("@nirapump_");
  });

  it("parses BOT_WHITELIST_USER_IDS", () => {
    process.env.BOT_WHITELIST_USER_IDS = "id1, id2 , id3";
    const config = readActivationConfigFromEnv();
    expect(config.whitelistUserIds).toEqual(["id1", "id2", "id3"]);
  });

  it("default denyReplyMode is silent", () => {
    const config = readActivationConfigFromEnv();
    expect(config.denyReplyMode).toBe("silent");
  });

  it("denyReplyMode tease when env set", () => {
    process.env.BOT_DENY_REPLY_MODE = "tease";
    const config = readActivationConfigFromEnv();
    expect(config.denyReplyMode).toBe("tease");
  });

  it("denyReplyMode silent for invalid values", () => {
    process.env.BOT_DENY_REPLY_MODE = "invalid";
    const config = readActivationConfigFromEnv();
    expect(config.denyReplyMode).toBe("silent");
  });

  it("full config includes all properties", () => {
    process.env.BOT_ACTIVATION_MODE = "whitelist";
    process.env.BOT_WHITELIST_USERNAMES = "@alice,@bob";
    process.env.BOT_WHITELIST_USER_IDS = "id1,id2";
    process.env.BOT_DENY_REPLY_MODE = "tease";

    const config = readActivationConfigFromEnv();

    expect(config).toEqual({
      mode: "whitelist",
      whitelistUsernames: ["@alice", "@bob"],
      whitelistUserIds: ["id1", "id2"],
      denyReplyMode: "tease",
    });
  });
});
