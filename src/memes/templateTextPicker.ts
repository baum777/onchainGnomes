import { LoadedTemplate } from "../loaders/templateLoader.js";
import { pickOne, RNG } from "./dice.js";
import { createSeededRNG } from "../loaders/seed.js";

export type PickedTemplateTexts = Record<string, string>;

export function pickTemplateTexts(
  template: LoadedTemplate,
  seedKey: string
): PickedTemplateTexts {
  const rng: RNG = createSeededRNG(seedKey);
  const zones = template.text_zones;
  const result: Record<string, string> = {};

  for (const [zoneKey, options] of Object.entries(zones)) {
    if (Array.isArray(options) && options.length > 0) {
      result[zoneKey] = pickOne(options, rng);
    }
  }

  return result;
}
