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
import { buildPrompt, promptToLLMInput } from "./promptBuilder.js";
import { validateResponse } from "./validator.js";

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
): Promise<GenerateResult> {
  const prompt = buildPrompt(event, mode, thesis, scores, config);
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

export async function fallbackCascade(
  llm: LLMClient,
  event: CanonicalEvent,
  initialMode: CanonicalMode,
  thesis: ThesisBundle,
  scores: ScoreBundle,
  cls: ClassifierOutput,
  config: CanonicalConfig,
): Promise<FallbackResult> {
  let currentMode = initialMode;
  let attempts = 0;
  const maxAttempts = config.retries.generation_attempts;

  const gen1 = await generate(llm, event, currentMode, thesis, scores, config);
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

  if (attempts < maxAttempts) {
    const gen2 = await generate(llm, event, currentMode, thesis, scores, config);
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
  const gen3 = await generate(llm, event, currentMode, thesis, scores, config);
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
