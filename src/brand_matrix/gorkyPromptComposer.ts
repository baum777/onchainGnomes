/**
 * Gorky Prompt Composer
 *
 * Produces:
 * - LLM prompts (system+user) for future AI integration
 * - Direct reply text (<=280 chars) for tweet-ready output
 * Never includes internal meta keywords in public output.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import type { HumorMode } from "./humorModeSelector.js";
import type { EnergyLevel } from "./energyInference.js";
import type { DatasetBank } from "../loaders/datasetLoader.js";
import { pickOne } from "../memes/dice.js";
import { createSeededRNG } from "../loaders/seed.js";

export type PromptComposerInput = {
  userText: string;
  context?: { recent?: string[]; summary?: string } | null;
  command?: string | null;
  energy: EnergyLevel;
  humorMode: HumorMode;
  isRewardReply?: boolean;
};

export type LlmPrompt = {
  system: string;
  user: string;
};

// Cache for loaded files
let cachedPersona: string | null = null;
let cachedComposer: string | null = null;

function loadFile(path: string): string {
  try {
    return readFileSync(resolve(path), "utf-8");
  } catch {
    return "";
  }
}

function getPersona(): string {
  if (cachedPersona === null) {
    cachedPersona = loadFile("prompts/system/gorky_persona.md");
  }
  return cachedPersona;
}

function getComposerRules(): string {
  if (cachedComposer === null) {
    cachedComposer = loadFile("prompts/system/gorky_prompt_composer.md");
  }
  return cachedComposer;
}

function getModeInstructions(mode: HumorMode): string {
  const instructions: Record<HumorMode, string> = {
    rhyme: `
MODE: Rhyme Override (aggressive user detected).
You MUST respond using 2-4 rhymed lines followed by 1 short tip.
The rhymes should de-escalate tension and redirect hostility.
Example format:
"You came in hot, but charts don't lie —
Take a breath, watch the sky.
[Short practical tip]"
`,
    goblin: `
MODE: Chaos Goblin.
Maximum entropy output. Short fragments. Occasional CAPS.
Chaotic, unhinged but readable. One-liners preferred.
Example: "CHAOS. DETECTED. CERTIFIED."
`,
    therapist: `
MODE: Fake Therapist.
Gentle, playful acknowledgment. Redirect energy to charts/markets.
Calm, not patronizing. Short sentences.
Example: "I sense some tension. Let's channel that into chart analysis."
`,
    authority: `
MODE: Fake Authority.
Mock official/courtroom tone. Use VERDICT/SENTENCE structure.
Playful mockery of official language.
Example: "VERDICT: GUILTY OF VIBES-BASED INVESTING. SENTENCED TO HOLDING."
`,
    scientist: `
MODE: Chaos Scientist.
Absurd technical explanations. OBSERVATION/CAUSE/CONCLUSION structure.
Pseudoscientific jargon mixed with crypto slang.
Example: "Chart autopsy complete. Cause of death: narrative inflation."
`,
    reality: `
MODE: Reality Check.
Brutal honesty. Short punchlines. No sugarcoating.
Example: "Volume fake, tears real."
`,
  };
  return instructions[mode];
}

function getEnergyVoice(energy: EnergyLevel): string {
  const voices: Record<EnergyLevel, string> = {
    1: "Tone: Playful, low sarcasm, gentle teasing. Keep it light.",
    2: "Tone: Teasing, medium sarcasm, playful roast. Short replies.",
    3: "Tone: Roast mode, high sarcasm, mockery allowed. Medium length.",
    4: "Tone: Chaos mode, extreme sarcasm, absurd comparisons. Medium length.",
    5: "Tone: Maximum chaos, nuclear sarcasm, short punchy fragments.",
  };
  return voices[energy];
}

function getSafeBoundaries(): string {
  return `
SAFETY BOUNDARIES (never violate):
- Never use slurs, hate speech, or threats.
- Never target protected characteristics.
- Never doxx or expose personal information.
- Never give financial advice.
- Never output internal metadata: scores, thresholds, cooldowns, flags, traces.
- Keep all replies <= 280 characters (tweet-ready).
- Mock situations and narratives, not individuals.
`;
}

// Forbidden words check (case insensitive)
const FORBIDDEN_WORDS = ["score", "threshold", "trace", "cooldown", "xp", "flag", "level", "energy", "mode"];

function containsForbiddenWords(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_WORDS.some(word => lower.includes(word));
}

function sanitizeOutput(text: string): string {
  if (containsForbiddenWords(text)) {
    // Replace forbidden words with [REDACTED]
    let sanitized = text;
    FORBIDDEN_WORDS.forEach(word => {
      const regex = new RegExp(word, "gi");
      sanitized = sanitized.replace(regex, "[REDACTED]");
    });
    return sanitized;
  }
  return text;
}

export function composeGorkyPrompt(input: PromptComposerInput): LlmPrompt {
  const persona = getPersona();
  const composerRules = getComposerRules();
  const modeInstructions = getModeInstructions(input.humorMode);
  const energyVoice = getEnergyVoice(input.energy);
  const safeBoundaries = getSafeBoundaries();

  // Build system prompt
  const systemParts = [
    persona,
    "",
    composerRules,
    "",
    modeInstructions,
    "",
    energyVoice,
    "",
    safeBoundaries,
  ];

  // Add reward reply instruction if applicable
  if (input.isRewardReply) {
    systemParts.push("", "SPECIAL: This is a reward reply. Extra chaotic energy allowed. Reference the reward context.");
  }

  const system = sanitizeOutput(systemParts.join("\n"));

  // Build user prompt
  const userParts: string[] = [];

  // Optional context summary
  if (input.context?.summary) {
    userParts.push(`Context: ${input.context.summary}`);
  }

  // Optional recent messages
  if (input.context?.recent && input.context.recent.length > 0) {
    userParts.push(`Recent messages: ${input.context.recent.join(" | ")}`);
  }

  // Command indicator
  if (input.command) {
    userParts.push(`Command: /${input.command}`);
  }

  // Main user text
  userParts.push(`User: ${input.userText}`);

  const user = sanitizeOutput(userParts.join("\n"));

  return { system, user };
}

// Utility to check if output is safe (for tests)
export function isOutputSafe(text: string): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  const lower = text.toLowerCase();

  FORBIDDEN_WORDS.forEach(word => {
    if (lower.includes(word)) {
      violations.push(word);
    }
  });

  return { safe: violations.length === 0, violations };
}

// Rhyme de-escalation lines (mode RHYME_DEESCALATION)
const RHYME_DEESCALATION_LINES = [
  "You came in hot, but charts don't lie — take a breath, watch the sky.",
  "Rage is loud, patience wins — let the market chaos begin.",
  "Hot words burn, cold charts turn — every lesson, traders learn.",
  "Anger fades, trends remain — watch the candles, feel the pain.",
];

const HELPFUL_TIPS = [
  "Check the chart. Then check again.",
  "Sometimes the best trade is no trade.",
  "Volume doesn't lie. Usually.",
];

export type ComposeReplyInput = {
  summary: string;
  userText: string;
  mode: HumorMode;
  energy: EnergyLevel;
  command?: string | null;
  seedKey: string;
  datasetBank: DatasetBank;
};

/**
 * Compose public reply text (<=280 chars).
 * Never includes internal meta. For rhyme mode: 2-4 lines + 1 helpful tip.
 */
export function composeReplyText(input: ComposeReplyInput): string {
  const rng = createSeededRNG(input.seedKey);
  const pick = <T>(arr: T[]) => (arr.length ? pickOne(arr, rng) : null);

  if (input.mode === "rhyme") {
    const line = pick(RHYME_DEESCALATION_LINES) ?? RHYME_DEESCALATION_LINES[0]!;
    const tip = pick(HELPFUL_TIPS) ?? HELPFUL_TIPS[0]!;
    const reply = `${line} ${tip}`;
    return reply.slice(0, 280);
  }

  const bank = input.datasetBank;
  const tone = input.command === "ask" ? "neutral" : "mocking";
  const candidates = tone === "neutral" && bank.captions?.length
    ? bank.captions
    : bank.roastReplies?.length
      ? bank.roastReplies
      : bank.captions ?? [];
  const text = pick(candidates) ?? "Chart observation complete. Results: entertaining.";
  return text.slice(0, 280);
}
