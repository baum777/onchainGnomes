/**
 * Activation Policy
 *
 * Determines whether a mention author is allowed to trigger the bot.
 * No network lookups; relies on event expansions (authorUsername).
 */

import type { ActivationConfig } from "../config/botActivationConfig.js";

export type ActivationDecision = {
  allowed: boolean;
  reason: "allowed" | "not_whitelisted" | "self_mention";
  /** True if author matches whitelist (for privilege bump in global mode) */
  isWhitelisted?: boolean;
};

export type EvaluateActivationOpts = {
  config: ActivationConfig;
  botUserId: string;
  authorId: string;
  authorUsername?: string | null;
};

/**
 * Evaluate whether the author is allowed to trigger the bot.
 */
export async function evaluateActivation(
  opts: EvaluateActivationOpts
): Promise<ActivationDecision> {
  const { config, botUserId, authorId, authorUsername } = opts;

  // 1) Self-mention
  if (authorId === botUserId) {
    return { allowed: false, reason: "self_mention" };
  }

  // 2) Global mode => allowed
  if (config.mode === "global") {
    const isWhitelisted = isAuthorInWhitelist(config, authorId, authorUsername);
    return { allowed: true, reason: "allowed", isWhitelisted };
  }

  // 3) Whitelist mode
  if (isAuthorInWhitelist(config, authorId, authorUsername)) {
    return { allowed: true, reason: "allowed", isWhitelisted: true };
  }

  return { allowed: false, reason: "not_whitelisted" };
}

function isAuthorInWhitelist(
  config: ActivationConfig,
  authorId: string,
  authorUsername?: string | null
): boolean {
  if (config.whitelistUserIds.length > 0 && authorId) {
    if (config.whitelistUserIds.includes(authorId)) {
      return true;
    }
  }

  if (authorUsername && config.whitelistUsernames.length > 0) {
    const norm = authorUsername.trim().toLowerCase();
    const withAt = norm.startsWith("@") ? norm : `@${norm}`;
    return config.whitelistUsernames.some(
      (w) => w === withAt || w === norm
    );
  }

  return false;
}
