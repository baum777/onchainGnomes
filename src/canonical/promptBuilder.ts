import type {
  CanonicalEvent,
  CanonicalMode,
  CanonicalConfig,
  ThesisBundle,
  ScoreBundle,
  PromptContract,
  MarketEnergyLevel,
} from "./types.js";
import { getHardMax } from "./modeBudgets.js";
import type { StyleContext } from "../style/styleResolver.js";
import {
  getSlangGuidelines,
  getSavageSlangGuidelines,
  getUltraSavageGuidelines,
  getDegenRegardGuidelines,
} from "../style/styleResolver.js";

function deriveConfidenceStance(confidence: number): "low" | "medium" | "high" {
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.50) return "medium";
  return "low";
}

const BASE_RULES: string[] = [
  "Roast content, never identity.",
  "No financial advice.",
  "Do not invent facts.",
  "Stay concise.",
  "No wallet addresses.",
  "One thesis only — do not stack arguments.",
];

const MODE_STYLE_HINTS: Record<Exclude<CanonicalMode, "ignore">, string> = {
  dry_one_liner: "Deliver one cold, compact observation with a punchline. No setup, no thread energy.",
  analyst_meme_lite: "Blend concise analysis with crypto-native wit. Framing sentence + evidence-backed criticism + compact sting.",
  skeptical_breakdown: "Present 2-3 compact reasons why the claim is weak. Structured skepticism, no melodrama.",
  hard_caution: "Flag serious manipulation or deception with controlled, crisp language. Speak in signals and patterns.",
  neutral_clarification: "Correct the record with minimal heat. Clean, short, slight edge allowed.",
  soft_deflection: "Dismiss without overcommitting. Sparse, non-committal, safe.",
  social_banter: "Reply casually and in-character. Warm but concise. Match the energy of the greeting.",
  market_banter: "Share a brief, opinionated market take. Crypto-native tone, no financial advice. Keep it punchy.",
  persona_reply: "Answer in-character about who you are. Stay persona-consistent, brief, slightly mysterious.",
  lore_drop: "Share a piece of lore or backstory. In-character, evocative, compact.",
  conversation_hook: "Reply with a short hook that invites further conversation. Casual, in-character.",
};

export interface PromptBuilderContext {
  pattern_id?: string;
  narrative_label?: string;
  format_target?: string;
  /** Style context for energy-based modulation */
  style?: StyleContext;
}

export function buildPrompt(
  event: CanonicalEvent,
  mode: CanonicalMode,
  thesis: ThesisBundle,
  scores: ScoreBundle,
  config: CanonicalConfig,
  context?: PromptBuilderContext,
): PromptContract {
  const charBudget = getHardMax(mode);
  const confidenceStance = deriveConfidenceStance(scores.confidence);

  const rules = [
    ...BASE_RULES,
    `Max ${charBudget} characters.`,
  ];

  if (mode !== "ignore") {
    rules.push(`Style: ${MODE_STYLE_HINTS[mode]}`);
  }

  // Add energy-based style hints if slang mode is active
  if (context?.style?.slangEnabled && context.style.traitHints.length > 0) {
    rules.push(`Energy tone: ${context.style.traitHints.join("; ")}`);
  }

  const prompt: PromptContract = {
    persona: config.persona_name,
    mode,
    thesis: thesis.primary,
    supporting_point: thesis.supporting_point,
    evidence_bullets: thesis.evidence_bullets,
    rules,
    char_budget: charBudget,
    confidence_stance: confidenceStance,
    target_text: event.text,
    parent_text: event.parent_text,
    pattern_id: context?.pattern_id,
    narrative_label: context?.narrative_label,
    format_target: context?.format_target,
    energy_level: context?.style?.energyLevel,
    slang_mode: context?.style?.slangEnabled,
    savage_horny_slang: context?.style?.savage_horny_slang,
    ultra_savage: context?.style?.ultra_savage,
    degen_regard: context?.style?.degen_regard,
    style_hints: context?.style?.traitHints,
  };

  // Carry over system prompt override and aggressive flags for the test bridge
  if ((config as any).system_prompt_override) {
    (prompt as any).system_prompt_override = (config as any).system_prompt_override;
  }
  if (config.aggressive_mode) {
    (prompt as any).aggressive_mode = config.aggressive_mode;
  }

  return prompt;
}

export function promptToLLMInput(prompt: PromptContract): {
  system: string;
  developer: string;
  user: string;
} {
  // Check for system prompt override (from test bundle)
  const systemOverride = (prompt as any).system_prompt_override;
  const mode = (prompt as any).aggressive_mode;
  const isAggressive = mode === "analyst" || mode === "horny";
  
  let aggressiveNote: string | null = null;
  if (mode === "analyst") {
    aggressiveNote = "AGGRESSIVE ANALYST MODE: Be extremely sarcastic, dry, and brief. Use the user's EXACT words (like 'no product', 'concentrated', 'nothing', 'slippage') to mock them. DO NOT use synonyms. If the user says 'concentrated', you say 'concentrated'. Mirror their language with zero creative variation.";
  } else if (mode === "horny") {
    aggressiveNote = "AGGRESSIVE HORNY MODE: High energy, crypto-slang heavy, chaotic. Use the user's EXACT words to roast them. DO NOT use synonyms. If they use a keyword, repeat it back to them in a mocking context. Zero filter, maximum mirroring.";
  }

  const systemParts = systemOverride ? [systemOverride] : [
    `You are ${prompt.persona}, a crypto-native analytical commentator.`,
    "Persona: Dry, detached, mildly sarcastic. Meme-aware but subtle.",
    aggressiveNote,
    "Role: Roast ideas, narratives, cycle behavior, market psychology. Never people.",
    "Structure: Observation (neutral fact) → Insight (analytical implication) → Light Roast (mild punchline).",
    "",
    `Response mode: ${prompt.mode}`,
    `Thesis: ${prompt.thesis}`,
    prompt.supporting_point ? `Supporting: ${prompt.supporting_point}` : null,
    prompt.pattern_id ? `Selected pattern: ${prompt.pattern_id}` : null,
    prompt.narrative_label ? `Narrative: ${prompt.narrative_label}` : null,
    prompt.format_target ? `Format: ${prompt.format_target}` : null,
    prompt.energy_level ? `Energy level: ${prompt.energy_level}` : null,
    `Confidence: ${prompt.confidence_stance}`,
    "",
    "Rules:",
    ...prompt.rules.map((r) => `- ${r}`),
  ];

  // Append slang guidelines when slang mode is active
  if (prompt.slang_mode && !systemOverride) {
    systemParts.push("", "SLANG MODE ACTIVE:", getSlangGuidelines());
  }

  // Savage horny-slang block (EXTREME + bissigkeit >= 8)
  if (prompt.savage_horny_slang && !systemOverride) {
    systemParts.push("", getSavageSlangGuidelines());
  }

  // Ultra-savage block (EXTREME + bissigkeit > 9.2)
  if (prompt.ultra_savage && !systemOverride) {
    systemParts.push("", getUltraSavageGuidelines());
  }

  // Degen/Regard block (chaotic meme-coin)
  if (prompt.degen_regard && !systemOverride) {
    systemParts.push("", getDegenRegardGuidelines());
  }

  const system = systemParts.filter(Boolean).join("\n");

  const developer = [
    "Write exactly one reply matching the selected mode.",
    "Use the thesis provided. Do not add unsupported claims.",
    isAggressive ? "STRICT MIRRORING: Use the user's EXACT terminology from the target tweet. Avoid all synonyms. If they used a specific term, that term MUST appear in your response." : null,
    `Stay under ${prompt.char_budget} characters.`,
    "Return JSON: { \"reply\": \"<your reply text>\" }",
  ].filter(Boolean).join("\n");

  const user = [
    "Target tweet:",
    prompt.target_text,
    prompt.parent_text ? `\nParent tweet:\n${prompt.parent_text}` : "",
    prompt.evidence_bullets.length > 0
      ? `\nEvidence:\n${prompt.evidence_bullets.map((b) => `- ${b}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, developer, user };
}
