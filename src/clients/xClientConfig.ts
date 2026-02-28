/**
 * XClient Config Utilities
 *
 * Environment variable normalization and validation.
 */

import { XConfig } from "./xClient.js";

export class XConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XConfigError";
  }
}

/**
 * Read and normalize X API config from environment variables.
 * Trims values and validates presence.
 *
 * @throws XConfigError if any required variable is missing
 */
export function readXConfigFromEnv(): XConfig {
  const appKey = (process.env.X_API_KEY || "").trim();
  const appSecret = (process.env.X_API_SECRET || "").trim();
  const accessToken = (process.env.X_ACCESS_TOKEN || "").trim();
  const accessSecret = (process.env.X_ACCESS_SECRET || "").trim();

  const missing: string[] = [];

  if (!appKey) missing.push("X_API_KEY");
  if (!appSecret) missing.push("X_API_SECRET");
  if (!accessToken) missing.push("X_ACCESS_TOKEN");
  if (!accessSecret) missing.push("X_ACCESS_SECRET");

  if (missing.length > 0) {
    throw new XConfigError(
      `Missing X API credentials: ${missing.join(", ")}. ` +
      "Please set all required environment variables."
    );
  }

  // Detect placeholder values (common mistake)
  const placeholderPatterns = [/your_/i, /example/i, /placeholder/i, /xxx/i, /change_me/i];
  const placeholderVars: string[] = [];

  [
    { name: "X_API_KEY", value: appKey },
    { name: "X_API_SECRET", value: appSecret },
    { name: "X_ACCESS_TOKEN", value: accessToken },
    { name: "X_ACCESS_SECRET", value: accessSecret },
  ].forEach(({ name, value }) => {
    if (placeholderPatterns.some(p => p.test(value))) {
      placeholderVars.push(name);
    }
  });

  if (placeholderVars.length > 0) {
    throw new XConfigError(
      `Credentials appear to be placeholders in: ${placeholderVars.join(", ")}. ` +
      "Please replace with actual API credentials."
    );
  }

  return {
    appKey,
    appSecret,
    accessToken,
    accessSecret,
    dryRun: process.env.DRY_RUN === "true",
  };
}

/**
 * Check if all required X API credentials are present.
 * Returns detailed status for diagnostics.
 */
export function checkXConfigHealth(): {
  ready: boolean;
  present: string[];
  missing: string[];
  warnings: string[];
} {
  const vars = {
    X_API_KEY: process.env.X_API_KEY?.trim() || "",
    X_API_SECRET: process.env.X_API_SECRET?.trim() || "",
    X_ACCESS_TOKEN: process.env.X_ACCESS_TOKEN?.trim() || "",
    X_ACCESS_SECRET: process.env.X_ACCESS_SECRET?.trim() || "",
  };

  const present: string[] = [];
  const missing: string[] = [];
  const warnings: string[] = [];

  Object.entries(vars).forEach(([name, value]) => {
    if (value) {
      present.push(name);

      // Check for placeholder patterns
      const placeholderPatterns = [/your_/i, /example/i, /placeholder/i, /xxx/i];
      if (placeholderPatterns.some(p => p.test(value))) {
        warnings.push(`${name} appears to contain placeholder value`);
      }

      // Check for suspiciously short values (might be truncated)
      if (value.length < 10) {
        warnings.push(`${name} is suspiciously short (${value.length} chars)`);
      }
    } else {
      missing.push(name);
    }
  });

  return {
    ready: missing.length === 0,
    present,
    missing,
    warnings,
  };
}
