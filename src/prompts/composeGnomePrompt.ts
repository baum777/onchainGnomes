/**
 * Compose Gnome Prompt — Build prompt from global + shared + gnome + event context
 *
 * Used when GNOMES_ENABLED=true. Composes:
 * - global_rules (safety)
 * - shared_canon
 * - selected_gnome_profile
 * - user_relation_context (optional)
 * - event_analysis
 * - response_mode
 */

import type { GnomeProfile } from "../gnomes/types.js";
import type { CanonicalEvent, CanonicalMode, ThesisBundle, ScoreBundle } from "../canonical/types.js";
import type { StyleContext } from "../style/styleResolver.js";
import { getHardMax } from "../canonical/modeBudgets.js";
import {
  loadGlobalSafety,
  loadSharedCanon,
  loadGnomeFragment,
} from "./promptFragments.js";
import { getActiveLoreForRole } from "../lore/matrixLoreUnits.js";

export interface GnomeRuntimeContext {
  selectedGnome: GnomeProfile;
  userProfile?: { familiarity?: number } | null;
  relationshipContext?: unknown;
  sharedLore: string[];
  characterMemory: string[];
  threadContext?: string | null;
  responseMode: CanonicalMode;
  event: CanonicalEvent;
  thesis: ThesisBundle;
  scores: ScoreBundle;
  style?: StyleContext;
  pattern_id?: string;
  narrative_label?: string;
}

export interface ComposedGnomePrompt {
  system: string;
  developer: string;
  user: string;
  char_budget: number;
}

const MODE_STYLE_HINTS: Record<Exclude<CanonicalMode, "ignore">, string> = {
  dry_one_liner: "One cold, compact observation. No setup.",
  analyst_meme_lite: "Blend analysis with crypto wit. Evidence + sting.",
  skeptical_breakdown: "2-3 compact reasons why the claim is weak.",
  hard_caution: "Flag manipulation with controlled, crisp language.",
  neutral_clarification: "Correct the record with minimal heat.",
  soft_deflection: "Dismiss without overcommitting.",
  social_banter: "Reply casually and in-character.",
  market_banter: "Brief opinionated market take. No financial advice.",
  persona_reply: "Answer in-character. Brief, slightly mysterious.",
  lore_drop: "Share lore or backstory. Evocative, compact.",
  conversation_hook: "Short hook that invites further conversation.",
};

/**
 * Compose full LLM prompt from gnome context.
 */
export function composeGnomePrompt(ctx: GnomeRuntimeContext): ComposedGnomePrompt {
  const charBudget = getHardMax(ctx.responseMode);
  const globalSafety = loadGlobalSafety();
  const sharedCanon = loadSharedCanon();
  const gnomeFragment = loadGnomeFragment(ctx.selectedGnome.id) || ctx.selectedGnome.persona_fragment || "";

  const parts: string[] = [globalSafety];

  if (sharedCanon) {
    parts.push("", "Shared canon:", sharedCanon);
  }

  if (gnomeFragment) {
    parts.push("", `You are ${ctx.selectedGnome.name} (${ctx.selectedGnome.role}).`, gnomeFragment);
  }

  if (ctx.selectedGnome.safety_boundaries?.length) {
    parts.push("", "Safety (never override):", ...ctx.selectedGnome.safety_boundaries.map((b) => `- ${b}`));
  }

  const modeHint = ctx.responseMode !== "ignore" ? MODE_STYLE_HINTS[ctx.responseMode] : "";
  if (modeHint) {
    parts.push("", `Mode: ${ctx.responseMode} — ${modeHint}`);
  }

  parts.push("", `Max ${charBudget} characters.`);
  parts.push("", `Thesis: ${ctx.thesis.primary}`);
  if (ctx.thesis.supporting_point) parts.push(`Supporting: ${ctx.thesis.supporting_point}`);
  if (ctx.pattern_id) parts.push(`Pattern: ${ctx.pattern_id}`);
  if (ctx.narrative_label) parts.push(`Narrative: ${ctx.narrative_label}`);

  if (ctx.characterMemory.length > 0) {
    parts.push("", "Recent context:", ...ctx.characterMemory.map((m) => `• ${m}`));
  }

  const loreBudget = ctx.responseMode === "hard_caution" || ctx.responseMode === "neutral_clarification" ? 1 : 2;
  const activeLore = getActiveLoreForRole(ctx.selectedGnome.id, loreBudget);
  if (activeLore.length) {
    parts.push("", "Active lore cues:", ...activeLore.map((m) => `• ${m}`));
  }

  if (ctx.style?.slangEnabled && ctx.style.traitHints?.length) {
    parts.push("", `Energy: ${ctx.style.traitHints.join("; ")}`);
  }

  const system = parts.filter(Boolean).join("\n");

  const developer = [
    "Return JSON only: { \"reply\": \"<text>\" } or { \"roast_text\": \"<text>\", \"bissigkeit_score\": <0-10>, ... }",
    `Stay under ${charBudget} characters.`,
  ].join("\n");

  const userParts = ["Target:", ctx.event.text];
  if (ctx.event.parent_text) userParts.push("", "Thread:", ctx.event.parent_text);
  if (ctx.thesis.evidence_bullets.length) {
    userParts.push("", "Evidence:", ...ctx.thesis.evidence_bullets.map((b) => `- ${b}`));
  }
  const user = userParts.join("\n");

  return {
    system,
    developer,
    user,
    char_budget: charBudget,
  };
}
