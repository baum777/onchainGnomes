import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readXConfigFromEnv, checkXConfigHealth, XConfigError } from "../../src/clients/xClientConfig.js";

describe("readXConfigFromEnv", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("reads OAuth2 runtime credentials from environment", () => {
    process.env.X_CLIENT_ID = "client_id";
    process.env.X_CLIENT_SECRET = "client_secret";
    process.env.X_REFRESH_TOKEN = "refresh_token";
    process.env.X_ACCESS_TOKEN = "access_token";

    const config = readXConfigFromEnv();
    expect(config.xClientId).toBe("client_id");
    expect(config.xClientSecret).toBe("client_secret");
    expect(config.xRefreshToken).toBe("refresh_token");
    expect(config.xAccessToken).toBe("access_token");
  });

  it("throws XConfigError when required OAuth2 vars are missing", () => {
    delete process.env.X_CLIENT_ID;
    delete process.env.X_CLIENT_SECRET;
    delete process.env.X_REFRESH_TOKEN;

    expect(() => readXConfigFromEnv()).toThrow(XConfigError);
    expect(() => readXConfigFromEnv()).toThrow("X_CLIENT_ID");
  });
});

describe("checkXConfigHealth", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns ready=true when required OAuth2 credentials are present", () => {
    process.env.X_CLIENT_ID = "client_id";
    process.env.X_CLIENT_SECRET = "client_secret";
    process.env.X_REFRESH_TOKEN = "refresh_token";
    process.env.X_ACCESS_TOKEN = "access_token";

    const health = checkXConfigHealth();
    expect(health.ready).toBe(true);
    expect(health.missing).toHaveLength(0);
    expect(health.present).toEqual(
      expect.arrayContaining(["X_CLIENT_ID", "X_CLIENT_SECRET", "X_REFRESH_TOKEN", "X_ACCESS_TOKEN"]),
    );
  });

  it("returns ready=false when a required var is missing", () => {
    delete process.env.X_CLIENT_ID;
    process.env.X_CLIENT_SECRET = "client_secret";
    process.env.X_REFRESH_TOKEN = "refresh_token";

    const health = checkXConfigHealth();
    expect(health.ready).toBe(false);
    expect(health.missing).toContain("X_CLIENT_ID");
  });

  it("adds warning when access token is absent (refresh-at-runtime path)", () => {
    process.env.X_CLIENT_ID = "client_id";
    process.env.X_CLIENT_SECRET = "client_secret";
    process.env.X_REFRESH_TOKEN = "refresh_token";
    delete process.env.X_ACCESS_TOKEN;

    const health = checkXConfigHealth();
    expect(health.ready).toBe(true);
    expect(health.warnings.some((w) => w.includes("X_ACCESS_TOKEN not set"))).toBe(true);
  });
});
