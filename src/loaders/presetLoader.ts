import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";

export type ImagePreset = {
  preset_key: string;
  style_prompt: string;
  negative_prompt?: string;
  size?: string;
  caption_bank?: string;
  caption_rules?: string[];
  brand_rules?: string[];
  caption_templates?: string[];
};

export type LoadedPreset = ImagePreset & {
  sourcePath: string;
};

const PRESET_ALIASES: Record<string, string> = {
  // Backward compatibility aliases (HORNY → GORKY)
  horny_roast_card: "gorky_roast_card",
  horny_cyberpunk: "gorky_cyberpunk",
  horny_chart_ghost: "gorky_chart_ghost",
  horny_trade_screen: "gorky_trade_screen",
  horny_certificate: "gorky_certificate",
  horny_ghost: "gorky_ghost",
  horny_courtroom: "gorky_courtroom",
  horny_chart_autopsy: "gorky_chart_autopsy",
};

export function resolvePresetKey(key: string): string {
  return PRESET_ALIASES[key] || key;
}

export function loadPreset(path: string): LoadedPreset {
  const content = readFileSync(path, "utf-8");
  const parsed = yaml.load(content) as ImagePreset;

  if (!parsed.preset_key) {
    throw new Error(`Preset missing preset_key: ${path}`);
  }
  if (!parsed.style_prompt) {
    throw new Error(`Preset missing style_prompt: ${path}`);
  }

  return {
    ...parsed,
    sourcePath: path,
  };
}

export function loadAllPresets(presetsDir: string): Map<string, LoadedPreset> {
  const presets = new Map<string, LoadedPreset>();

  try {
    const files = readdirSync(presetsDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

    for (const file of files) {
      const path = join(presetsDir, file);
      try {
        const preset = loadPreset(path);
        presets.set(preset.preset_key, preset);
      } catch (err) {
        console.warn(`Failed to load preset ${file}:`, err);
      }
    }
  } catch {
    // Directory might not exist
  }

  return presets;
}

export function getPresetByKey(
  presets: Map<string, LoadedPreset>,
  key: string
): LoadedPreset | undefined {
  const resolvedKey = resolvePresetKey(key);
  return presets.get(resolvedKey) || presets.get(key);
}
