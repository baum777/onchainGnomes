import { describe, it, expect } from "vitest";
import { optionalImport } from "../_helpers/optionalImport.js";
import { assertWithin280, assertNoForbiddenTerms, assertLooksLikeReply } from "../_helpers/assertions.js";

/**
 * Expected export shape:
 *   export async function replyEngine(input): Promise<{ action: "post"|"refuse", reply_text: string }>
 *
 * Adjust this file once your real engine contract is finalized.
 */
describe("Real pipeline integration (enabled once implemented)", () => {
  it("replyEngine contract: produces safe public reply", async () => {
    const mod = await optionalImport<{
      replyEngine?: (input: {
        seedKey: string;
        currentText: string;
        userHandle: string;
        tweetId: string;
      }) => Promise<{ action: "post" | "refuse"; reply_text: string }>;
    }>("../../src/pipeline/replyEngine.js");

    if (!mod?.replyEngine) {
      // Skip until replyEngine export exists; remove .skip to enforce once implemented.
      return;
    }

    const out = await mod.replyEngine({
      seedKey: "t_real_001",
      currentText: "SOL looks dead. thoughts?",
      userHandle: "@user",
      tweetId: "t_real_001",
    });

    expect(out).toBeTruthy();
    expect(["post", "refuse"]).toContain(out.action);
    assertWithin280(out.reply_text);
    assertNoForbiddenTerms(out.reply_text);
    assertLooksLikeReply(out.reply_text);
  });
});
