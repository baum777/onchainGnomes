import { loadAllTemplates, LoadedTemplate } from "./templateLoader.js";
import { loadAllPresets, LoadedPreset, getPresetByKey, resolvePresetKey } from "./presetLoader.js";
import { pickOne, RNG } from "../memes/dice.js";
import { createSeededRNG } from "./seed.js";

export type ResolvedMemeConfig = {
  preset: LoadedPreset;
  template: LoadedTemplate;
  seedKey: string;
};

export class MemeResolver {
  private presets: Map<string, LoadedPreset>;
  private templates: Map<string, LoadedTemplate>;

  constructor(presetsDir: string, templatesDir: string) {
    this.presets = loadAllPresets(presetsDir);
    this.templates = loadAllTemplates(templatesDir);
  }

  resolve(
    presetKey: string | undefined,
    templateKey: string | undefined,
    seedKey: string
  ): ResolvedMemeConfig | null {
    // Resolve preset
    let preset: LoadedPreset | undefined;
    if (presetKey) {
      preset = getPresetByKey(this.presets, presetKey);
    }

    // Fallback to default preset if not found
    if (!preset) {
      const defaultKey = resolvePresetKey("gorky_roast_card");
      preset = this.presets.get(defaultKey);
      // Try any available preset as last resort
      if (!preset && this.presets.size > 0) {
        preset = this.presets.values().next().value;
      }
    }

    if (!preset) {
      return null;
    }

    // Resolve template
    let template: LoadedTemplate | undefined;
    if (templateKey) {
      template = this.templates.get(templateKey);
    }

    // If no template specified or not found, pick based on seed
    if (!template) {
      const rng: RNG = createSeededRNG(seedKey);
      const availableTemplates = Array.from(this.templates.values());
      if (availableTemplates.length > 0) {
        template = pickOne(availableTemplates, rng);
      }
    }

    if (!template) {
      return null;
    }

    return {
      preset,
      template,
      seedKey,
    };
  }

  getAvailablePresets(): string[] {
    return Array.from(this.presets.keys());
  }

  getAvailableTemplates(): string[] {
    return Array.from(this.templates.keys());
  }
}

export function createResolver(presetsDir: string, templatesDir: string): MemeResolver {
  return new MemeResolver(presetsDir, templatesDir);
}
