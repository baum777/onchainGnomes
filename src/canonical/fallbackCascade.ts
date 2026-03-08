import type { LLMClient } from "../clients/llmClient.js";
import type {
  CanonicalEvent,
  CanonicalMode,
  CanonicalConfig,
  ClassifierOutput,
  ScoreBundle,
  ThesisBundle,
  ValidationResult,
} from "./types.js";
import { downgradeMode } from "./downgradeMatrix.js";
import {
  buildPrompt,
  promptToLLMInput,
  type PromptBuilderContext,
} from "./promptBuilder.js";
import { validateResponse } from "./validator.js";
import { attemptRepair } from "../validation/repairLayer.js";
import { checkLLMBudget, recordLLMCall } from "../safety/budgetGate.js";

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
  const budgetCheck = checkLLMBudget(isThread);
  
  if (!budgetCheck.allowed) {
    console.warn(`[BUDGET_GATE] Blocking LLM call for event ${event.event_id}: ${budgetCheck.skipReason}`);
    return null;
  }
  
  // Record the call before making it
  recordLLMCall(isThread);
  
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

export interface FallbackResult {
  success: boolean;
  reply_text: string | null;
  final_mode: CanonicalMode;
  model_id: string;
  prompt_hash: string | null;
  validation: ValidationResult | null;
  attempts: number;
}

export interface FallbackCascadeContext {
  pattern_id?: string;
  narrative_label?: string;
  format_target?: string;
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
