/**
 * Prompt Fragments — Load global safety, shared canon, gnome-specific fragments
 *
 * Fragment order: globalSafety -> sharedCanon -> gnome-specific
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Resolve prompts root (repo root / prompts when running from dist, fallback to cwd) */
function getPromptsRoot(): string {
  // When built, __dirname is dist/prompts; go up to repo root
  const distPrompts = join(__dirname, "..", "..", "prompts");
  if (existsSync(distPrompts)) return distPrompts;
  return join(process.cwd(), "prompts");
}

const FRAGMENTS_DIR = "fragments";

/**
 * Load fragment by path relative to prompts/fragments/.
 * Returns empty string if file not found.
 */
export function loadFragment(relativePath: string): string {
  const root = getPromptsRoot();
  const fullPath = join(root, FRAGMENTS_DIR, relativePath);
  try {
    return readFileSync(fullPath, "utf-8").trim();
  } catch {
    return "";
  }
}

/** Load global safety rules (always included) */
export function loadGlobalSafety(): string {
  return loadFragment("globalSafety.md") || "Roast content, never identity. No financial advice.";
}

/** Load shared canon (civilization lore, shared rules) */
export function loadSharedCanon(): string {
  return loadFragment("sharedCanon.md");
}

/** Load gnome-specific persona fragment by gnome id */
export function loadGnomeFragment(gnomeId: string): string {
  const content = loadFragment(`gnomes/${gnomeId}.md`);
  if (content) return content;
  return "";
}
