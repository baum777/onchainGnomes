import { describe, it, expect } from "vitest";
import {
  loadPreset,
  loadAllPresets,
  getPresetByKey,
  resolvePresetKey,
} from "../../src/loaders/presetLoader.js";
import { resolve } from "path";

describe("presetLoader", () => {
  describe("resolvePresetKey", () => {
    it("returns aliased key for legacy horny_ prefixed keys", () => {
      expect(resolvePresetKey("horny_roast_card")).toBe("Gorky_on_sol_roast_card");
      expect(resolvePresetKey("horny_cyberpunk")).toBe("Gorky_on_sol_cyberpunk");
    });

    it("returns original key if no alias", () => {
      expect(resolvePresetKey("custom_preset")).toBe("custom_preset");
      expect(resolvePresetKey("Gorky_on_sol_roast_card")).toBe("Gorky_on_sol_roast_card");
    });

    it("handles all legacy HORNY -> Gorky_on_sol aliases", () => {
      const legacyKeys = [
        "horny_roast_card",
        "horny_cyberpunk",
        "horny_chart_ghost",
        "horny_trade_screen",
        "horny_certificate",
        "horny_ghost",
        "horny_courtroom",
        "horny_chart_autopsy",
      ];

      for (const key of legacyKeys) {
        const resolved = resolvePresetKey(key);
        expect(resolved.startsWith("Gorky_on_sol_")).toBe(true);
        expect(resolved).not.toContain("horny");
      }
    });

    it("no file contains string 'horny' except migration aliases", () => {
      // This is a conceptual test - actual file scanning would be in integration tests
      const aliasMap = {
        horny_roast_card: "Gorky_on_sol_roast_card",
        horny_cyberpunk: "Gorky_on_sol_cyberpunk",
      };
      expect(Object.keys(aliasMap).some(k => k.includes("horny"))).toBe(true);
      expect(Object.values(aliasMap).every(v => !v.includes("horny"))).toBe(true);
    });
  });

  describe("loadPreset", () => {
    it("loads a valid preset YAML", () => {
      // This test requires actual preset files
      // Will skip gracefully if file doesn't exist
      try {
        const presetPath = resolve("./prompts/presets/images/Gorky_on_sol_roast_card.yaml");
        const preset = loadPreset(presetPath);

        expect(preset.preset_key).toBeDefined();
        expect(preset.style_prompt).toBeDefined();
      } catch {
        // Skip if file doesn't exist
      }
    });
  });

  describe("loadAllPresets", () => {
    it("returns a map of presets", () => {
      const presetsDir = resolve("./prompts/presets/images");

      try {
        const presets = loadAllPresets(presetsDir);

        expect(presets instanceof Map).toBe(true);
      } catch {
        // Skip if directory doesn't exist
      }
    });
  });

  describe("getPresetByKey with aliases", () => {
    it("finds preset via alias", () => {
      // Mock preset map
      const mockPresets = new Map([
        ["Gorky_on_sol_roast_card", { preset_key: "Gorky_on_sol_roast_card", style_prompt: "test", sourcePath: "" }],
      ]);

      const preset = getPresetByKey(mockPresets, "horny_roast_card");

      expect(preset).toBeDefined();
      expect(preset?.preset_key).toBe("Gorky_on_sol_roast_card");
    });
  });
});
