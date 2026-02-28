/**
 * X Client (Twitter/X API v2)
 *
 * Production-ready client for posting tweets and replies.
 * Supports DRY_RUN mode for testing.
 */

import { TwitterApi } from "twitter-api-v2";

export type XConfig = {
  appKey: string;
  appSecret: string;
  accessToken: string;
  accessSecret: string;
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
   * Post a new tweet
   */
  async tweet(text: string): Promise<{ id: string; text: string }> {
    if (this.dryRun) {
      console.log("[DRY_RUN] Would tweet:", text.substring(0, 50) + (text.length > 50 ? "..." : ""));
      return { id: "dry_run_id", text };
    }

    try {
      const result = await this.client.v2.tweet(text);
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
    if (this.dryRun) {
      console.log(`[DRY_RUN] Would reply to ${replyToTweetId}:`, text.substring(0, 50) + (text.length > 50 ? "..." : ""));
      return { id: "dry_run_id", text };
    }

    try {
      const result = await this.client.v2.tweet({
        text,
        reply: {
          in_reply_to_tweet_id: replyToTweetId,
        },
      });
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
    if (this.dryRun) {
      console.log("[DRY_RUN] Would upload media:", mimeType, `(${buffer.length} bytes)`);
      return "dry_run_media_id";
    }

    try {
      const mediaId = await this.client.v1.uploadMedia(buffer, { mimeType });
      return mediaId;
    } catch (error) {
      throw new XClientError(`Failed to upload media: ${error}`, error);
    }
  }

  /**
   * Post tweet with media attachment
   */
  async tweetWithMedia(text: string, mediaId: string): Promise<{ id: string; text: string }> {
    if (this.dryRun) {
      console.log("[DRY_RUN] Would tweet with media:", text.substring(0, 50) + "...");
      return { id: "dry_run_id", text };
    }

    try {
      const result = await this.client.v2.tweet({
        text,
        media: {
          media_ids: [mediaId],
        },
      });
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
