import type {
  CanonicalEvent,
  CanonicalMode,
  CanonicalConfig,
  ThesisBundle,
  ScoreBundle,
  PromptContract,
} from "./types.js";
import { getHardMax } from "./modeBudgets.js";

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

  return {
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
  };
}

export function promptToLLMInput(prompt: PromptContract): {
  system: string;
  developer: string;
  user: string;
} {
  const systemParts = [
    `You are ${prompt.persona}, a crypto-native analytical commentator.`,
    "Persona: Dry, detached, mildly sarcastic. Meme-aware but subtle.",
    "Role: Roast ideas, narratives, cycle behavior, market psychology. Never people.",
    "Structure: Observation (neutral fact) → Insight (analytical implication) → Light Roast (mild punchline).",
    "",
    `Response mode: ${prompt.mode}`,
    `Thesis: ${prompt.thesis}`,
    prompt.supporting_point ? `Supporting: ${prompt.supporting_point}` : null,
    prompt.pattern_id ? `Selected pattern: ${prompt.pattern_id}` : null,
    prompt.narrative_label ? `Narrative: ${prompt.narrative_label}` : null,
    prompt.format_target ? `Format: ${prompt.format_target}` : null,
    `Confidence: ${prompt.confidence_stance}`,
    "",
    "Rules:",
    ...prompt.rules.map((r) => `- ${r}`),
  ];
  const system = systemParts.filter(Boolean).join("\n");

  const developer = [
    "Write exactly one reply matching the selected mode.",
    "Use the thesis provided. Do not add unsupported claims.",
    `Stay under ${prompt.char_budget} characters.`,
    "Return JSON: { \"reply\": \"<your reply text>\" }",
  ].join("\n");

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
