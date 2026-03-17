/**
 * Faction Effects — Apply faction flavor to prompts
 *
 * Phase-5: Phrase choice, tone overlays.
 */

import { getFactionForGnome } from "./factionRegistry.js";

export interface FactionEffect {
  gnomeId: string;
  factionMotif?: string;
  toneHint?: string;
}

export function getFactionEffects(gnomeId: string): FactionEffect {
  const faction = getFactionForGnome(gnomeId);
  return {
    gnomeId,
    factionMotif: faction?.description,
    toneHint: faction ? `${faction.name} energy` : undefined,
  };
}
