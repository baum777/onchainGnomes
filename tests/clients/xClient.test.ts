import { describe, it, expect } from "vitest";
import { XClient, XClientError, MediaValidationError, PublicTextGuardError, createXClient } from "../../src/clients/xClient.js";

describe("XClient", () => {
  describe("constructor", () => {
    it("should throw XClientError on missing credentials", () => {
      expect(() => new XClient({
        appKey: "",
        appSecret: "",
        accessToken: "",
        accessSecret: "",
      })).toThrow(XClientError);
    });

    it("should throw XClientError on partial credentials", () => {
      expect(() => new XClient({
        appKey: "valid",
        appSecret: "",
        accessToken: "valid",
        accessSecret: "",
      })).toThrow(XClientError);
    });

    it("should create client with valid credentials", () => {
      const client = new XClient({
        appKey: "test_key",
        appSecret: "test_secret",
        accessToken: "test_token",
        accessSecret: "test_access_secret",
      });
      expect(client).toBeDefined();
    });
  });

  describe("dry-run mode", () => {
    it("should return dry_run_id for tweets", async () => {
      const client = new XClient({
        appKey: "test",
        appSecret: "test",
        accessToken: "test",
        accessSecret: "test",
        dryRun: true,
      });

      const result = await client.tweet("Test tweet");
      expect(result.id).toBe("dry_run_id");
      expect(result.text).toBe("Test tweet");
    });

    it("should return dry_run_id for replies", async () => {
      const client = new XClient({
        appKey: "test",
        appSecret: "test",
        accessToken: "test",
        accessSecret: "test",
        dryRun: true,
      });

      const result = await client.reply("Test reply", "123456");
      expect(result.id).toBe("dry_run_id");
    });

    it("should return dry_run_id for replies with media", async () => {
      const client = new XClient({
        appKey: "test",
        appSecret: "test",
        accessToken: "test",
        accessSecret: "test",
        dryRun: true,
      });

      const result = await client.replyWithMedia("Caption", "123456", "media_789");
      expect(result.id).toBe("dry_run_id");
      expect(result.text).toBe("Caption");
    });

    it("should return dry_run_media_id for media uploads", async () => {
      const client = new XClient({
        appKey: "test",
        appSecret: "test",
        accessToken: "test",
        accessSecret: "test",
        dryRun: true,
      });

      const buffer = Buffer.from("test image data");
      const mediaId = await client.uploadMedia(buffer, "image/png");
      expect(mediaId).toBe("dry_run_media_id");
    });

    it("should handle tweets with media in dry-run", async () => {
      const client = new XClient({
        appKey: "test",
        appSecret: "test",
        accessToken: "test",
        accessSecret: "test",
        dryRun: true,
      });

      const result = await client.tweetWithMedia("Tweet with media", "media_id");
      expect(result.id).toBe("dry_run_id");
    });
  });

  describe("createXClient factory", () => {
    it("should create client from environment variables", () => {
      // Set test env vars
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        X_API_KEY: "env_key",
        X_API_SECRET: "env_secret",
        X_ACCESS_TOKEN: "env_token",
        X_ACCESS_SECRET: "env_access_secret",
      };

      const client = createXClient(true); // dryRun: true
      expect(client).toBeDefined();

      // Restore env
      process.env = originalEnv;
    });
  });

  describe("media validation", () => {
    it("throws MediaValidationError for invalid mimeType", async () => {
      const client = new XClient({
        appKey: "test",
        appSecret: "test",
        accessToken: "test",
        accessSecret: "test",
        dryRun: true,
      });

      const buffer = Buffer.from("test data");
      await expect(client.uploadMedia(buffer, "application/pdf")).rejects.toThrow(MediaValidationError);
    });

    it("throws MediaValidationError for oversized buffer", async () => {
      const client = new XClient({
        appKey: "test",
        appSecret: "test",
        accessToken: "test",
        accessSecret: "test",
        dryRun: true,
      });

      // Create a buffer larger than 5MB
      const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
      await expect(client.uploadMedia(oversizedBuffer, "image/png")).rejects.toThrow(MediaValidationError);
    });

    it("throws MediaValidationError for zero buffer", async () => {
      const client = new XClient({
        appKey: "test",
        appSecret: "test",
        accessToken: "test",
        accessSecret: "test",
        dryRun: true,
      });

      const emptyBuffer = Buffer.alloc(0);
      await expect(client.uploadMedia(emptyBuffer, "image/png")).rejects.toThrow(MediaValidationError);
    });

    it("accepts valid PNG buffer", async () => {
      const client = new XClient({
        appKey: "test",
        appSecret: "test",
        accessToken: "test",
        accessSecret: "test",
        dryRun: true,
      });

      const buffer = Buffer.from("valid png data");
      const mediaId = await client.uploadMedia(buffer, "image/png");
      expect(mediaId).toBe("dry_run_media_id");
    });

    it("accepts valid JPEG buffer", async () => {
      const client = new XClient({
        appKey: "test",
        appSecret: "test",
        accessToken: "test",
        accessSecret: "test",
        dryRun: true,
      });

      const buffer = Buffer.from("valid jpeg data");
      const mediaId = await client.uploadMedia(buffer, "image/jpeg");
      expect(mediaId).toBe("dry_run_media_id");
    });
  });

  describe("public text guard", () => {
    it("throws PublicTextGuardError for text with forbidden keyword 'score'", async () => {
      const client = new XClient({
        appKey: "test",
        appSecret: "test",
        accessToken: "test",
        accessSecret: "test",
        dryRun: true,
      });

      await expect(client.tweet("Your score is 100")).rejects.toThrow(PublicTextGuardError);
    });

    it("throws PublicTextGuardError for text with 'threshold'", async () => {
      const client = new XClient({
        appKey: "test",
        appSecret: "test",
        accessToken: "test",
        accessSecret: "test",
        dryRun: true,
      });

      await expect(client.tweet("Threshold reached")).rejects.toThrow(PublicTextGuardError);
    });

    it("throws PublicTextGuardError for text with 'cooldown'", async () => {
      const client = new XClient({
        appKey: "test",
        appSecret: "test",
        accessToken: "test",
        accessSecret: "test",
        dryRun: true,
      });

      await expect(client.tweet("Cooldown active")).rejects.toThrow(PublicTextGuardError);
    });

    it("throws PublicTextGuardError for text with 'trace'", async () => {
      const client = new XClient({
        appKey: "test",
        appSecret: "test",
        accessToken: "test",
        accessSecret: "test",
        dryRun: true,
      });

      await expect(client.reply("Trace ID: abc", "123")).rejects.toThrow(PublicTextGuardError);
    });

    it("throws PublicTextGuardError for JSON markers in tweetWithMedia", async () => {
      const client = new XClient({
        appKey: "test",
        appSecret: "test",
        accessToken: "test",
        accessSecret: "test",
        dryRun: true,
      });

      await expect(client.tweetWithMedia('{"trace_id":"abc"}', "media_id")).rejects.toThrow(PublicTextGuardError);
    });

    it("allows safe text through guard in dry-run", async () => {
      const client = new XClient({
        appKey: "test",
        appSecret: "test",
        accessToken: "test",
        accessSecret: "test",
        dryRun: true,
      });

      const result = await client.tweet("Hello world! This is safe.");
      expect(result.id).toBe("dry_run_id");
    });
  });
});
