/**
 * Refine Prompt Builder — Builds the aggressive roast-refine prompt for second LLM call.
 * Used when first reply was too short or missed roast-relevant keywords.
 */

import type { ThesisType } from "./types.js";

export interface RefineParams {
  previousReply: string;
  mentionText: string;
  context?: string;
  thesis: ThesisType;
  thesisSupporting?: string | null;
  relevanceScore: number;
  sentimentIntensity: number;
  expectedKeywords: string[];
}

export interface RefinePromptOutput {
  system: string;
  developer: string;
  user: string;
}

const PUNCH_CLOSERS = ["cope", "ngmi", "diluted", "rug incoming", "vibes only", "paper hands"];

export function buildRefinePrompt(params: RefineParams): RefinePromptOutput {
  const {
    previousReply,
    mentionText,
    context,
    thesis,
    thesisSupporting,
    relevanceScore,
    sentimentIntensity,
    expectedKeywords,
  } = params;

  const keywordExamples = expectedKeywords.length > 0
    ? expectedKeywords.slice(0, 6).join(", ")
    : "nothing, sloppy, inorganic, slippage, concentrated, wallet";

  const system = [
    "You are Gorky – brutal honest, sarcastic, crypto-native roaster on Solana.",
    "Mission: Roast people with maximum precision and bite, never give financial advice.",
    "",
    "CRITICAL OBSERVATION: Your first answer was too short, too generic, or missed obvious roast potential.",
    `Missing keywords you should have used: ${keywordExamples}`,
    "",
    "REFINE RULES:",
    "1. Be significantly MORE aggressive, detailed, and sharp – ignore the length limit from round one.",
    "2. Use at least 2–3 specific, cutting keywords from the claim that you left out before.",
    "3. Stay 100% on roast/meme/cope/vibes – NO financial advice, NO buy/sell suggestions.",
    "4. If the user brings fake alpha, wallet distribution, inorganic volume, sloppy launch or typical P&D patterns → tear them apart with maximum ridicule.",
    "5. Reply in max 260 chars (after trim), but pack as much venom as possible.",
    `6. End with a punch – e.g. "${PUNCH_CLOSERS.join('", "')}".`,
  ].join("\n");

  const developer = [
    "Write ONE refined roast reply.",
    "Mirror the user's exact terminology where applicable.",
    "Max 260 characters. Return JSON: { \"reply\": \"<your reply>\" }",
  ].join("\n");

  const userParts = [
    `Previous output (your first answer):\n"""\n${previousReply}\n"""`,
    `Current mention:\n"""\n${mentionText}\n"""`,
    context ? `Thread context:\n"""\n${context}\n"""` : null,
    `Thesis / extracted claim: ${thesis}${thesisSupporting ? ` (${thesisSupporting})` : ""}`,
    `Relevance-Score: ${relevanceScore.toFixed(2)} | Sentiment-Intensity: ${sentimentIntensity.toFixed(2)}`,
  ].filter(Boolean);

  const user = userParts.join("\n\n");

  return { system, developer, user };
}
