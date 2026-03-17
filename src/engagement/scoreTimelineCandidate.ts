import type { TimelineCandidate } from "./types.js";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function containsAny(text: string, needles: string[]): boolean {
  const lower = text.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

export function scoreTimelineCandidate(input: TimelineCandidate): TimelineCandidate {
  const candidate = { ...input };
  const words = candidate.text.split(/\s+/).filter(Boolean);

  let context = 10;
  if (words.length >= 20) {
    context += 20;
    candidate.contextSignals.push("sufficient_text_depth");
  }
  if (containsAny(candidate.text, ["because", "therefore", "thesis", "market", "builder", "liquidity", "architecture"])) {
    context += 25;
    candidate.contextSignals.push("explicit_argument_signal");
  }
  if (candidate.text.includes("?")) {
    context += 10;
    candidate.contextSignals.push("discussion_hook");
  }

  let thread = 15;
  if (candidate.isThreadRoot) {
    thread += 20;
    candidate.threadSignals.push("thread_root");
  }
  if (candidate.replyCount >= 2 && candidate.replyCount <= 40) {
    thread += 20;
    candidate.threadSignals.push("active_not_saturated");
  }
  if (candidate.threadDepth > 2) {
    thread -= 20;
    candidate.threadSignals.push("deep_reply_chain_penalty");
  }

  let novelty = 20;
  if (!containsAny(candidate.text, ["gm", "wen", "moon", "100x"])) {
    novelty += 20;
    candidate.noveltySignals.push("non_generic_narrative");
  } else {
    novelty -= 15;
    candidate.noveltySignals.push("generic_hype_language");
  }

  let risk = 0;
  if (containsAny(candidate.text, ["kill", "hate", "idiot", "scam everyone"])) {
    risk += 50;
    candidate.riskSignals.push("hostile_or_flame_signal");
  }
  if (containsAny(candidate.text, ["guaranteed", "free money", "risk-free"])) {
    risk += 30;
    candidate.riskSignals.push("hard_financial_claim");
  }

  const spamRisk = containsAny(candidate.text, ["100x", "airdrop now", "dm me"]) ? 50 : 10;
  const repetitionRisk = containsAny(candidate.text, ["gm", "lfg", "moon"]) ? 20 : 5;

  const { recommendedVoice, recommendedMode, recommendedIntent, voiceFitScore } = selectVoice(candidate.text);

  candidate.contextStrengthScore = clamp(context);
  candidate.threadPotentialScore = clamp(thread);
  candidate.noveltyScore = clamp(novelty);
  candidate.policyRiskScore = clamp(risk);
  candidate.spamRiskScore = clamp(spamRisk);
  candidate.repetitionRiskScore = clamp(repetitionRisk);
  candidate.voiceFitScore = clamp(voiceFitScore);
  candidate.recommendedVoice = recommendedVoice;
  candidate.recommendedMode = recommendedMode;
  candidate.recommendedIntent = recommendedIntent;

  candidate.finalScore = clamp(
    candidate.contextStrengthScore +
      candidate.threadPotentialScore +
      candidate.voiceFitScore +
      candidate.noveltyScore -
      candidate.spamRiskScore -
      candidate.repetitionRiskScore -
      candidate.policyRiskScore
  );

  candidate.scoreBreakdown = {
    contextStrength: candidate.contextStrengthScore,
    threadPotential: candidate.threadPotentialScore,
    voiceFit: candidate.voiceFitScore,
    novelty: candidate.noveltyScore,
    spamRisk: candidate.spamRiskScore,
    repetitionRisk: candidate.repetitionRiskScore,
    policyRisk: candidate.policyRiskScore,
    finalScore: candidate.finalScore,
  };

  return candidate;
}

function selectVoice(text: string): {
  recommendedVoice: string;
  recommendedMode: "proactive_timeline_reply" | "thread_interjection" | "narrative_intercept";
  recommendedIntent: string;
  voiceFitScore: number;
} {
  const lower = text.toLowerCase();
  if (containsAny(lower, ["architecture", "design", "builder", "implementation"])) {
    return {
      recommendedVoice: "pilzarchitekt",
      recommendedMode: "thread_interjection",
      recommendedIntent: "builder_response",
      voiceFitScore: 80,
    };
  }
  if (containsAny(lower, ["macro", "valuation", "liquidity", "risk"])) {
    return {
      recommendedVoice: "stillhalter",
      recommendedMode: "narrative_intercept",
      recommendedIntent: "market_structure_response",
      voiceFitScore: 75,
    };
  }
  if (containsAny(lower, ["moon", "100x", "degen", "pump"])) {
    return {
      recommendedVoice: "nebelspieler",
      recommendedMode: "proactive_timeline_reply",
      recommendedIntent: "skeptical_hype_check",
      voiceFitScore: 70,
    };
  }
  return {
    recommendedVoice: "wurzelwaechter",
    recommendedMode: "proactive_timeline_reply",
    recommendedIntent: "contextual_conversation",
    voiceFitScore: 60,
  };
}
