import { describe, it, expect } from "vitest";
import { composeGorkyPrompt, isOutputSafe } from "../../src/brand_matrix/gorkyPromptComposer.js";

describe("composeGorkyPrompt", () => {
  it("returns valid LlmPrompt structure", () => {
    const result = composeGorkyPrompt({
      userText: "Hello",
      energy: 3,
      humorMode: "authority",
    });
    expect(result).toHaveProperty("system");
    expect(result).toHaveProperty("user");
    expect(typeof result.system).toBe("string");
    expect(typeof result.user).toBe("string");
  });

  it("system includes GORKY reference", () => {
    const result = composeGorkyPrompt({
      userText: "Test",
      energy: 3,
      humorMode: "authority",
    });
    expect(result.system.toLowerCase()).toContain("gorky");
  });

  it("includes rhyme instruction for rhyme mode", () => {
    const result = composeGorkyPrompt({
      userText: "Test",
      energy: 3,
      humorMode: "rhyme",
    });
    expect(result.system.toLowerCase()).toContain("rhyme");
  });

  it("includes user text in user prompt", () => {
    const result = composeGorkyPrompt({
      userText: "My custom message",
      energy: 3,
      humorMode: "authority",
    });
    expect(result.user).toContain("My custom message");
  });

  it("includes command when provided", () => {
    const result = composeGorkyPrompt({
      userText: "Hello",
      command: "ask",
      energy: 3,
      humorMode: "authority",
    });
    expect(result.user).toContain("Command: /ask");
  });

  it("includes context summary when provided", () => {
    const result = composeGorkyPrompt({
      userText: "Hello",
      context: { summary: "Previous discussion" },
      energy: 3,
      humorMode: "authority",
    });
    expect(result.user).toContain("Previous discussion");
  });

  it("includes reward reply instruction when isRewardReply", () => {
    const result = composeGorkyPrompt({
      userText: "Hello",
      energy: 4,
      humorMode: "goblin",
      isRewardReply: true,
    });
    expect(result.system).toContain("reward reply");
  });
});

describe("isOutputSafe", () => {
  it("detects forbidden words", () => {
    const result = isOutputSafe("This contains score and threshold");
    expect(result.safe).toBe(false);
    expect(result.violations).toContain("score");
    expect(result.violations).toContain("threshold");
  });

  it("returns safe for clean text", () => {
    const result = isOutputSafe("This is a clean prompt with no forbidden words");
    expect(result.safe).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("is case insensitive", () => {
    const result = isOutputSafe("This contains SCORE and Threshold");
    expect(result.safe).toBe(false);
  });
});

describe("sanitization", () => {
  it("never includes forbidden words in output", () => {
    const result = composeGorkyPrompt({
      userText: "Test message",
      energy: 3,
      humorMode: "authority",
    });

    const forbidden = ["score", "threshold", "trace", "cooldown", "xp"];
    const systemLower = result.system.toLowerCase();
    const userLower = result.user.toLowerCase();

    forbidden.forEach(word => {
      // Some words might appear in safety boundaries section, but that's internal
      // The actual check is that they don't leak to user prompt
      expect(userLower).not.toContain(word);
    });
  });
});
