/**
 * Faction Registry — Gnome worldview clusters
 *
 * Phase-5: Ash Circle, Neon Burrow, Root Ledger, Moss Court, Thorn Watch.
 */

export interface Faction {
  id: string;
  name: string;
  description: string;
  gnomeIds: string[];
}

const FACTIONS: Faction[] = [
  { id: "ash_circle", name: "Ash Circle", description: "Funeral, memory, collapse", gnomeIds: ["gorky"] },
  { id: "neon_burrow", name: "Neon Burrow", description: "Meme chaos, velocity", gnomeIds: ["spark"] },
  { id: "moss_court", name: "Moss Court", description: "Dry witnesses, detached irony", gnomeIds: ["moss"] },
];

export function getAllFactions(): Faction[] {
  return [...FACTIONS];
}

export function getFactionForGnome(gnomeId: string): Faction | null {
  return FACTIONS.find((f) => f.gnomeIds.includes(gnomeId)) ?? null;
}
