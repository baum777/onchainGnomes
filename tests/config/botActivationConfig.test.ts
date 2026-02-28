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

  it("default whitelist has @twimsalot and @nirapump_", () => {
    const config = readActivationConfigFromEnv();
    expect(config.whitelistUsernames).toContain("@twimsalot");
    expect(config.whitelistUsernames).toContain("@nirapump_");
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
});
