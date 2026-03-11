import { describe, it, expect } from "vitest";
import {
  loadGorkySystemPrompt,
  loadGorkyDeveloperPrompt,
  loadGorkyUserTemplate,
  renderUserPrompt,
  type PromptVariables,
} from "../../src/context/prompts/promptLoader.js";

describe("promptLoader", () => {
  it("loads GORKY_ON_SOL_system.md", () => {
    const content = loadGorkySystemPrompt();
    expect(content).toContain("GORKY_ON_SOL");
    expect(content).toContain("crypto-native");
    expect(content).toContain("280");
  });

  it("loads GORKY_ON_SOL_developer.md", () => {
    const content = loadGorkyDeveloperPrompt();
    expect(content).toContain("reply_text");
    expect(content).toContain("style_label");
    expect(content).toContain("JSON");
  });

  it("loads GORKY_ON_SOL_user_template.md", () => {
    const content = loadGorkyUserTemplate();
    expect(content).toContain("{{mention_text}}");
    expect(content).toContain("{{thread_summary}}");
    expect(content).toContain("{{entities}}");
    expect(content).toContain("{{claims}}");
    expect(content).toContain("{{timeline}}");
    expect(content).toContain("{{constraints}}");
  });

  it("renders user prompt with variables", () => {
    const vars: PromptVariables = {
      mention_text: "What about $BTC?",
      thread_summary: "User asked about BTC.",
      entities: "btc, bitcoin",
      claims: "- BTC is volatile",
      timeline: "No timeline data",
      constraints: "Keep reply <= 280 chars",
    };
    const rendered = renderUserPrompt(vars);
    expect(rendered).toContain("What about $BTC?");
    expect(rendered).toContain("User asked about BTC.");
    expect(rendered).toContain("btc, bitcoin");
    expect(rendered).toContain("Keep reply <= 280 chars");
    expect(rendered).not.toContain("{{");
  });
});
