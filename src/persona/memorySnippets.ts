/**
 * Persona Memory Snippets — globale Roast-Muster aus Audit-Extraktion.
 * Max 5–8 Snippets, nur bei Standalone-Mentions in den Prompt eingebunden.
 */
import { getStateStore } from "../state/storeFactory.js";
import { logInfo, logWarn } from "../ops/logger.js";

/** Redis/StateStore Key (Prefix gorkypf: wird vom Store hinzugefügt) */
const SNIPPETS_KEY = "persona:memory:snippets";
const MAX_SNIPPETS = 6;

export interface Snippet {
  text: string;
  createdAt: string;
  sourceCount: number;
}

export async function loadPersonaSnippets(): Promise<Snippet[]> {
  const store = getStateStore();
  try {
    const raw = await store.get(SNIPPETS_KEY);
    return raw ? (JSON.parse(raw) as Snippet[]) : [];
  } catch (err) {
    logWarn("[PersonaSnippets] Failed to load", { err });
    return [];
  }
}

export async function savePersonaSnippets(snippets: Snippet[]): Promise<void> {
  const store = getStateStore();
  try {
    const limited = snippets.slice(0, MAX_SNIPPETS);
    await store.set(SNIPPETS_KEY, JSON.stringify(limited));
  } catch (err) {
    logWarn("[PersonaSnippets] Failed to save", { err });
  }
}

export async function addOrUpdateSnippets(newSnippets: string[]): Promise<void> {
  const existing = await loadPersonaSnippets();
  const now = new Date().toISOString();

  for (const text of newSnippets) {
    if (!text.trim()) continue;
    const idx = existing.findIndex((s) => s.text === text);
    const item = idx >= 0 ? existing[idx] : undefined;
    if (item) {
      item.sourceCount += 1;
      item.createdAt = now;
    } else {
      existing.push({ text, createdAt: now, sourceCount: 1 });
    }
  }

  existing.sort(
    (a, b) =>
      b.sourceCount - a.sourceCount || b.createdAt.localeCompare(a.createdAt),
  );

  await savePersonaSnippets(existing);
  logInfo("[PersonaSnippets] Updated", {
    added: newSnippets.length,
    total: existing.length,
  });
}

/**
 * Baut den Persona-Memory-Block für den System-Prompt.
 * Leer wenn keine Snippets vorhanden.
 */
export function buildPersonaMemoryPrompt(snippets: Snippet[]): string {
  if (snippets.length === 0) return "";
  const lines = snippets.map((s) => `• ${s.text}`);
  return `Gorky weiß aus den letzten Tagen und typischen CT-Mustern:\n${lines.join("\n")}\n\n`;
}
