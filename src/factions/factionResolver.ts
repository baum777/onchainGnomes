/**
 * Faction Resolver — Resolve gnome faction context for routing
 *
 * Phase-5: Influences tone, cameo patterns.
 */

import { getFactionForGnome } from "./factionRegistry.js";

export interface FactionContext {
  gnomeId: string;
  factionId: string | null;
  factionName: string | null;
}

export function resolveFactionContext(gnomeId: string): FactionContext {
  const faction = getFactionForGnome(gnomeId);
  return {
    gnomeId,
    factionId: faction?.id ?? null,
    factionName: faction?.name ?? null,
  };
}
