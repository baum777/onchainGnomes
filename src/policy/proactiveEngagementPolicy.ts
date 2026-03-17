import type { TimelineEngagementConfig } from "../config/timelineEngagementConfig.js";
import { EngagementMemory } from "../engagement/engagementMemory.js";
import type { TimelineCandidate } from "../engagement/types.js";

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
}

export async function evaluateProactiveEngagementPolicy(
  candidate: TimelineCandidate,
  config: TimelineEngagementConfig,
  memory: EngagementMemory
): Promise<PolicyDecision> {
  if (candidate.contextStrengthScore < config.minContextScore) {
    candidate.policyDecision = "reject";
    candidate.rejectedBecause.push("low_context_strength");
    return { allowed: false, reason: "low_context_strength" };
  }

  if (candidate.finalScore < config.minFinalScore) {
    candidate.policyDecision = "reject";
    candidate.rejectedBecause.push("low_final_score");
    return { allowed: false, reason: "low_final_score" };
  }

  if (config.requireThreadStructure && !(candidate.isThreadRoot || candidate.replyCount > 0)) {
    candidate.policyDecision = "reject";
    candidate.rejectedBecause.push("thread_structure_required");
    return { allowed: false, reason: "thread_structure_required" };
  }

  if (candidate.policyRiskScore >= 60 || candidate.spamRiskScore >= 60) {
    candidate.policyDecision = "reject";
    candidate.rejectedBecause.push("policy_or_spam_risk");
    return { allowed: false, reason: "policy_or_spam_risk" };
  }

  if (await memory.isTweetHandled(candidate.tweetId)) {
    candidate.policyDecision = "reject";
    candidate.rejectedBecause.push("duplicate_tweet");
    return { allowed: false, reason: "duplicate_tweet" };
  }

  if (await memory.isAuthorCoolingDown(candidate.authorId)) {
    candidate.policyDecision = "reject";
    candidate.rejectedBecause.push("author_cooldown");
    return { allowed: false, reason: "author_cooldown" };
  }

  if (await memory.isConversationCoolingDown(candidate.conversationId)) {
    candidate.policyDecision = "reject";
    candidate.rejectedBecause.push("conversation_cooldown");
    return { allowed: false, reason: "conversation_cooldown" };
  }

  const [hourlyCount, dailyCount] = await Promise.all([memory.getHourlyCount(), memory.getDailyCount()]);

  if (hourlyCount >= config.maxPerHour) {
    candidate.policyDecision = "reject";
    candidate.rejectedBecause.push("hourly_limit_reached");
    return { allowed: false, reason: "hourly_limit_reached" };
  }

  if (dailyCount >= config.maxPerDay) {
    candidate.policyDecision = "reject";
    candidate.rejectedBecause.push("daily_limit_reached");
    return { allowed: false, reason: "daily_limit_reached" };
  }

  candidate.policyDecision = "allow";
  return { allowed: true, reason: "allow" };
}
