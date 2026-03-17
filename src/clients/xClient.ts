/**
 * X Client (X API v2 via OAuth 2.0 user tokens)
 */

import { assertPublicTextSafe, PublicTextGuardError } from "../boundary/publicTextGuard.js";
import { invokeXApiRequest } from "./xApi.js";

export type XConfig = {
  dryRun?: boolean;
};

export class XClientError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "XClientError";
  }
}

export class MediaValidationError extends XClientError {
  constructor(message: string) {
    super(`Media validation failed: ${message}`);
    this.name = "MediaValidationError";
  }
}

export class XClient {
  private dryRun: boolean;

  constructor(config: XConfig = {}) {
    this.dryRun = config.dryRun ?? false;
  }

  async tweet(text: string): Promise<{ id: string; text: string }> {
    assertPublicTextSafe(text, { route: "XClient.tweet" });

    if (this.dryRun) {
      console.log("[DRY_RUN] Would tweet:", text.substring(0, 50) + (text.length > 50 ? "..." : ""));
      return { id: "dry_run_id", text };
    }

    try {
      const result = await invokeXApiRequest<{ data: { id: string; text: string } }>({
        method: "POST",
        uri: "https://api.x.com/2/tweets",
        body: { text },
      });

      return { id: result.data.id, text: result.data.text };
    } catch (error) {
      throw new XClientError(`Failed to post tweet: ${error}`, error);
    }
  }

  async reply(text: string, replyToTweetId: string): Promise<{ id: string; text: string }> {
    assertPublicTextSafe(text, { route: "XClient.reply" });

    if (this.dryRun) {
      console.log(`[DRY_RUN] Would reply to ${replyToTweetId}:`, text.substring(0, 50) + (text.length > 50 ? "..." : ""));
      return { id: "dry_run_id", text };
    }

    try {
      const result = await invokeXApiRequest<{ data: { id: string; text: string } }>({
        method: "POST",
        uri: "https://api.x.com/2/tweets",
        body: {
          text,
          reply: { in_reply_to_tweet_id: replyToTweetId },
        },
      });
      return { id: result.data.id, text: result.data.text };
    } catch (error) {
      throw new XClientError(`Failed to post reply: ${error}`, error);
    }
  }

  async uploadMedia(_buffer: Buffer, _mimeType: string): Promise<string> {
    throw new MediaValidationError(
      "uploadMedia is not supported in OAuth2-only mode. Use an OAuth1 media uploader adapter if required."
    );
  }

  async replyWithMedia(_text: string, _replyToTweetId: string, _mediaId: string): Promise<{ id: string; text: string }> {
    throw new MediaValidationError("replyWithMedia is not supported in OAuth2-only mode.");
  }

  async tweetWithMedia(_text: string, _mediaId: string): Promise<{ id: string; text: string }> {
    throw new MediaValidationError("tweetWithMedia is not supported in OAuth2-only mode.");
  }
}

export function createXClient(dryRun?: boolean): XClient {
  return new XClient({ dryRun });
}

export { PublicTextGuardError, assertPublicTextSafe };
