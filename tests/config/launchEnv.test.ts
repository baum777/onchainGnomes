import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadLaunchEnv, resetLaunchEnvCache, validateLaunchEnvOrExit } from "../../src/config/env.js";

const ORIGINAL_ENV = { ...process.env };

describe("launch env provider validation", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetLaunchEnvCache();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetLaunchEnvCache();
    vi.restoreAllMocks();
  });

  it("loads provider and fallback values", () => {
    process.env.LAUNCH_MODE = "off";
    process.env.LLM_PROVIDER = "anthropic";
    process.env.LLM_FALLBACK_PROVIDER = "openai";

    const env = loadLaunchEnv();
    expect(env.LLM_PROVIDER).toBe("anthropic");
    expect(env.LLM_FALLBACK_PROVIDER).toBe("openai");
  });

  it("fails closed when active provider key missing", () => {
    process.env.LAUNCH_MODE = "prod";
    process.env.LLM_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "";
    process.env.LLM_API_KEY = "";

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    expect(() => validateLaunchEnvOrExit()).toThrow("exit:1");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("fails closed when fallback provider key missing", () => {
    process.env.LAUNCH_MODE = "prod";
    process.env.LLM_PROVIDER = "xai";
    process.env.XAI_API_KEY = "x".repeat(20);
    process.env.LLM_FALLBACK_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "";

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    expect(() => validateLaunchEnvOrExit()).toThrow("exit:1");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
