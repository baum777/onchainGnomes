import { describe, it, expect } from "vitest";
import { XClient, XClientError, createXClient } from "../../src/clients/xClient.js";

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
});
