/**
 * E2E: dry_run mode — no publish occurs
 *
 * Asserts that when LAUNCH_MODE=dry_run (or DRY_RUN=true), the system
 * never actually posts to X.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { shouldPost, isPostingDisabled } from "../../src/ops/launchGate.js";
import { resetLaunchEnvCache } from "../../src/config/env.js";

describe("E2E: dry_run publish gate", () => {
  beforeAll(() => {
    vi.stubEnv("LAUNCH_MODE", "dry_run");
    resetLaunchEnvCache();
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    resetLaunchEnvCache();
  });

  it("shouldPost returns log_only for dry_run", () => {
    const decision = shouldPost("sergorky");
    expect(decision.action).toBe("log_only");
    expect(decision.reason).toContain("dry_run");
  });

  it("isPostingDisabled returns true for dry_run", () => {
    expect(isPostingDisabled()).toBe(true);
  });
});

describe("E2E: LAUNCH_MODE=off publish gate", () => {
  beforeAll(() => {
    vi.stubEnv("LAUNCH_MODE", "off");
    resetLaunchEnvCache();
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    resetLaunchEnvCache();
  });

  it("shouldPost returns refuse for off", () => {
    const decision = shouldPost("anyuser");
    expect(decision.action).toBe("refuse");
    expect(decision.reason).toContain("off");
  });

  it("isPostingDisabled returns true for off", () => {
    expect(isPostingDisabled()).toBe(true);
  });
});
