/**
 * World Memory Store — Shared civilization-level memory
 *
 * Phase-5: Stores higher-order shared history.
 */

export interface CivilizationMemoryItem {
  id: string;
  category: string;
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

const store: CivilizationMemoryItem[] = [];

export async function addCivilizationMemory(
  item: Omit<CivilizationMemoryItem, "id" | "created_at">,
): Promise<CivilizationMemoryItem> {
  const full: CivilizationMemoryItem = {
    ...item,
    id: `civ_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
  };
  store.push(full);
  return full;
}

export async function getCivilizationMemory(
  opts?: { category?: string; limit?: number },
): Promise<CivilizationMemoryItem[]> {
  let list = [...store];
  if (opts?.category) list = list.filter((m) => m.category === opts.category);
  list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return list.slice(0, opts?.limit ?? 10);
}
