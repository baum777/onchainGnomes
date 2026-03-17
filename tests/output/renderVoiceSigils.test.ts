import { beforeEach, describe, expect, it } from "vitest";
import { clearRegistry, registerGnome } from "../../src/gnomes/registry.js";
import { deriveActivatedVoices, renderVoiceSigils } from "../../src/output/renderVoiceSigils.js";

function gnome(id: string, char: string, fallback = "[F]") {
  return {
    id,
    name: id,
    role: "role",
    archetype: "dry_observer" as const,
    sigil: { char, code: "x", fallback },
  };
}

describe("renderVoiceSigils", () => {
  beforeEach(() => {
    clearRegistry();
    registerGnome(gnome("stillhalter", "🪨", "[STILL]"));
    registerGnome(gnome("nebelspieler", "🌫", "[NEBEL]"));
    registerGnome(gnome("glutkern", "🔥", "[GLUT]"));
    registerGnome(gnome("muenzhueter", "", "[MUENZ]"));
  });

  it("1 voice wraps start and end with same sigil", () => {
    const out = renderVoiceSigils("hello", { primary: "stillhalter" });
    expect(out.startsWith("🪨 ")).toBe(true);
    expect(out.includes(" hello 🪨")).toBe(true);
  });

  it("2 voices use primary start and secondary end", () => {
    const out = renderVoiceSigils("hello", { primary: "stillhalter", secondary: "nebelspieler" });
    expect(out.startsWith("🪨 ")).toBe(true);
    expect(out.includes(" hello 🌫")).toBe(true);
  });

  it("3 voices add middle sigil paragraph", () => {
    const out = renderVoiceSigils("hello", { primary: "stillhalter", secondary: "nebelspieler", tertiary: "glutkern" });
    expect(out).toContain("\n\n🌫\n\n");
    expect(out.includes("--voice-sigils--")).toBe(true);
  });

  it("falls back for unknown or missing unicode sigil", () => {
    expect(renderVoiceSigils("hello", { primary: "unknown" })).toContain("[GNOME]");
    expect(renderVoiceSigils("hello", { primary: "muenzhueter" })).toContain("[MUENZ]");
  });

  it("deduplicates and limits to 3 voices", () => {
    const voices = deriveActivatedVoices("stillhalter", ["stillhalter", "nebelspieler", "glutkern", "muenzhueter"]);
    expect(voices).toEqual({ primary: "stillhalter", secondary: "nebelspieler", tertiary: "glutkern" });
  });

  it("guards empty response and idempotency marker", () => {
    expect(renderVoiceSigils("  ", { primary: "stillhalter" })).toBe("");
    const once = renderVoiceSigils("hello", { primary: "stillhalter" });
    const twice = renderVoiceSigils(once, { primary: "stillhalter" });
    expect(twice).toBe(once);
  });
});
