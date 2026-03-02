import { describe, it, expect } from "vitest";
import { pickCaption, pickRoastReply } from "../../src/loaders/captionPicker.js";
import { DatasetBank } from "../../src/loaders/datasetLoader.js";

describe("captionPicker", () => {
  const mockBank: DatasetBank = {
    captions: [
      "sentenced to holding",
      "victim of vibes-based investing",
      "chart autopsy complete",
    ],
    roastReplies: [
      "reply early, cope later",
      "buy high, cry forever",
    ],
    exampleTweets: [],
  };

  describe("pickCaption", () => {
    it("picks a caption from the bank", () => {
      const caption = pickCaption(mockBank, "seed_123");

      expect(mockBank.captions).toContain(caption);
    });

    it("returns default when bank is empty", () => {
      const emptyBank: DatasetBank = {
        captions: [],
        roastReplies: [],
        exampleTweets: [],
      };

      const caption = pickCaption(emptyBank, "seed_123");
      expect(caption).toBe("certified market trauma survivor");
    });

    it("is deterministic for same seed", () => {
      const caption1 = pickCaption(mockBank, "seed_123");
      const caption2 = pickCaption(mockBank, "seed_123");

      expect(caption1).toBe(caption2);
    });

    it("can use context without throwing", () => {
      const caption = pickCaption(mockBank, "seed_123", {
        userHandle: "@trader123",
        tone: "mocking",
      });

      expect(mockBank.captions).toContain(caption);
    });
  });

  describe("pickRoastReply", () => {
    it("picks a roast reply from the bank", () => {
      const reply = pickRoastReply(mockBank, "seed_456");

      expect(mockBank.roastReplies).toContain(reply);
    });

    it("returns default when bank is empty", () => {
      const emptyBank: DatasetBank = {
        captions: [],
        roastReplies: [],
        exampleTweets: [],
      };

      const reply = pickRoastReply(emptyBank, "seed_456");
      expect(reply).toBe("reply early, cope later");
    });

    it("is deterministic for same seed", () => {
      const reply1 = pickRoastReply(mockBank, "seed_456");
      const reply2 = pickRoastReply(mockBank, "seed_456");

      expect(reply1).toBe(reply2);
    });
  });
});
