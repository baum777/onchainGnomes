import fs from "node:fs";
import path from "node:path";

export type XRuntimeConfig = {
  runtime: "render" | "local";
  renderServiceType?: string;
  xClientId: string;
  xClientSecret: string;
  xRefreshToken: string;
  xAccessToken?: string;
  xExpiresIn?: number;
  xTokenCreatedAt?: number;
  xRefreshBufferSeconds: number;
  xOauthTokenUrl: string;
  xBotUserId?: string;
  xBotUsername?: string;
};

export type XTokenRefreshResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  created_at: number;
  refresh_token?: string;
  refresh_token_rotated: boolean;
  nextRefreshToken?: string;
};

type TokenCache = {
  accessToken?: string;
  tokenType?: string;
  expiresIn?: number;
  createdAt?: number;
  expiresAt?: number;
  refreshToken?: string;
};

export interface TokenStateStore {
  saveRefreshToken(nextRefreshToken: string): Promise<void>;
}

const DEFAULT_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const DEFAULT_REFRESH_BUFFER_SECONDS = 300;
const ENV_FILE = ".env.oauth2";

let tokenCache: TokenCache = {};
let refreshInFlight: Promise<string> | null = null;
let tokenStateStore: TokenStateStore | null = null;

export function setTokenStateStore(store: TokenStateStore | null): void {
  tokenStateStore = store;
}

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const parsed: Record<string, string> = {};
  const content = fs.readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['\"]|['\"]$/g, "");
    parsed[key] = value;
  }

  return parsed;
}

function readConfigValue(key: string, fallback: Record<string, string>): string {
  const fromEnv = process.env[key]?.trim();
  if (fromEnv) return fromEnv;
  return (fallback[key] ?? "").trim();
}

function normalizeCreatedAt(raw?: string): number | undefined {
  if (!raw) return undefined;
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return asNumber > 10_000_000_000 ? Math.floor(asNumber / 1000) : Math.floor(asNumber);
  }
  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) {
    return Math.floor(parsed / 1000);
  }
  return undefined;
}

export function maskSecret(value?: string): string {
  if (!value) return "<empty>";
  if (value.length <= 8) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

export function getXRuntimeConfig(): XRuntimeConfig {
  const isRender = process.env.RENDER === "true" || Boolean(process.env.RENDER_SERVICE_ID);
  const envFile = path.resolve(process.cwd(), ENV_FILE);
  const fileFallback = isRender ? {} : parseEnvFile(envFile);

  if (isRender) {
    console.log("[XAuth] Render runtime erkannt; lade X-Konfiguration aus Environment");
  } else {
    console.log("[XAuth] Lokale Runtime erkannt; `.env.oauth2` wird als Fallback verwendet");
  }

  const config: XRuntimeConfig = {
    runtime: isRender ? "render" : "local",
    renderServiceType: process.env.RENDER_SERVICE_TYPE,
    xClientId: readConfigValue("X_CLIENT_ID", fileFallback),
    xClientSecret: readConfigValue("X_CLIENT_SECRET", fileFallback),
    xRefreshToken: readConfigValue("X_REFRESH_TOKEN", fileFallback),
    xAccessToken: readConfigValue("X_ACCESS_TOKEN", fileFallback) || undefined,
    xExpiresIn: Number(readConfigValue("X_EXPIRES_IN", fileFallback)) || undefined,
    xTokenCreatedAt: normalizeCreatedAt(readConfigValue("X_TOKEN_CREATED_AT", fileFallback)),
    xRefreshBufferSeconds:
      Number(readConfigValue("X_REFRESH_BUFFER_SECONDS", fileFallback)) || DEFAULT_REFRESH_BUFFER_SECONDS,
    xOauthTokenUrl: readConfigValue("X_OAUTH_TOKEN_URL", fileFallback) || DEFAULT_TOKEN_URL,
    xBotUserId: readConfigValue("X_BOT_USER_ID", fileFallback) || undefined,
    xBotUsername: readConfigValue("X_BOT_USERNAME", fileFallback) || readConfigValue("BOT_USERNAME", fileFallback) || undefined,
  };

  const missing: string[] = [];
  if (!config.xClientId) missing.push("X_CLIENT_ID");
  if (!config.xClientSecret) missing.push("X_CLIENT_SECRET");
  if (!config.xRefreshToken) missing.push("X_REFRESH_TOKEN");

  if (missing.length > 0) {
    throw new Error(`[XAuth] Fehlende Pflichtvariablen: ${missing.join(", ")}`);
  }

  return config;
}

export function testTokenNeedsRefresh(input: {
  accessToken?: string;
  createdAt?: number;
  expiresIn?: number;
  expiresAt?: number;
  bufferSeconds?: number;
}): boolean {
  const now = Math.floor(Date.now() / 1000);
  const buffer = input.bufferSeconds ?? DEFAULT_REFRESH_BUFFER_SECONDS;

  if (!input.accessToken) return true;
  if (!input.createdAt || !input.expiresIn) return true;

  const expiresAt = input.expiresAt ?? input.createdAt + input.expiresIn;
  return expiresAt - now <= buffer;
}

export async function requestXTokenRefresh(config = getXRuntimeConfig()): Promise<XTokenRefreshResponse> {
  const credentials = Buffer.from(`${config.xClientId}:${config.xClientSecret}`, "utf8").toString("base64");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokenCache.refreshToken ?? config.xRefreshToken,
    client_id: config.xClientId,
  });

  const response = await fetch(config.xOauthTokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const rawText = await response.text();
  const payload = rawText ? JSON.parse(rawText) : {};

  if (!response.ok) {
    throw new Error(
      `[XAuth] Token refresh fehlgeschlagen (${response.status}): ${
        payload?.error_description || payload?.error || rawText || "unknown"
      }`
    );
  }

  const createdAt = Math.floor(Date.now() / 1000);
  const refreshTokenRotated = Boolean(payload.refresh_token && payload.refresh_token !== (tokenCache.refreshToken ?? config.xRefreshToken));

  if (refreshTokenRotated) {
    console.warn(
      `[XAuth] Provider hat einen neuen refresh_token zurückgegeben; persistente Rotation ist nicht automatisch aktiviert (${maskSecret(
        payload.refresh_token
      )})`
    );
  }

  if (payload.refresh_token && tokenStateStore) {
    await tokenStateStore.saveRefreshToken(payload.refresh_token);
  }

  return {
    access_token: payload.access_token,
    token_type: payload.token_type ?? "bearer",
    expires_in: Number(payload.expires_in ?? 7200),
    created_at: createdAt,
    refresh_token: payload.refresh_token,
    refresh_token_rotated: refreshTokenRotated,
    nextRefreshToken: payload.refresh_token,
  };
}

export async function getValidXAccessToken(opts?: { forceRefresh?: boolean }): Promise<string> {
  const config = getXRuntimeConfig();

  if (!tokenCache.accessToken && config.xAccessToken) {
    tokenCache = {
      ...tokenCache,
      accessToken: config.xAccessToken,
      expiresIn: config.xExpiresIn,
      createdAt: config.xTokenCreatedAt,
      expiresAt:
        config.xTokenCreatedAt && config.xExpiresIn
          ? config.xTokenCreatedAt + config.xExpiresIn
          : undefined,
      refreshToken: config.xRefreshToken,
    };
  }

  const shouldRefresh =
    opts?.forceRefresh === true ||
    testTokenNeedsRefresh({
      accessToken: tokenCache.accessToken,
      createdAt: tokenCache.createdAt,
      expiresIn: tokenCache.expiresIn,
      expiresAt: tokenCache.expiresAt,
      bufferSeconds: config.xRefreshBufferSeconds,
    });

  if (!shouldRefresh) {
    console.log("[XAuth] Access Token gültig, kein Refresh nötig");
    return tokenCache.accessToken as string;
  }

  if (!refreshInFlight) {
    console.log("[XAuth] Access Token wird erneuert");
    refreshInFlight = (async () => {
      const refreshed = await requestXTokenRefresh(config);
      tokenCache = {
        accessToken: refreshed.access_token,
        tokenType: refreshed.token_type,
        expiresIn: refreshed.expires_in,
        createdAt: refreshed.created_at,
        expiresAt: refreshed.created_at + refreshed.expires_in,
        refreshToken: refreshed.refresh_token ?? tokenCache.refreshToken ?? config.xRefreshToken,
      };
      return refreshed.access_token;
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

export async function getXAuthHeaders(): Promise<Record<string, string>> {
  const token = await getValidXAccessToken();
  return {
    Authorization: `Bearer ${token}`,
  };
}

export function getTokenCacheSnapshot(): TokenCache {
  return {
    ...tokenCache,
    accessToken: tokenCache.accessToken ? maskSecret(tokenCache.accessToken) : undefined,
    refreshToken: tokenCache.refreshToken ? maskSecret(tokenCache.refreshToken) : undefined,
  };
}
