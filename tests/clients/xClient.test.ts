import { describe, it, expect } from "vitest";
import { XClient, createXClient, MediaValidationError, PublicTextGuardError } from "../../src/clients/xClient.js";

describe("XClient (OAuth2-only)", () => {
  it("tweets in dry-run mode", async () => {
    const client = new XClient({ dryRun: true });
    const result = await client.tweet("Hello world");
    expect(result.id).toBe("dry_run_id");
    expect(result.text).toBe("Hello world");
  });

  it("replies in dry-run mode", async () => {
    const client = new XClient({ dryRun: true });
    const result = await client.reply("Reply text", "123");
    expect(result.id).toBe("dry_run_id");
    expect(result.text).toBe("Reply text");
  });

  it("createXClient returns client instance", () => {
    const client = createXClient(true);
    expect(client).toBeInstanceOf(XClient);
  });

  it("fails closed for media upload in OAuth2-only mode", async () => {
    const client = new XClient({ dryRun: true });
    await expect(client.uploadMedia(Buffer.from("img"), "image/png")).rejects.toThrow(MediaValidationError);
  });

  it("fails closed for replyWithMedia in OAuth2-only mode", async () => {
    const client = new XClient({ dryRun: true });
    await expect(client.replyWithMedia("text", "123", "media_1")).rejects.toThrow(MediaValidationError);
  });

  it("fails closed for tweetWithMedia in OAuth2-only mode", async () => {
    const client = new XClient({ dryRun: true });
    await expect(client.tweetWithMedia("text", "media_1")).rejects.toThrow(MediaValidationError);
  });

  it("enforces public text guard", async () => {
    const client = new XClient({ dryRun: true });
    await expect(client.tweet("Threshold reached")).rejects.toThrow(PublicTextGuardError);
  });
});
