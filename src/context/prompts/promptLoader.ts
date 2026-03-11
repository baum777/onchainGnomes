/**
 * Prompt Loader — Load and render GORKY_ON_SOL persona prompt templates
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GORKY_PROMPTS_DIR = join(__dirname, "GORKY_ON_SOL");

export interface PromptVariables {
  mention_text: string;
  thread_summary: string;
  entities: string;
  claims: string;
  timeline: string;
  constraints: string;
}

export function loadGorkySystemPrompt(): string {
  return readFileSync(join(GORKY_PROMPTS_DIR, "GORKY_ON_SOL_system.md"), "utf-8").trim();
}

export function loadGorkyDeveloperPrompt(): string {
  return readFileSync(join(GORKY_PROMPTS_DIR, "GORKY_ON_SOL_developer.md"), "utf-8").trim();
}

export function loadGorkyUserTemplate(): string {
  return readFileSync(join(GORKY_PROMPTS_DIR, "GORKY_ON_SOL_user_template.md"), "utf-8").trim();
}

export function renderUserPrompt(vars: PromptVariables): string {
  const template = loadGorkyUserTemplate();
  return template
    .replace(/\{\{mention_text\}\}/g, vars.mention_text)
    .replace(/\{\{thread_summary\}\}/g, vars.thread_summary)
    .replace(/\{\{entities\}\}/g, vars.entities)
    .replace(/\{\{claims\}\}/g, vars.claims)
    .replace(/\{\{timeline\}\}/g, vars.timeline)
    .replace(/\{\{constraints\}\}/g, vars.constraints);
}
