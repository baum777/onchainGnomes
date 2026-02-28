/**
 * X Client (Twitter/X API v2)
 *
 * Production-ready client for posting tweets and replies.
 * Supports DRY_RUN mode for testing.
 * Includes: text safety guard, retry logic, media validation.
 */

import { TwitterApi } from "twitter-api-v2";
import { assertPublicTextSafe, PublicTextGuardError } from "../boundary/publicTextGuard.js";
import { withRetry, isXApiRetryable } from "../utils/retry.js";

export type XConfig = {
  appKey: string;
  appSecret: string;
  accessToken: string;
  accessSecret: string;
  dryRun?: boolean;
};

// Media constraints
const MAX_MEDIA_SIZE_MB = 5;
const MAX_MEDIA_SIZE_BYTES = MAX_MEDIA_SIZE_MB * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg"];

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
  private client: TwitterApi;
  private dryRun: boolean;

  constructor(config: XConfig) {
    this.validateConfig(config);
    this.client = new TwitterApi({
      appKey: config.appKey,
      appSecret: config.appSecret,
      accessToken: config.accessToken,
      accessSecret: config.accessSecret,
    });
    this.dryRun = config.dryRun ?? false;
  }

  private validateConfig(config: XConfig): void {
    if (!config.appKey || !config.appSecret || !config.accessToken || !config.accessSecret) {
      throw new XClientError(
        "Missing X API credentials. Required: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET"
      );
    }
  }

  /**
   * Validate media before upload
   */
  private validateMedia(buffer: Buffer, mimeType: string): void {
    // Check mimeType
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new MediaValidationError(
        `Invalid mimeType "${mimeType}". Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`
      );
    }

    // Check buffer size
    if (buffer.length === 0) {
      throw new MediaValidationError("Buffer is empty");
    }

    if (buffer.length > MAX_MEDIA_SIZE_BYTES) {
      throw new MediaValidationError(
        `Buffer too large: ${buffer.length} bytes (max: ${MAX_MEDIA_SIZE_BYTES} bytes = ${MAX_MEDIA_SIZE_MB}MB)`
      );
    }
  }

  /**
   * Post a new tweet
   */
  async tweet(text: string): Promise<{ id: string; text: string }> {
    // Defense-in-depth: validate text before posting (even in DRY_RUN)
    assertPublicTextSafe(text, { route: "XClient.tweet" });

    if (this.dryRun) {
      console.log("[DRY_RUN] Would tweet:", text.substring(0, 50) + (text.length > 50 ? "..." : ""));
      return { id: "dry_run_id", text };
    }

    try {
      const result = await withRetry(
        () => this.client.v2.tweet(text),
        {}, // default retry options
        isXApiRetryable
      );
      return {
        id: result.data.id,
        text: result.data.text,
      };
    } catch (error) {
      throw new XClientError(`Failed to post tweet: ${error}`, error);
    }
  }

  /**
   * Post a reply to a tweet
   */
  async reply(text: string, replyToTweetId: string): Promise<{ id: string; text: string }> {
    // Defense-in-depth: validate text before posting (even in DRY_RUN)
    assertPublicTextSafe(text, { route: "XClient.reply" });

    if (this.dryRun) {
      console.log(`[DRY_RUN] Would reply to ${replyToTweetId}:`, text.substring(0, 50) + (text.length > 50 ? "..." : ""));
      return { id: "dry_run_id", text };
    }

    try {
      const result = await withRetry(
        () => this.client.v2.tweet({
          text,
          reply: {
            in_reply_to_tweet_id: replyToTweetId,
          },
        }),
        {},
        isXApiRetryable
      );
      return {
        id: result.data.id,
        text: result.data.text,
      };
    } catch (error) {
      throw new XClientError(`Failed to post reply: ${error}`, error);
    }
  }

  /**
   * Upload media (image/video) for attachment
   */
  async uploadMedia(buffer: Buffer, mimeType: string): Promise<string> {
    // Validate media before upload
    this.validateMedia(buffer, mimeType);

    if (this.dryRun) {
      console.log("[DRY_RUN] Would upload media:", mimeType, `(${buffer.length} bytes)`);
      return "dry_run_media_id";
    }

    try {
      const mediaId = await withRetry(
        () => this.client.v1.uploadMedia(buffer, { mimeType }),
        {},
        isXApiRetryable
      );
      return mediaId;
    } catch (error) {
      throw new XClientError(`Failed to upload media: ${error}`, error);
    }
  }

  /**
   * Post tweet with media attachment
   */
  async tweetWithMedia(text: string, mediaId: string): Promise<{ id: string; text: string }> {
    // Defense-in-depth: validate text before posting (even in DRY_RUN)
    assertPublicTextSafe(text, { route: "XClient.tweetWithMedia" });

    if (this.dryRun) {
      console.log("[DRY_RUN] Would tweet with media:", text.substring(0, 50) + "...");
      return { id: "dry_run_id", text };
    }

    try {
      const result = await withRetry(
        () => this.client.v2.tweet({
          text,
          media: {
            media_ids: [mediaId],
          },
        }),
        {},
        isXApiRetryable
      );
      return {
        id: result.data.id,
        text: result.data.text,
      };
    } catch (error) {
      throw new XClientError(`Failed to post tweet with media: ${error}`, error);
    }
  }
}

/**
 * Factory function creating XClient from environment variables
 */
export function createXClient(dryRun?: boolean): XClient {
  const config: XConfig = {
    appKey: process.env.X_API_KEY || "",
    appSecret: process.env.X_API_SECRET || "",
    accessToken: process.env.X_ACCESS_TOKEN || "",
    accessSecret: process.env.X_ACCESS_SECRET || "",
    dryRun,
  };
  return new XClient(config);
}

// Re-export for convenience
export { PublicTextGuardError, assertPublicTextSafe };
