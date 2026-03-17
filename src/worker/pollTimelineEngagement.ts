import { createUnifiedLLMClient } from "../clients/llmClient.unified.js";
import { createXClient } from "../clients/xClient.js";
import { invokeXApiRequest } from "../clients/xApi.js";
import { handleEvent, type PipelineDeps } from "../canonical/pipeline.js";
import { DEFAULT_CANONICAL_CONFIG, type CanonicalEvent } from "../canonical/types.js";
import { readTimelineEngagementConfig } from "../config/timelineEngagementConfig.js";
import { EngagementMemory } from "../engagement/engagementMemory.js";
import { normalizeTimelineCandidate } from "../engagement/normalizeTimelineCandidate.js";
import { rankTimelineCandidates, selectTopTimelineCandidates } from "../engagement/rankTimelineCandidates.js";
import { scoutTimelineCandidates } from "../engagement/timelineScout.js";
import type { TimelineCandidate } from "../engagement/types.js";
import { logInfo, logWarn } from "../ops/logger.js";
import { isPostingDisabled } from "../ops/launchGate.js";
import { withCircuitBreaker } from "../ops/llmCircuitBreaker.js";
import { evaluateProactiveEngagementPolicy } from "../policy/proactiveEngagementPolicy.js";
import { publishWithRetry } from "../state/eventStateStore.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getUserId(): Promise<string> {
  const user = await invokeXApiRequest<{ data: { id: string } }>({
    method: "GET",
    uri: "https://api.x.com/2/users/me",
  });
  return user.data.id;
}

function toCanonicalEvent(candidate: TimelineCandidate): CanonicalEvent {
  return {
    event_id: `timeline:${candidate.tweetId}`,
    platform: "twitter",
    trigger_type: "reply",
    author_handle: `@${candidate.authorUsername}`,
    author_id: candidate.authorId,
    text: candidate.text,
    parent_text: null,
    quoted_text: null,
    conversation_context: [],
    cashtags: (candidate.text.match(/\$[A-Z]{2,10}/gi) ?? []).map((s) => s.toUpperCase()),
    hashtags: candidate.text.match(/#\w+/g) ?? [],
    urls: candidate.text.match(/https?:\/\/\S+/gi) ?? [],
    timestamp: candidate.createdAt,
  };
}

export async function runTimelineEngagementIteration(): Promise<void> {
  const config = readTimelineEngagementConfig();
  if (!config.enabled) {
    logInfo("[TIMELINE] Engagement disabled");
    return;
  }

  const dryRun = process.env.LAUNCH_MODE ? isPostingDisabled() : process.env.DRY_RUN === "true";
  const xClient = createXClient(dryRun);
  const llm = withCircuitBreaker(createUnifiedLLMClient());
  const botUserId = await getUserId();
  const deps: PipelineDeps = { llm, botUserId };
  const memory = new EngagementMemory();

  const scout = await scoutTimelineCandidates({
    sourceAccounts: config.sourceAccounts,
    keywordFilters: config.keywordFilters,
  });

  const normalized = scout.tweets.map((tweet) =>
    normalizeTimelineCandidate(
      tweet,
      scout.userMap.get(tweet.author_id) ?? tweet.author_id,
      scout.userMap.get(tweet.author_id) ?? "unknown"
    )
  );

  const ranked = rankTimelineCandidates(normalized);
  logInfo("[TIMELINE] Scout + rank completed", {
    scouted: scout.tweets.length,
    ranked: ranked.length,
    topIds: ranked.slice(0, 5).map((c) => ({ id: c.tweetId, score: c.finalScore })),
  });

  const policyAllowed: TimelineCandidate[] = [];
  for (const candidate of ranked) {
    const decision = await evaluateProactiveEngagementPolicy(candidate, config, memory);
    if (decision.allowed) {
      candidate.selectedBecause.push("policy_gate_allow");
      policyAllowed.push(candidate);
    } else {
      logInfo("[TIMELINE] Candidate rejected", {
        tweetId: candidate.tweetId,
        reason: decision.reason,
        breakdown: candidate.scoreBreakdown,
      });
    }
  }

  const selection = selectTopTimelineCandidates(policyAllowed, config.maxPerRun);

  let publishedCount = 0;
  for (const candidate of selection.selected) {
    const event = toCanonicalEvent(candidate);
    const result = await handleEvent(event, deps, {
      ...DEFAULT_CANONICAL_CONFIG,
      model_id: DEFAULT_CANONICAL_CONFIG.model_id,
    });

    if (result.action !== "publish" || !result.reply_text) {
      logWarn("[TIMELINE] Candidate skipped by generation pipeline", {
        tweetId: candidate.tweetId,
        skipReason: result.action === "skip" ? result.skip_reason : "missing_reply_text",
      });
      continue;
    }

    const publishResult = await publishWithRetry(event.event_id, async () => {
      const reply = await xClient.reply(result.reply_text, candidate.tweetId);
      return { tweetId: reply.id };
    });

    if (!publishResult.success || !publishResult.tweetId) {
      logWarn("[TIMELINE] Publish failed", { tweetId: candidate.tweetId, error: publishResult.error });
      continue;
    }

    await memory.recordPublish({
      tweetId: candidate.tweetId,
      conversationId: candidate.conversationId,
      authorId: candidate.authorId,
      authorCooldownMinutes: config.authorCooldownMinutes,
      conversationCooldownMinutes: config.conversationCooldownMinutes,
    });

    publishedCount += 1;
    logInfo("[TIMELINE] Published proactive reply", {
      tweetId: candidate.tweetId,
      replyId: publishResult.tweetId,
      selectedBecause: candidate.selectedBecause,
      breakdown: candidate.scoreBreakdown,
    });
  }

  logInfo("[TIMELINE] Iteration complete", {
    scouted: scout.tweets.length,
    policyAllowed: policyAllowed.length,
    selected: selection.selected.length,
    publishedCount,
  });
}

export async function runTimelineEngagementLoop(): Promise<void> {
  const config = readTimelineEngagementConfig();
  logInfo("[TIMELINE] Worker starting", {
    enabled: config.enabled,
    intervalMs: config.intervalMs,
    maxPerRun: config.maxPerRun,
  });

  while (true) {
    try {
      await runTimelineEngagementIteration();
    } catch (error) {
      logWarn("[TIMELINE] Iteration failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    await sleep(config.intervalMs);
  }
}
