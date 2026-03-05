/**
 * Reply Engine - Pipeline Orchestration
 *
 * Complete pipeline flow:
 * mention event → context builder → intent detection → truth gate →
 * persona router → memory retrieval → LLM generation (N candidates) →
 * candidate selector → safety guard → memory writeback → publish reply
 *
 * Handles error recovery, tracing, and pipeline stage management.
 */

import type { LLMClient } from "../clients/llmClient.js";
import type { XReadClient } from "../clients/xReadClient.js";
import type {
  ReplyEngineInput,
  ReplyEngineOutput,
  PipelineTrace,
  PipelineStage,
  PipelineStageResult,
  ReplyCandidate,
  MemoryRetrievalResult,
  UserRelationship,
  LegacyLoreEntry,
} from "../types/coreTypes.js";
import type { ContextBundle, ThreadContext, TimelineBrief } from "../context/types.js";
import { buildThreadContext, type ContextBuilderDeps } from "../context/contextBuilder.js";
import { detectIntent, type IntentDetectionDeps } from "../intent/detectIntent.js";
import { categorizeResponse } from "../truth/truthGate.js";
import {
  selectPersonaMode,
  buildRoutingCriteria,
  determineTopicSeriousness,
  type RoutingCriteria,
} from "../persona/personaRouter.js";
import { enforcePersonaGuardrails, detectPanicState } from "../persona/personaGuardrails.js";
import { generateCandidates, type GenerationDeps } from "../generation/generateCandidates.js";
import { selectBest, type SelectionDeps } from "../selector/selectBest.js";
import { RepetitionGuard } from "../selector/repetitionGuard.js";
import { createLoreStore, LoreStore, seedLore } from "../memory/loreStore.js";
import { createFactsStore, FactsStore } from "../memory/factsStore.js";
import { createUserGraph, UserGraph } from "../memory/userGraph.js";
import { performWriteback } from "../memory/writeback.js";
import { stableHash } from "../utils/hash.js";
import { shouldSkipLLM } from "../ops/launchGate.js";

export interface ReplyEngineDeps {
  llm: LLMClient;
  xread: XReadClient;
  loreStore?: LoreStore;
  factsStore?: FactsStore;
  userGraph?: UserGraph;
  repetitionGuard?: RepetitionGuard;
}

export interface ReplyEngineConfig {
  candidateCount: number;
  maxThreadDepth: number;
  enableTimelineScout: boolean;
  defaultUserRelationship: UserRelationship;
}

/**
 * Main entry point: processes a mention and generates a reply.
 */
export async function processMention(
  deps: ReplyEngineDeps,
  input: ReplyEngineInput,
  config?: Partial<ReplyEngineConfig>
): Promise<ReplyEngineOutput> {
  const fullConfig: ReplyEngineConfig = {
    candidateCount: input.controls.candidate_count,
    maxThreadDepth: input.controls.max_thread_depth,
    enableTimelineScout: input.controls.enable_timeline_scout,
    defaultUserRelationship: "new",
    ...config,
  };

  // LAUNCH_MODE=off: skip LLM, return safe refusal
  if (shouldSkipLLM()) {
    return {
      reply_text: "Chart observation paused. My circuits are in standby — try again later.",
      selected_candidate: {
        candidate_id: "launch_off",
        reply_text: "Chart observation paused. My circuits are in standby — try again later.",
        mode: "analyst",
        risk: "low",
        truth_category: "OPINION",
        estimated_length: 65,
      },
      trace: {
        request_id: generateRequestId(input.mention.tweet_id),
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        stages: [{
          stage: "context_build",
          success: true,
          data: { action: "refuse" },
          duration_ms: 0,
          timestamp: new Date().toISOString(),
        }],
        final_reply: "Chart observation paused. My circuits are in standby — try again later.",
        selected_candidate: {
          candidate_id: "launch_off",
          reply_text: "Chart observation paused. My circuits are in standby — try again later.",
          mode: "analyst",
          risk: "low",
          truth_category: "OPINION",
          estimated_length: 65,
        },
        errors: [],
        warnings: ["LAUNCH_MODE=off, LLM not invoked"],
      },
    };
  }

  // Initialize request tracing
  const requestId = generateRequestId(input.mention.tweet_id);
  const startedAt = new Date().toISOString();
  const stages: PipelineStageResult<unknown>[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // Initialize stores if not provided
  const loreStore = deps.loreStore || createLoreStore();
  const factsStore = deps.factsStore || createFactsStore();
  const userGraph = deps.userGraph || createUserGraph();
  const repetitionGuard = deps.repetitionGuard || new RepetitionGuard();

  // Seed lore on first run
  await seedLore(loreStore);

  try {
    // Stage 1: Context Building
    const contextResult = await runStage("context_build", async () => {
      const contextDeps: ContextBuilderDeps = { xread: deps.xread };
      const thread = await buildThreadContext(
        contextDeps,
        {
          tweet_id: input.mention.tweet_id,
          text: input.mention.text,
          author_id: input.mention.author_id,
          author_username: input.mention.author_username,
        },
        {
          max_thread_depth: fullConfig.maxThreadDepth,
          roast_level: "medium",
          deny_reply_mode: "reply",
          activation_mode: "global",
          enable_timeline_scout: fullConfig.enableTimelineScout,
          max_timeline_queries: input.controls.max_timeline_queries,
        }
      );

      // TODO: Add timeline scout integration
      const timeline: TimelineBrief | null = null;

      return { thread, timeline };
    });

    stages.push(contextResult);

    if (!contextResult.success || !contextResult.data) {
      throw new Error("Context building failed");
    }

    const { thread, timeline } = contextResult.data as { thread: ThreadContext; timeline: TimelineBrief | null };

    // Stage 2: Intent Detection
    const intentResult = await runStage("intent_detect", async () => {
      const intentDeps: IntentDetectionDeps = { llm: deps.llm };
      return await detectIntent(intentDeps, input.mention.text, {
        thread_summary: thread.summary,
        author_handle: input.mention.author_username,
      });
    });

    stages.push(intentResult);

    if (!intentResult.success || !intentResult.data) {
      throw new Error("Intent detection failed");
    }

    const intent = intentResult.data;

    // Stage 3: Truth Gate (initial categorization)
    const truthResult = await runStage("truth_gate", async () => {
      // Initial categorization - will be refined after generation
      return {
        category: "OPINION" as const,
        confidence: 0.5,
        requires_verification: false,
        reasoning: "Initial categorization before generation",
      };
    });

    stages.push(truthResult);

    // Stage 4: Persona Router
    const personaResult = await runStage("persona_route", async () => {
      // Get user relationship
      const userProfile = await userGraph.getOrCreateProfile(
        input.mention.author_id,
        input.mention.author_username,
        { initialRelationship: fullConfig.defaultUserRelationship }
      );

      // Check for lore context
      const hasLoreContext = await checkLoreContext(loreStore, intent, thread);

      // Build routing criteria
      const criteria = buildRoutingCriteria({
        intent: intent.intent,
        aggression_level: intent.aggression_level,
        timeline_sentiment: timeline?.bullets?.some(b => b.includes("negative")) ? "negative" : "neutral",
        user_relationship: userProfile.relationship,
        has_lore_context: hasLoreContext,
        entities: intent.entities,
        hasContractAddress: intent.entities.contract_addresses.length > 0,
      });

      const mode = selectPersonaMode(criteria);

      return { mode, criteria };
    });

    stages.push(personaResult);

    if (!personaResult.success || !personaResult.data) {
      throw new Error("Persona routing failed");
    }

    const { mode, criteria } = personaResult.data as { mode: ReturnType<typeof selectPersonaMode>; criteria: RoutingCriteria };

    // Stage 5: Memory Retrieval
    const memoryResult = await runStage("memory_retrieve", async () => {
      // Retrieve relevant lore
      const relevantLore = await retrieveRelevantLore(loreStore, intent, thread);

      // Retrieve user context
      const userContext = await userGraph.getProfile(input.mention.author_id);

      // Retrieve interaction history
      const previousInteractions = await userGraph.getInteractionHistory(
        input.mention.author_username,
        5
      );

      // Suggest topics based on context
      const suggestedTopics = buildSuggestedTopics(thread, timeline);

      return {
        relevant_lore: relevantLore,
        relevant_facts: [], // TODO: Integrate facts store
        user_context: userContext || undefined,
        previous_interactions: previousInteractions,
        suggested_topics: suggestedTopics,
      } as MemoryRetrievalResult;
    });

    stages.push(memoryResult);

    if (!memoryResult.success || !memoryResult.data) {
      throw new Error("Memory retrieval failed");
    }

    const memory = memoryResult.data as MemoryRetrievalResult;

    // Stage 6: LLM Generation (N Candidates)
    const generationResult = await runStage("generation", async () => {
      const genDeps: GenerationDeps = { llm: deps.llm };

      return await generateCandidates(genDeps, {
        context: thread,
        timeline,
        intent,
        persona_mode: mode,
        memory,
        adaptive_signals: null,
        candidate_count: fullConfig.candidateCount,
      });
    });

    stages.push(generationResult);

    if (!generationResult.success || !generationResult.data) {
      throw new Error("Generation failed");
    }

    const { candidates } = generationResult.data as { candidates: ReplyCandidate[] };

    if (candidates.length === 0) {
      throw new Error("No candidates generated");
    }

    // Stage 7: Candidate Selection
    const selectionResult = await runStage("selection", async () => {
      const selectionDeps: SelectionDeps = { repetitionGuard };

      const { selected, scores } = selectBest(
        candidates,
        {
          thread,
          timeline,
          personaMode: mode,
          intent: intent.intent,
          truthContext: {
            containsContractAddress: intent.entities.contract_addresses.length > 0,
          },
        },
        selectionDeps
      );

      return { selected, scores };
    });

    stages.push(selectionResult);

    if (!selectionResult.success || !selectionResult.data) {
      throw new Error("Selection failed");
    }

    let { selected: bestCandidate } = selectionResult.data as { selected: ReplyCandidate };

    // Stage 8: Safety Guard (Persona Guardrails)
    const safetyResult = await runStage("safety_check", async () => {
      // Check persona guardrails
      const hasVerifiedData = intent.entities.contract_addresses.length > 0;
      const contractAddress = intent.entities.contract_addresses[0] || null;
      const userPanicState = detectPanicState(input.mention.text);

      const guardrailCheck = enforcePersonaGuardrails(bestCandidate.reply_text, {
        hasVerifiedData,
        contractAddress,
        userPanicState,
      });

      // If violations found, try to correct or use fallback
      if (!guardrailCheck.passed) {
        warnings.push(`Guardrail violations: ${guardrailCheck.violations.join(", ")}`);

        // Try next best candidate if available
        if (candidates.length > 1) {
          const nextBest = candidates.find(c => c.candidate_id !== bestCandidate.candidate_id);
          if (nextBest) {
            bestCandidate = nextBest;
            warnings.push("Fallback to next best candidate after guardrail violation");
          }
        }
      }

      return {
        passed: guardrailCheck.passed,
        violations: guardrailCheck.violations,
        corrected: guardrailCheck.corrected,
      };
    });

    stages.push(safetyResult);

    // Re-categorize with final truth gate
    const finalTruth = categorizeResponse(bestCandidate.reply_text, {
      hasAuditData: intent.entities.contract_addresses.length > 0,
      containsContractAddress: intent.entities.contract_addresses.length > 0,
    });

    // Stage 9: Memory Writeback
    const writebackResult = await runStage("memory_writeback", async () => {
      return await performWriteback(
        {
          loreStore,
          factsStore,
          userGraph,
        },
        {
          userId: input.mention.author_id,
          userHandle: input.mention.author_username,
          tweetId: input.mention.tweet_id,
          replyCandidate: bestCandidate,
          truthClassification: finalTruth,
          intentResult: intent,
          threadTopic: thread.keywords[0],
        }
      );
    });

    stages.push(writebackResult);

    if (!writebackResult.success) {
      warnings.push("Memory writeback failed (non-critical)");
    }

    // Stage 10: Publish (placeholder - actual publishing handled by caller)
    const publishResult = await runStage("publish", async () => {
      // Add to repetition guard
      repetitionGuard.add(bestCandidate.reply_text);

      return {
        reply_text: bestCandidate.reply_text,
        candidate_id: bestCandidate.candidate_id,
      };
    });

    stages.push(publishResult);

    // Build final trace
    const completedAt = new Date().toISOString();

    const trace: PipelineTrace = {
      request_id: requestId,
      started_at: startedAt,
      completed_at: completedAt,
      stages,
      final_reply: bestCandidate.reply_text,
      selected_candidate: bestCandidate,
      errors,
      warnings,
    };

    return {
      reply_text: bestCandidate.reply_text,
      selected_candidate: bestCandidate,
      trace,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    errors.push(errorMsg);

    // Return error response with fallback
    return {
      reply_text: "Need the real CA to verify anything. Data doesn't lie, but claims do.",
      selected_candidate: {
        candidate_id: "error_fallback",
        reply_text: "Need the real CA to verify anything. Data doesn't lie, but claims do.",
        mode: "analyst",
        risk: "low",
        truth_category: "OPINION",
        estimated_length: 70,
      },
      trace: {
        request_id: requestId,
        started_at: startedAt,
        stages,
        errors,
        warnings,
      },
    };
  }
}

// =============================================================================
// Internal Helper Functions
// =============================================================================

/**
 * Runs a pipeline stage with tracing.
 */
async function runStage<T>(
  stage: PipelineStage,
  fn: () => Promise<T>
): Promise<PipelineStageResult<T>> {
  const startTime = Date.now();

  try {
    const data = await fn();
    const duration = Date.now() - startTime;

    return {
      stage,
      success: true,
      data,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);

    return {
      stage,
      success: false,
      error: errorMsg,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Generates a unique request ID.
 */
function generateRequestId(tweetId: string): string {
  const timestamp = Date.now();
  const hash = stableHash(`${tweetId}:${timestamp}`);
  return `req_${hash.slice(0, 16)}`;
}

/**
 * Checks if relevant lore exists for the context.
 */
async function checkLoreContext(
  loreStore: LoreStore,
  intent: { intent: string; topics: string[] },
  thread: { keywords: string[] }
): Promise<boolean> {
  // Check intent-based lore
  if (intent.intent === "lore_query") {
    for (const topic of intent.topics) {
      if (await loreStore.hasLore(topic)) {
        return true;
      }
    }
  }

  // Check keyword-based lore
  for (const keyword of thread.keywords) {
    if (await loreStore.hasLore(keyword)) {
      return true;
    }
  }

  return false;
}

/**
 * Retrieves relevant lore entries.
 */
async function retrieveRelevantLore(
  loreStore: LoreStore,
  intent: { intent: string; topics: string[] },
  thread: { keywords: string[]; entities: string[] }
): Promise<LegacyLoreEntry[]> {
  const lore: LegacyLoreEntry[] = [];

  // Search by intent topics
  for (const topic of intent.topics) {
    const entries = await loreStore.getLoreByTopic(topic, 2);
    lore.push(...entries);
  }

  // Search by keywords
  for (const keyword of thread.keywords) {
    const entries = await loreStore.searchLore(keyword, 2);
    lore.push(...entries);
  }

  // Search by entities
  for (const entity of thread.entities) {
    const entries = await loreStore.searchLore(entity, 1);
    lore.push(...entries);
  }

  // Deduplicate by ID
  const seen = new Set<string>();
  return lore.filter(entry => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

/**
 * Builds suggested topics based on context.
 */
function buildSuggestedTopics(
  thread: { keywords: string[] },
  timeline: TimelineBrief | null
): string[] {
  const topics = [...thread.keywords];

  if (timeline) {
    for (const phrase of timeline.hot_phrases) {
      if (!topics.includes(phrase)) {
        topics.push(phrase);
      }
    }
  }

  return topics.slice(0, 5);
}

/**
 * Creates a configured reply engine instance.
 */
export function createReplyEngine(deps: ReplyEngineDeps): {
  process: (input: ReplyEngineInput, config?: Partial<ReplyEngineConfig>) => Promise<ReplyEngineOutput>;
} {
  return {
    process: (input, config) => processMention(deps, input, config),
  };
}
