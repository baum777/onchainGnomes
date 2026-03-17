/**
 * Faction Memory — Faction dominance and history
 *
 * Phase-5: Tracks which faction dominated recent meme chaos, etc.
 */

export interface FactionMemoryItem {
  faction_id: string;
  metric: string;
  value: number;
  created_at: string;
}

const items: FactionMemoryItem[] = [];

export async function recordFactionMetric(
  factionId: string,
  metric: string,
  value: number,
): Promise<void> {
  items.push({
    faction_id: factionId,
    metric,
    value,
    created_at: new Date().toISOString(),
  });
}

export async function getFactionMemory(factionId: string, limit = 5): Promise<FactionMemoryItem[]> {
  return items
    .filter((m) => m.faction_id === factionId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}
