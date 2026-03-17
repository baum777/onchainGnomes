/**
 * X OAuth2 Config Utilities
 */

import { getXRuntimeConfig } from "./xOAuthToken.js";

export class XConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XConfigError";
  }
}

export function readXConfigFromEnv() {
  try {
    return getXRuntimeConfig();
  } catch (err) {
    throw new XConfigError(err instanceof Error ? err.message : String(err));
  }
}

export function checkXConfigHealth(): {
  ready: boolean;
  present: string[];
  missing: string[];
  warnings: string[];
} {
  const vars = {
    X_CLIENT_ID: process.env.X_CLIENT_ID?.trim() || "",
    X_CLIENT_SECRET: process.env.X_CLIENT_SECRET?.trim() || "",
    X_REFRESH_TOKEN: process.env.X_REFRESH_TOKEN?.trim() || "",
    X_ACCESS_TOKEN: process.env.X_ACCESS_TOKEN?.trim() || "",
  };

  const present: string[] = [];
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const [name, value] of Object.entries(vars)) {
    if (value) present.push(name);
    else if (["X_CLIENT_ID", "X_CLIENT_SECRET", "X_REFRESH_TOKEN"].includes(name)) missing.push(name);
  }

  if (!vars.X_ACCESS_TOKEN) {
    warnings.push("X_ACCESS_TOKEN not set (ok; will be refreshed at runtime)");
  }

  return { ready: missing.length === 0, present, missing, warnings };
}
