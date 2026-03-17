import type { LLMClient } from "../clients/llmClient.js";
import type {
  CanonicalEvent,
  CanonicalMode,
  CanonicalConfig,
  ClassifierOutput,
  ScoreBundle,
  ThesisBundle,
  ValidationResult,
  StructuredRoast,
} from "./types.js";
import type { RelevanceResult } from "./relevanceScorer.js";
import type { StyleContext } from "../style/styleResolver.js";
import { calculateHybridBissigkeit } from "../style/styleResolver.js";
import { downgradeMode } from "./downgradeMatrix.js";
import {
  buildPrompt,
  promptToLLMInput,
  type PromptBuilderContext,
} from "./promptBuilder.js";
import { validateResponse } from "./validator.js";
import { attemptRepair } from "../validation/repairLayer.js";
import { checkLLMBudget, recordLLMCall } from "../state/sharedBudgetGate.js";
import { extractExpectedKeywords, shouldRefine } from "./refineChecker.js";
import { buildRefinePrompt } from "./refinePromptBuilder.js";
import {
  buildMasterPrompt,
  buildRefinePromptFullSpectrum,
} from "./fullSpectrumPromptBuilder.js";
import { loadPersonaSnippets } from "../persona/memorySnippets.js";
import { trimToLimit } from "../utils/textTrim.js";
import { getGnomesConfig } from "../config/gnomesConfig.js";
import { loadGnomes } from "../gnomes/loadGnomes.js";
import { getGnome } from "../gnomes/registry.js";
import type { GnomeSelectionResult } from "../routing/gnomeSelector.js";
import { extractSelectorFeatures } from "../routing/selectorFeatures.js";
import { resolveContinuity } from "../routing/continuityResolver.js";
import { selectGnome } from "../routing/gnomeSelector.js";
import { composeGnomePrompt } from "../prompts/composeGnomePrompt.js";
import { getCharacterMemoryStore } from "../memory/characterMemory.js";
import { createSharedLoreStore } from "../memory/sharedLoreStore.js";
import { createLoreStore } from "../memory/loreStore.js";

interface GenerateResult {
  reply_text: string;
  model_id: string;
  prompt_hash: string;
}

async function generate(
  llm: LLMClient,
  event: CanonicalEvent,
  mode: CanonicalMode,
  thesis: ThesisBundle,
  scores: ScoreBundle,
  config: CanonicalConfig,
  promptContext?: PromptBuilderContext,
): Promise<GenerateResult | null> {
  // Check budget before making LLM call
  const isThread = mode === "analyst_meme_lite" || mode === "skeptical_breakdown";
  const budgetCheck = await checkLLMBudget(isThread);
  
  if (!budgetCheck.allowed) {
    console.warn(`[BUDGET_GATE] Blocking LLM call for event ${event.event_id}: ${budgetCheck.skipReason}`);
    return null;
  }
  
  // Record the call before making it
  await recordLLMCall(isThread);
  
  const prompt = buildPrompt(event, mode, thesis, scores, config, promptContext);
  const llmInput = promptToLLMInput(prompt);

  const result = await llm.generateJSON<{ reply: string }>({
    system: llmInput.system,
    developer: llmInput.developer,
    user: llmInput.user,
    schemaHint: '{ "reply": "string" }',
  });

  const { stableHash } = await import("../utils/hash.js");
  const prompt_hash = stableHash(JSON.stringify(llmInput));

  return {
    reply_text: result.reply,
    model_id: config.model_id,
    prompt_hash,
  };
}

function normalizeToStructuredRoast(raw: unknown): StructuredRoast | null {
  let o = raw as Record<string, unknown>;
  if (o?.reply && typeof o.reply === "object" && !Array.isArray(o.reply)) {
    o = o.reply as Record<string, unknown>;
  }
  const text = (o?.roast_text as string) ?? (o?.reply as string) ?? (o?.reply_text as string);
  if (!text || typeof text !== "string") return null;
  return {
    roast_text: text,
    used_memes: Array.isArray(o?.used_memes) ? (o.used_memes as string[]) : [],
    bissigkeit_score: typeof o?.bissigkeit_score === "number" ? o.bissigkeit_score : 5,
    missed_keywords: Array.isArray(o?.missed_keywords) ? (o.missed_keywords as string[]) : [],
    needs_refine: Boolean(o?.needs_refine),
    critique_summary: typeof o?.critique_summary === "string" ? o.critique_summary : undefined,
  };
}

async function generateFullSpectrum(
  llm: LLMClient,
  event: CanonicalEvent,
  thesis: ThesisBundle,
  scores: ScoreBundle,
  config: CanonicalConfig,
  cls: ClassifierOutput,
  initialMode: CanonicalMode,
  promptContext?: FallbackCascadeContext,
): Promise<{ reply_text: string; model_id: string; prompt_hash: string; finalBissigkeit?: number; selectedGnomeId: string } | null> {
  const budgetCheck = await checkLLMBudget(false);
  if (!budgetCheck.allowed) {
    console.warn(`[BUDGET_GATE] Blocking Full Spectrum LLM for event ${event.event_id}: ${budgetCheck.skipReason}`);
    return null;
  }
  await recordLLMCall(false);

  const gnomesCfg = getGnomesConfig();
  let selectedGnomeId = gnomesCfg.DEFAULT_SAFE_GNOME;

  let input: { system: string; developer: string; user: string };

  if (gnomesCfg.GNOMES_ENABLED) {
    try {
      await loadGnomes();
      // Use pre-selection from pipeline when available (Phase-2: single selection point)
      const selection = promptContext?.gnomeSelection ?? (() => {
        const features = extractSelectorFeatures(cls, scores, event, {
          marketEnergy: promptContext?.style?.energyLevel ?? "MEDIUM",
        });
        return selectGnome(features, initialMode, {
          defaultSafeGnome: gnomesCfg.DEFAULT_SAFE_GNOME,
          enabled: true,
        });
      })();
      const continuity = resolveContinuity(
        selection.selectedGnomeId,
        { threadId: event.event_id },
        { continuityEnabled: gnomesCfg.GNOME_CONTINUITY_ENABLED },
      );
      selectedGnomeId = continuity.gnomeId;
      const profile = getGnome(selectedGnomeId);

      if (profile) {
        const sharedLoreStore = createSharedLoreStore(createLoreStore());
        const sharedLore = await sharedLoreStore.getFragments({ limit: 3 });
        const charMem = getCharacterMemoryStore();
        const memoryItems = await charMem.getItems({
          gnomeId: selectedGnomeId,
          userId: event.author_id,
          limit: 5,
        });
        const composed = composeGnomePrompt({
          selectedGnome: profile,
          sharedLore: sharedLore.map((f) => f.content),
          characterMemory: memoryItems.map((m) => m.content),
          threadContext: event.parent_text ?? undefined,
          responseMode: initialMode,
          event,
          thesis,
          scores,
          style: promptContext?.style,
          pattern_id: promptContext?.pattern_id,
          narrative_label: promptContext?.narrative_label,
        });
        input = { system: composed.system, developer: composed.developer, user: composed.user };
      } else {
        input = buildMasterPrompt(
          event,
          thesis,
          scores,
          promptContext?.relevanceResult,
          undefined,
          promptContext?.style,
          promptContext?.estimatedBissigkeit,
        );
      }
    } catch (err) {
      if (gnomesCfg.GNOME_ROUTING_DEBUG) {
        console.warn("[GNOMES] Fallback to legacy prompt after error:", err);
      }
      input = buildMasterPrompt(
        event,
        thesis,
        scores,
        promptContext?.relevanceResult,
        undefined,
        promptContext?.style,
        promptContext?.estimatedBissigkeit,
      );
    }
  } else {
    let personaSnippets: string[] | undefined;
    const isStandalone = !event.parent_text && (event.conversation_context?.length ?? 0) === 0;
    if (isStandalone) {
      try {
        const snippets = await loadPersonaSnippets();
        if (snippets.length > 0) {
          personaSnippets = snippets.map((s) => s.text);
        }
      } catch {
        // Snippets optional, continue without
      }
    }
    input = buildMasterPrompt(
      event,
      thesis,
      scores,
      promptContext?.relevanceResult,
      personaSnippets,
      promptContext?.style,
      promptContext?.estimatedBissigkeit,
    );
  }

  const raw = await llm.generateJSON<unknown>({
    system: input.system,
    developer: input.developer,
    user: input.user,
    schemaHint: "StructuredRoast",
  });

  const structured = normalizeToStructuredRoast(raw);
  if (!structured) return null;

  const finalBissigkeit = calculateHybridBissigkeit(
    structured.bissigkeit_score,
    scores.severity ?? 0,
    scores.opportunity ?? 0,
    scores.risk ?? 0,
    promptContext?.relevanceResult?.score ?? scores.relevance ?? 0.5,
  );
  if (Math.abs(finalBissigkeit - structured.bissigkeit_score) > 2.0) {
    console.warn(
      `[Bissigkeit] drift: LLM ${structured.bissigkeit_score} → Hybrid ${finalBissigkeit.toFixed(1)}`,
    );
  }

  let roastText = structured.roast_text;
  const needsRefine =
    structured.needs_refine ||
    roastText.length < 80 ||
    (structured.used_memes?.length ?? 0) < 2 ||
    structured.bissigkeit_score < 7;

  if (needsRefine) {
    const refineBudgetCheck = await checkLLMBudget(false);
    if (refineBudgetCheck.allowed) {
      await recordLLMCall(false);
      const refineInput = buildRefinePromptFullSpectrum(
        event,
        structured,
        thesis,
        scores,
        promptContext?.relevanceResult,
      );
      const refineRaw = await llm.generateJSON<unknown>({
        system: refineInput.system,
        developer: refineInput.developer,
        user: refineInput.user,
        temperature: 0.95,
        max_tokens: 400,
      });
      const refined = normalizeToStructuredRoast(refineRaw);
      if (refined?.roast_text) roastText = refined.roast_text;
    }
  }

  const { stableHash } = await import("../utils/hash.js");
  const prompt_hash = stableHash(JSON.stringify(input));

  return {
    reply_text: trimToLimit(roastText, 260),
    model_id: config.model_id,
    prompt_hash,
    finalBissigkeit,
    selectedGnomeId,
  };
}

export interface FallbackResult {
  success: boolean;
  reply_text: string | null;
  final_mode: CanonicalMode;
  model_id: string;
  prompt_hash: string | null;
  validation: ValidationResult | null;
  attempts: number;
  /** Post-LLM hybrid bissigkeit (Full Spectrum only) */
  finalBissigkeit?: number;
  /** Selected gnome id (when GNOMES_ENABLED) */
  selectedGnomeId?: string;
}

export interface FallbackCascadeContext {
  pattern_id?: string;
  narrative_label?: string;
  format_target?: string;
  /** Precomputed relevance score for refine step */
  relevanceResult?: RelevanceResult;
  /** Style context for savage/ultra/degen in Full Spectrum */
  style?: StyleContext;
  /** Pre-LLM estimated bissigkeit for prompt hint */
  estimatedBissigkeit?: number;
  /** Phase-2: Pre-selected gnome (from pipeline); skips internal selection */
  gnomeSelection?: GnomeSelectionResult;
}

export async function fallbackCascade(
  llm: LLMClient,
  event: CanonicalEvent,
  initialMode: CanonicalMode,
  thesis: ThesisBundle,
  scores: ScoreBundle,
  cls: ClassifierOutput,
  config: CanonicalConfig,
  promptContext?: FallbackCascadeContext,
): Promise<FallbackResult> {
  let currentMode = initialMode;
  let attempts = 0;
  const maxAttempts = config.retries.generation_attempts;

  if ((config as { full_spectrum_prompt?: boolean }).full_spectrum_prompt) {
    const gen = await generateFullSpectrum(llm, event, thesis, scores, config, cls, currentMode, promptContext);
    if (gen === null) {
      return {
        success: false,
        reply_text: null,
        final_mode: currentMode,
        model_id: config.model_id,
        prompt_hash: null,
        validation: null,
        attempts: 0,
      };
    }
    attempts = 1;
    const val = validateResponse(
      gen.reply_text,
      "neutral_clarification" as CanonicalMode,
      cls,
      config,
    );
    if (val.ok) {
      return {
        success: true,
        reply_text: gen.reply_text,
        final_mode: currentMode,
        model_id: gen.model_id,
        prompt_hash: gen.prompt_hash,
        validation: val,
        attempts,
        finalBissigkeit: gen.finalBissigkeit,
        selectedGnomeId: gen.selectedGnomeId,
      };
    }
    const repairEnabled = (config as { repair_enabled?: boolean }).repair_enabled ?? true;
    if (repairEnabled && val.repair_suggested) {
      const repairOut = attemptRepair({
        draft: gen.reply_text,
        mode: currentMode,
        cls,
        config,
        validation: val,
      });
      if (repairOut.repaired && repairOut.validation_after?.ok) {
        return {
          success: true,
          reply_text: repairOut.repaired,
          final_mode: currentMode,
          model_id: gen.model_id,
          prompt_hash: gen.prompt_hash,
          validation: repairOut.validation_after,
          attempts,
          finalBissigkeit: gen.finalBissigkeit,
          selectedGnomeId: gen.selectedGnomeId,
        };
      }
    }
    return {
      success: false,
      reply_text: null,
      final_mode: currentMode,
      model_id: gen.model_id,
      prompt_hash: gen.prompt_hash,
      validation: val,
      attempts,
      finalBissigkeit: gen.finalBissigkeit,
      selectedGnomeId: gen.selectedGnomeId,
    };
  }

  const gen1 = await generate(
    llm,
    event,
    currentMode,
    thesis,
    scores,
    config,
    promptContext,
  );
  
  // Budget gate blocked the call
  if (gen1 === null) {
    return {
      success: false,
      reply_text: null,
      final_mode: currentMode,
      model_id: config.model_id,
      prompt_hash: null,
      validation: null,
      attempts,
    };
  }
  
  attempts++;
  const val1 = validateResponse(gen1.reply_text, currentMode, cls, config);
  if (val1.ok) {
    const refineEnabled = (config as { refine_enabled?: boolean }).refine_enabled ?? true;
    const minLength = (config as { refine_min_length?: number }).refine_min_length ?? 80;
    const minKeywordCount = (config as { refine_keyword_min_count?: number }).refine_keyword_min_count ?? 1;

    const keywords = extractExpectedKeywords(event.text, thesis.evidence_bullets);
    const needsRefine = refineEnabled && shouldRefine(gen1.reply_text, keywords, minLength, minKeywordCount);

    if (needsRefine) {
      const budgetCheck = await checkLLMBudget(false);
      if (budgetCheck.allowed) {
        await recordLLMCall(false);
        attempts++;

        const rel = promptContext?.relevanceResult ?? {
          score: scores.relevance,
          components: { sentiment_intensity: 0.3 },
        };
        const refinePrompt = buildRefinePrompt({
          previousReply: gen1.reply_text,
          mentionText: event.text,
          context: event.parent_text ?? undefined,
          thesis: thesis.primary,
          thesisSupporting: thesis.supporting_point,
          relevanceScore: rel.score,
          sentimentIntensity: rel.components.sentiment_intensity,
          expectedKeywords: keywords,
        });

        const refined = await llm.generateJSON<{ reply?: string; reply_text?: string }>({
          system: refinePrompt.system,
          developer: refinePrompt.developer,
          user: refinePrompt.user,
          schemaHint: '{ "reply": "string" }',
          temperature: 0.9,
        });

        const refinedText = refined.reply ?? refined.reply_text ?? null;
        if (refinedText) {
          const valRefine = validateResponse(refinedText, currentMode, cls, config);
          if (valRefine.ok) {
            return {
              success: true,
              reply_text: refinedText,
              final_mode: currentMode,
              model_id: gen1.model_id,
              prompt_hash: gen1.prompt_hash,
              validation: valRefine,
              attempts,
            };
          }
        }
      }
    }

    return {
      success: true,
      reply_text: gen1.reply_text,
      final_mode: currentMode,
      model_id: gen1.model_id,
      prompt_hash: gen1.prompt_hash,
      validation: val1,
      attempts,
    };
  }

  const repairEnabled = (config as { repair_enabled?: boolean }).repair_enabled ?? true;
  if (repairEnabled && val1.repair_suggested) {
    const repairOut = attemptRepair({
      draft: gen1.reply_text,
      mode: currentMode,
      cls,
      config,
      validation: val1,
    });
    if (repairOut.repaired && repairOut.validation_after?.ok) {
      return {
        success: true,
        reply_text: repairOut.repaired,
        final_mode: currentMode,
        model_id: gen1.model_id,
        prompt_hash: gen1.prompt_hash,
        validation: repairOut.validation_after,
        attempts,
      };
    }
  }

  if (attempts < maxAttempts) {
    const gen2 = await generate(
      llm,
      event,
      currentMode,
      thesis,
      scores,
      config,
      promptContext,
    );
    
    // Budget gate blocked the call
    if (gen2 === null) {
      return {
        success: false,
        reply_text: null,
        final_mode: currentMode,
        model_id: gen1.model_id,
        prompt_hash: null,
        validation: null,
        attempts,
      };
    }
    
    attempts++;
    const val2 = validateResponse(gen2.reply_text, currentMode, cls, config);
    if (val2.ok) {
      return {
        success: true,
        reply_text: gen2.reply_text,
        final_mode: currentMode,
        model_id: gen2.model_id,
        prompt_hash: gen2.prompt_hash,
        validation: val2,
        attempts,
      };
    }
    if (repairEnabled && val2.repair_suggested) {
      const repairOut = attemptRepair({
        draft: gen2.reply_text,
        mode: currentMode,
        cls,
        config,
        validation: val2,
      });
      if (repairOut.repaired && repairOut.validation_after?.ok) {
        return {
          success: true,
          reply_text: repairOut.repaired,
          final_mode: currentMode,
          model_id: gen2.model_id,
          prompt_hash: gen2.prompt_hash,
          validation: repairOut.validation_after,
          attempts,
        };
      }
    }
  }

  const downgraded = downgradeMode(currentMode);
  if (downgraded === "ignore") {
    return {
      success: false,
      reply_text: null,
      final_mode: downgraded,
      model_id: gen1.model_id,
      prompt_hash: null,
      validation: null,
      attempts,
    };
  }

  currentMode = downgraded;
  const gen3 = await generate(
    llm,
    event,
    currentMode,
    thesis,
    scores,
    config,
    promptContext,
  );
  
  // Budget gate blocked the call
  if (gen3 === null) {
    return {
      success: false,
      reply_text: null,
      final_mode: currentMode,
      model_id: gen1.model_id,
      prompt_hash: null,
      validation: null,
      attempts,
    };
  }
  
  attempts++;
  const val3 = validateResponse(gen3.reply_text, currentMode, cls, config);
  if (val3.ok) {
    return {
      success: true,
      reply_text: gen3.reply_text,
      final_mode: currentMode,
      model_id: gen3.model_id,
      prompt_hash: gen3.prompt_hash,
      validation: val3,
      attempts,
    };
  }
  if (repairEnabled && val3.repair_suggested) {
    const repairOut = attemptRepair({
      draft: gen3.reply_text,
      mode: currentMode,
      cls,
      config,
      validation: val3,
    });
    if (repairOut.repaired && repairOut.validation_after?.ok) {
      return {
        success: true,
        reply_text: repairOut.repaired,
        final_mode: currentMode,
        model_id: gen3.model_id,
        prompt_hash: gen3.prompt_hash,
        validation: repairOut.validation_after,
        attempts,
      };
    }
  }

  return {
    success: false,
    reply_text: null,
    final_mode: currentMode,
    model_id: gen3.model_id,
    prompt_hash: null,
    validation: val3,
    attempts,
  };
}
