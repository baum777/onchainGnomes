/**
 * Bot Activation Config
 *
 * Reads activation mode and whitelist from env.
 * BOT_ACTIVATION_MODE: "global" | "whitelist"
 * BOT_WHITELIST_USERNAMES: "@twimsalot,@nirapump_"
 * BOT_WHITELIST_USER_IDS: optional cache
 */

export type ActivationMode = "global" | "whitelist";

export type ActivationConfig = {
  mode: ActivationMode;
  whitelistUsernames: string[];
  whitelistUserIds: string[];
};

const DEFAULT_WHITELIST = "@twimsalot,@nirapump_";

function normalizeUsername(raw: string): string {
  let u = raw.trim().toLowerCase();
  if (u && !u.startsWith("@")) {
    u = `@${u}`;
  }
  return u;
}

function parseUsernames(value: string): string[] {
  if (!value || !value.trim()) {
    return DEFAULT_WHITELIST.split(",").map(normalizeUsername).filter(Boolean);
  }
  return value
    .split(",")
    .map((s) => normalizeUsername(s))
    .filter((s) => s.length > 0);
}

function parseUserIds(value: string): string[] {
  if (!value || !value.trim()) {
    return [];
  }
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Read activation config from environment.
 * Normalizes: trim, lowercase usernames, ensure @ prefix.
 */
export function readActivationConfigFromEnv(): ActivationConfig {
  const modeRaw = (process.env.BOT_ACTIVATION_MODE ?? "global").trim().toLowerCase();
  const mode: ActivationMode =
    modeRaw === "whitelist" ? "whitelist" : "global";

  const whitelistUsernames = parseUsernames(
    process.env.BOT_WHITELIST_USERNAMES ?? DEFAULT_WHITELIST
  );

  const whitelistUserIds = parseUserIds(
    process.env.BOT_WHITELIST_USER_IDS ?? ""
  );

  return {
    mode,
    whitelistUsernames,
    whitelistUserIds,
  };
}
