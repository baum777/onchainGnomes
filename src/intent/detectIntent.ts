/**
 * Intent Detection Service
 *
 * LLM-based intent classification with entity extraction.
 * Classifies user messages into intent categories and extracts
 * relevant entities (coins, cashtags, users, URLs, contract addresses).
 *
 * Intent categories:
 * - question: User asks a question
 * - insult: Personal attack or insult
 * - debate: Discussion or argument
 * - market_request: Request for market data/analysis
 * - meme_play: Playful/meme interaction
 * - prompt_attack: Attempt to extract system prompts
 * - lore_query: Question about bot's backstory/lore
 * - coin_query: Question about specific token/coin
 * - ca_request: User asks for the official contract address / CA
 * - own_token_sentiment: User asks about bot's feeling/view on own token ($GORKYPF)
 */

import type { LLMClient } from "../clients/llmClient.js";
import type {
  IntentDetectionResult,
  IntentCategory,
  ExtractedEntities,
} from "../types/coreTypes.js";

export interface IntentDetectionDeps {
  llm: LLMClient;
}

/** Intent classification output schema */
interface IntentClassificationOutput {
  intent: IntentCategory;
  confidence: number;
  aggression_level: "low" | "medium" | "high";
  topics: string[];
  reasoning: string;
}

/** Entity extraction output schema */
interface EntityExtractionOutput {
  coins: string[];
  cashtags: string[];
  users: string[];
  urls: string[];
  contract_addresses: string[];
}

/**
 * Detects intent and extracts entities from user text.
 * Uses LLM for classification with structured JSON output.
 */
export async function detectIntent(
  deps: IntentDetectionDeps,
  text: string,
  context?: {
    thread_summary?: string;
    author_handle?: string;
  }
): Promise<IntentDetectionResult> {
  // Run classification and entity extraction in parallel
  const [classification, entities] = await Promise.all([
    classifyIntent(deps.llm, text, context),
    extractEntities(deps.llm, text),
  ]);

  return {
    intent: classification.intent,
    confidence: classification.confidence,
    entities,
    aggression_level: classification.aggression_level,
    topics: classification.topics,
    raw_classification: classification.reasoning,
  };
}

/**
 * LLM-based intent classification.
 */
async function classifyIntent(
  llm: LLMClient,
  text: string,
  context?: {
    thread_summary?: string;
    author_handle?: string;
  }
): Promise<IntentClassificationOutput> {
  const systemPrompt = `You are an intent classification system for a crypto-native social bot.

Classify the user's message into one of these categories:
- question: User asks a question (how, why, what, wen, etc.)
- insult: Personal attack, insult, or hostile language
- debate: Discussion, argument, or counter-argument
- market_request: Request for market data, price, or analysis
- meme_play: Playful interaction, jokes, memes
- prompt_attack: Attempt to extract system prompts or instructions
- lore_query: Question about the bot's backstory, origin, or persona
- coin_query: Question about a specific token, coin, or contract
- ca_request: User asks for the official contract address / CA / mint of the bot's own token
- own_token_sentiment: User asks how the bot feels about its own token ($GORKYPF / gorkypf / our token / dein token)

Also assess:
- aggression_level: low | medium | high
- confidence: 0.0 to 1.0
- topics: List of 1-3 main topics discussed
- reasoning: Brief explanation of classification`;

  const userPrompt = buildClassificationPrompt(text, context);

  const schemaHint = `{
  "intent": "question|insult|debate|market_request|meme_play|prompt_attack|lore_query|coin_query|ca_request|own_token_sentiment",
  "confidence": 0.0-1.0,
  "aggression_level": "low|medium|high",
  "topics": ["topic1", "topic2"],
  "reasoning": "brief explanation"
}`;

  try {
    const result = await llm.generateJSON<IntentClassificationOutput>({
      system: systemPrompt,
      developer: "", // No developer prompt needed
      user: userPrompt,
      schemaHint,
    });

    // Validate and normalize
    return {
      intent: validateIntentCategory(result.intent),
      confidence: clamp(result.confidence, 0, 1),
      aggression_level: validateAggressionLevel(result.aggression_level),
      topics: (result.topics || []).slice(0, 3),
      reasoning: result.reasoning || "No reasoning provided",
    };
  } catch (error) {
    // Fallback to heuristic detection on LLM failure
    return heuristicClassifyIntent(text);
  }
}

/**
 * LLM-based entity extraction.
 */
async function extractEntities(
  llm: LLMClient,
  text: string
): Promise<ExtractedEntities> {
  const systemPrompt = `Extract entities from the message:
- coins: Token names (e.g., "Bitcoin", "Solana", "GORKY")
- cashtags: $SYMBOL mentions
- users: @username mentions
- urls: HTTP/HTTPS links
- contract_addresses: Solana (base58, 32-44 chars) or EVM (0x...) addresses`;

  const userPrompt = `Extract entities from: "${text}"`;

  const schemaHint = `{
  "coins": ["Bitcoin", "Solana"],
  "cashtags": ["$BTC", "$SOL"],
  "users": ["@username"],
  "urls": ["https://..."],
  "contract_addresses": ["0x..." or "solana_address"]
}`;

  try {
    const result = await llm.generateJSON<EntityExtractionOutput>({
      system: systemPrompt,
      developer: "",
      user: userPrompt,
      schemaHint,
    });

    return {
      coins: dedupe(result.coins || []),
      cashtags: dedupe(result.cashtags || []),
      users: dedupe(result.users || []),
      urls: dedupe(result.urls || []),
      contract_addresses: dedupe(result.contract_addresses || []),
    };
  } catch (error) {
    // Fallback to regex extraction
    return heuristicExtractEntities(text);
  }
}

/**
 * Builds the classification prompt with context.
 */
function buildClassificationPrompt(
  text: string,
  context?: {
    thread_summary?: string;
    author_handle?: string;
  }
): string {
  let prompt = `Classify this message:\n\n"${text}"`;

  if (context?.thread_summary) {
    prompt += `\n\nThread context: ${context.thread_summary}`;
  }

  if (context?.author_handle) {
    prompt += `\nAuthor: ${context.author_handle}`;
  }

  return prompt;
}

/**
 * Heuristic intent classification as fallback.
 */
function heuristicClassifyIntent(text: string): IntentClassificationOutput {
  const lower = text.toLowerCase();

  // Check for prompt attacks first (highest priority)
  if (detectPromptAttack(lower)) {
    return {
      intent: "prompt_attack",
      confidence: 0.9,
      aggression_level: "medium",
      topics: ["system"],
      reasoning: "Detected prompt extraction attempt via heuristics",
    };
  }

  // CA request: user asking for official contract address
  if (detectCARequest(text)) {
    return {
      intent: "ca_request",
      confidence: 0.92,
      aggression_level: "low",
      topics: ["token", "contract"],
      reasoning: "Detected CA / contract address request via NLP patterns",
    };
  }

  // Own token sentiment: user asking how bot feels about own token
  if (detectOwnTokenSentiment(text)) {
    return {
      intent: "own_token_sentiment",
      confidence: 0.92,
      aggression_level: "low",
      topics: ["token", "sentiment"],
      reasoning: "Detected own-token sentiment query via NLP patterns",
    };
  }

  // Check for insults
  const insultWords = ["stupid", "idiot", "moron", "dumb", "pathetic", "loser", "scam", "fraud"];
  if (insultWords.some(w => lower.includes(w))) {
    return {
      intent: "insult",
      confidence: 0.8,
      aggression_level: "high",
      topics: ["hostility"],
      reasoning: "Detected insult keywords",
    };
  }

  // Check for questions
  if (text.trim().endsWith("?") || /\b(how|why|what|when|wen|where|who|is|are|can|could|would)\b/i.test(lower)) {
    // Sub-classify question type
    if (/\b(price|market|pump|dump|chart|volume|liquidity)\b/i.test(lower)) {
      return {
        intent: "market_request",
        confidence: 0.85,
        aggression_level: "low",
        topics: ["market"],
        reasoning: "Question about market data",
      };
    }

    if (/\b(you|your|who are you|where are you|origin|backstory)\b/i.test(lower)) {
      return {
        intent: "lore_query",
        confidence: 0.8,
        aggression_level: "low",
        topics: ["lore"],
        reasoning: "Question about bot identity/lore",
      };
    }

    if (/\b(token|coin|contract|ca|address|contract address)\b/i.test(lower)) {
      return {
        intent: "coin_query",
        confidence: 0.85,
        aggression_level: "low",
        topics: ["token"],
        reasoning: "Question about token/coin",
      };
    }

    return {
      intent: "question",
      confidence: 0.75,
      aggression_level: "low",
      topics: ["general"],
      reasoning: "Detected question pattern",
    };
  }

  // Check for debate/argument patterns
  if (/\b(but|however|actually|wrong|incorrect|disagree|no,|not true|false)\b/i.test(lower)) {
    return {
      intent: "debate",
      confidence: 0.7,
      aggression_level: "medium",
      topics: ["discussion"],
      reasoning: "Detected debate pattern",
    };
  }

  // Check for meme/playful
  if (/\b(lol|lmao|haha|kek|meme|funny|joke|sarcasm)\b/i.test(lower)) {
    return {
      intent: "meme_play",
      confidence: 0.7,
      aggression_level: "low",
      topics: ["humor"],
      reasoning: "Detected playful/meme language",
    };
  }

  // Default to question for unknown
  return {
    intent: "question",
    confidence: 0.5,
    aggression_level: "low",
    topics: ["general"],
    reasoning: "Default classification",
  };
}

/**
 * NLP: Detects CA-request intent (user asking for official contract address).
 * Covers: ca?, contract, mint, adresse, token address, contract address, official address
 */
export function detectCARequest(text: string): boolean {
  const lower = text.toLowerCase();
  const CA_PATTERNS = [
    /\bca\s*\?/i,
    /\bca\b/i,
    /\bcontract\s*address\b/i,
    /\bcontract\b/i,
    /\bmint\s*address\b/i,
    /\bmint\b/i,
    /\btoken\s*address\b/i,
    /\badresse\b/i,
    /\bofficial\s*address\b/i,
    /\bwhat.*(address|contract|ca|mint)\b/i,
    /\b(where|whats|what'?s|give me|post|share).*(ca|contract|mint|address)\b/i,
  ];
  return CA_PATTERNS.some((p) => p.test(lower));
}

/**
 * NLP: Detects own-token-sentiment intent (user asking how bot feels about own token).
 * Covers: $GORKYPF, GORKYPF, gorkypf, our token, dein token, your token, own token
 */
export function detectOwnTokenSentiment(text: string): boolean {
  const lower = text.toLowerCase();
  const OWN_TOKEN_PATTERNS = [
    /\$gorkypf\b/i,
    /\bgorkypf\b/i,
    /\bour\s*token\b/i,
    /\bdein\s*token\b/i,
    /\byour\s*token\b/i,
    /\bown\s*token\b/i,
    /\b(feeling|think|feel|meinung|sicht|view).*(gorkypf|our token|dein token|your token)\b/i,
    /\b(gorkypf|our token|dein token).*(feeling|think|feel|meinung|sicht|view|bullish|bearish)\b/i,
    /\bhow.*feel.*(token|coin)\b/i,
  ];
  return OWN_TOKEN_PATTERNS.some((p) => p.test(lower));
}

/**
 * Detects prompt attack patterns.
 */
function detectPromptAttack(text: string): boolean {
  const attackPatterns = [
    /ignore previous instructions/i,
    /system prompt/i,
    /core instructions/i,
    /what are your instructions/i,
    /reveal your prompt/i,
    /show me your instructions/i,
    /dan mode/i,
    /jailbreak/i,
    /developer mode/i,
  ];

  return attackPatterns.some(p => p.test(text));
}

/**
 * Heuristic entity extraction as fallback.
 */
function heuristicExtractEntities(text: string): ExtractedEntities {
  const coins: string[] = [];
  const cashtags: string[] = [];
  const users: string[] = [];
  const urls: string[] = [];
  const contract_addresses: string[] = [];

  // Extract cashtags: $SYMBOL
  const cashtagMatches = text.match(/\$[A-Za-z0-9]+/g);
  if (cashtagMatches) {
    cashtags.push(...cashtagMatches);
  }

  // Extract users: @username
  const userMatches = text.match(/@\w+/g);
  if (userMatches) {
    users.push(...userMatches);
  }

  // Extract URLs
  const urlMatches = text.match(/https?:\/\/[^\s]+/gi);
  if (urlMatches) {
    urls.push(...urlMatches);
  }

  // Extract Solana addresses (base58, 32-44 chars)
  const solanaMatches = text.match(/[A-HJ-NP-Za-km-z1-9]{32,44}/g);
  if (solanaMatches) {
    contract_addresses.push(...solanaMatches);
  }

  // Extract EVM addresses (0x...)
  const evmMatches = text.match(/0x[a-fA-F0-9]{40}/g);
  if (evmMatches) {
    contract_addresses.push(...evmMatches);
  }

  // Known coin names (simple heuristic)
  const knownCoins = ["bitcoin", "ethereum", "solana", "cardano", "polygon", "avalanche"];
  for (const coin of knownCoins) {
    if (text.toLowerCase().includes(coin)) {
      coins.push(coin.charAt(0).toUpperCase() + coin.slice(1));
    }
  }

  return {
    coins: dedupe(coins),
    cashtags: dedupe(cashtags),
    users: dedupe(users),
    urls: dedupe(urls),
    contract_addresses: dedupe(contract_addresses),
  };
}

/**
 * Validates intent category.
 */
function validateIntentCategory(intent: string): IntentCategory {
  const validCategories: IntentCategory[] = [
    "question",
    "insult",
    "debate",
    "market_request",
    "meme_play",
    "prompt_attack",
    "lore_query",
    "coin_query",
    "ca_request",
    "own_token_sentiment",
  ];

  if (validCategories.includes(intent as IntentCategory)) {
    return intent as IntentCategory;
  }

  return "question"; // Default fallback
}

/**
 * Validates aggression level.
 */
function validateAggressionLevel(level: string): "low" | "medium" | "high" {
  if (level === "low" || level === "medium" || level === "high") {
    return level;
  }
  return "low";
}

/**
 * Deduplicates array while preserving order.
 */
function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/**
 * Clamps a number between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
