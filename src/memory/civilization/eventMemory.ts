/**
 * Event Memory — Civilization-level event history
 *
 * Phase-5: Tracks major chart funeral eras, etc.
 */

export interface EventMemoryItem {
  event_id: string;
  event_type: string;
  summary: string;
  created_at: string;
}

const events: EventMemoryItem[] = [];

export async function addEventMemory(item: Omit<EventMemoryItem, "created_at">): Promise<EventMemoryItem> {
  const full: EventMemoryItem = {
    ...item,
    created_at: new Date().toISOString(),
  };
  events.push(full);
  return full;
}

export async function getRecentEventMemory(limit = 5): Promise<EventMemoryItem[]> {
  return [...events]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}
