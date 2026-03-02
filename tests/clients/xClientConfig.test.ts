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

  it("reads valid credentials from environment", () => {
    process.env.X_API_KEY = "test_key";
    process.env.X_API_SECRET = "test_secret";
    process.env.X_ACCESS_TOKEN = "test_token";
    process.env.X_ACCESS_SECRET = "test_secret";

    const config = readXConfigFromEnv();
    expect(config.appKey).toBe("test_key");
    expect(config.appSecret).toBe("test_secret");
    expect(config.accessToken).toBe("test_token");
    expect(config.accessSecret).toBe("test_secret");
  });

  it("throws XConfigError when X_API_KEY is missing", () => {
    process.env.X_API_SECRET = "test_secret";
    process.env.X_ACCESS_TOKEN = "test_token";
    process.env.X_ACCESS_SECRET = "test_secret";

    expect(() => readXConfigFromEnv()).toThrow(XConfigError);
    expect(() => readXConfigFromEnv()).toThrow("X_API_KEY");
  });

  it("throws XConfigError when all credentials missing", () => {
    delete process.env.X_API_KEY;
    delete process.env.X_API_SECRET;
    delete process.env.X_ACCESS_TOKEN;
    delete process.env.X_ACCESS_SECRET;

    expect(() => readXConfigFromEnv()).toThrow(XConfigError);
    expect(() => readXConfigFromEnv()).toThrow("Missing X API credentials");
  });

  it("throws XConfigError for placeholder values", () => {
    process.env.X_API_KEY = "your_api_key_here";
    process.env.X_API_SECRET = "test_secret";
    process.env.X_ACCESS_TOKEN = "test_token";
    process.env.X_ACCESS_SECRET = "test_secret";

    expect(() => readXConfigFromEnv()).toThrow(XConfigError);
    expect(() => readXConfigFromEnv()).toThrow("placeholder");
  });

  it("trims whitespace from values", () => {
    process.env.X_API_KEY = "  test_key  ";
    process.env.X_API_SECRET = "test_secret";
    process.env.X_ACCESS_TOKEN = "test_token";
    process.env.X_ACCESS_SECRET = "test_secret";

    const config = readXConfigFromEnv();
    expect(config.appKey).toBe("test_key");
  });

  it("sets dryRun true when DRY_RUN env is 'true'", () => {
    process.env.X_API_KEY = "test_key";
    process.env.X_API_SECRET = "test_secret";
    process.env.X_ACCESS_TOKEN = "test_token";
    process.env.X_ACCESS_SECRET = "test_secret";
    process.env.DRY_RUN = "true";

    const config = readXConfigFromEnv();
    expect(config.dryRun).toBe(true);
  });

  it("sets dryRun false when DRY_RUN env is not 'true'", () => {
    process.env.X_API_KEY = "test_key";
    process.env.X_API_SECRET = "test_secret";
    process.env.X_ACCESS_TOKEN = "test_token";
    process.env.X_ACCESS_SECRET = "test_secret";
    process.env.DRY_RUN = "false";

    const config = readXConfigFromEnv();
    expect(config.dryRun).toBe(false);
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

  it("returns ready=true when all credentials present", () => {
    process.env.X_API_KEY = "test_key";
    process.env.X_API_SECRET = "test_secret";
    process.env.X_ACCESS_TOKEN = "test_token";
    process.env.X_ACCESS_SECRET = "test_secret";

    const health = checkXConfigHealth();
    expect(health.ready).toBe(true);
    expect(health.missing).toHaveLength(0);
    expect(health.present).toHaveLength(4);
  });

  it("returns ready=false when credentials missing", () => {
    delete process.env.X_API_KEY;
    process.env.X_API_SECRET = "test_secret";
    process.env.X_ACCESS_TOKEN = "test_token";
    process.env.X_ACCESS_SECRET = "test_secret";

    const health = checkXConfigHealth();
    expect(health.ready).toBe(false);
    expect(health.missing).toContain("X_API_KEY");
    expect(health.present).toContain("X_API_SECRET");
  });

  it("detects placeholder warnings", () => {
    process.env.X_API_KEY = "your_api_key";
    process.env.X_API_SECRET = "test_secret";
    process.env.X_ACCESS_TOKEN = "test_token";
    process.env.X_ACCESS_SECRET = "test_secret";

    const health = checkXConfigHealth();
    expect(health.warnings.length).toBeGreaterThan(0);
    expect(health.warnings[0]).toContain("placeholder");
  });

  it("detects suspiciously short values", () => {
    process.env.X_API_KEY = "ab";
    process.env.X_API_SECRET = "test_secret";
    process.env.X_ACCESS_TOKEN = "test_token";
    process.env.X_ACCESS_SECRET = "test_secret";

    const health = checkXConfigHealth();
    expect(health.warnings.length).toBeGreaterThan(0);
    expect(health.warnings[0]).toContain("short");
  });
});
