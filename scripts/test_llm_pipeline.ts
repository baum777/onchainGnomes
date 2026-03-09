import "dotenv/config";
import { createXAILLMClient } from "../src/clients/llmClient.xai.js";
import { handleEvent } from "../src/canonical/pipeline.js";
import { DEFAULT_CANONICAL_CONFIG } from "../src/canonical/types.js";
import { withCircuitBreaker } from "../src/ops/llmCircuitBreaker.js";

async function testPipeline() {
  const llmClient = withCircuitBreaker(createXAILLMClient());
  
  const testEvent = {
    event_id: "test_" + Date.now(),
    platform: "twitter" as const,
    trigger_type: "mention" as const,
    author_handle: "@TestUser",
    author_id: "123456789",
    text: "@Gorky_on_sol wie wird das wetter im markt ? bullish oder bearish ?",
    parent_text: null,
    quoted_text: null,
    conversation_context: [],
    cashtags: [],
    hashtags: [],
    urls: [],
    timestamp: new Date().toISOString(),
  };

  console.log("Processing test event through LLM pipeline...");
  console.log("Text:", testEvent.text);

  try {
    const result = await handleEvent(testEvent, {
      llm: llmClient,
      botUserId: "BOT_ID_MOCK",
    }, DEFAULT_CANONICAL_CONFIG);

    console.log("\n--- Pipeline Result ---");
    console.log("Action:", (result as any).action);
    if ((result as any).action === "publish") {
      console.log("Reply Text:", (result as any).reply_text);
      console.log("Mode:", (result as any).mode);
    } else if ((result as any).action === "skip") {
      console.log("Skip Reason:", (result as any).skip_reason);
    }
  } catch (err) {
    console.error("Pipeline failed:", err);
  }
}

testPipeline();
