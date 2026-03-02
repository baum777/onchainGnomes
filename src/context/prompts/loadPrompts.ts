/**
 * Gorky Prompts Loader — Load .md files and render templates
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GORKY_DIR = join(__dirname, "gorky");

export async function loadGorkyPrompts(): Promise<{
  system: string;
  developer: string;
  userTemplate: string;
}> {
  const system = readFileSync(join(GORKY_DIR, "gorky_system.md"), "utf-8").trim();
  const developer = readFileSync(
    join(GORKY_DIR, "gorky_developer.md"),
    "utf-8"
  ).trim();
  const userTemplate = readFileSync(
    join(GORKY_DIR, "gorky_user_template.md"),
    "utf-8"
  ).trim();
  return { system, developer, userTemplate };
}

export function render(
  template: string,
  vars: Record<string, string>
): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v ?? "");
  }
  return out;
}
