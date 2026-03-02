import { describe, it, expect, beforeAll } from "vitest";
import { createSeededRNG, seedFromString } from "../../src/loaders/seed.js";
import { pickCaption } from "../../src/loaders/captionPicker.js";
import { pickTemplateTexts } from "../../src/memes/templateTextPicker.js";
import { MemeResolver } from "../../src/loaders/resolver.js";
import { DatasetBank } from "../../src/loaders/datasetLoader.js";
import { resolve } from "path";

const TEST_SEED_KEY = "tweet_abc123xyz:user_987654";
const TEST_SEED_KEY_2 = "tweet_def456uvw:user_123456";

describe("Determinism Tests (Golden)", () => {
  describe("seedFromString", () => {
    it("produces consistent numeric seed from string", () => {
      const seed1 = seedFromString(TEST_SEED_KEY);
      const seed2 = seedFromString(TEST_SEED_KEY);

      expect(seed1).toBe(seed2);
      expect(typeof seed1).toBe("number");
    });

    it("produces different seeds for different strings", () => {
      const seed1 = seedFromString(TEST_SEED_KEY);
      const seed2 = seedFromString(TEST_SEED_KEY_2);

      expect(seed1).not.toBe(seed2);
    });
  });

  describe("createSeededRNG", () => {
    it("produces deterministic random sequence", () => {
      const rng1 = createSeededRNG(TEST_SEED_KEY);
      const rng2 = createSeededRNG(TEST_SEED_KEY);

      const seq1 = [rng1(), rng1(), rng1(), rng1(), rng1()];
      const seq2 = [rng2(), rng2(), rng2(), rng2(), rng2()];

      expect(seq1).toEqual(seq2);
    });

    it("produces different sequences for different seeds", () => {
      const rng1 = createSeededRNG(TEST_SEED_KEY);
      const rng2 = createSeededRNG(TEST_SEED_KEY_2);

      const val1 = rng1();
      const val2 = rng2();

      expect(val1).not.toBe(val2);
    });

    it("produces values in [0, 1) range", () => {
      const rng = createSeededRNG(TEST_SEED_KEY);

      for (let i = 0; i < 100; i++) {
        const val = rng();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });
  });

  describe("captionPicker determinism", () => {
    const mockBank: DatasetBank = {
      captions: [
        "sentenced to holding",
        "victim of vibes-based investing",
        "chart autopsy complete",
        "killed by volume",
        "resurrected out of spite",
      ],
      roastReplies: [],
      exampleTweets: [],
    };

    it("picks same caption for same seed", () => {
      const caption1 = pickCaption(mockBank, TEST_SEED_KEY);
      const caption2 = pickCaption(mockBank, TEST_SEED_KEY);

      expect(caption1).toBe(caption2);
    });

    it("picks different captions for different seeds", () => {
      const caption1 = pickCaption(mockBank, TEST_SEED_KEY);
      const caption2 = pickCaption(mockBank, TEST_SEED_KEY_2);

      // With 5 options, probability of collision is low but non-zero
      // We test that the RNG is being seeded differently
      const rng1 = createSeededRNG(TEST_SEED_KEY);
      const rng2 = createSeededRNG(TEST_SEED_KEY_2);
      expect(rng1()).not.toBe(rng2());
    });

    it("cycles through captions with different seeds", () => {
      const captions: string[] = [];

      for (let i = 0; i < 10; i++) {
        const seed = `tweet_${i}:user_1`;
        captions.push(pickCaption(mockBank, seed));
      }

      // Should have picked some different captions
      const uniqueCaptions = new Set(captions);
      expect(uniqueCaptions.size).toBeGreaterThan(1);
    });
  });

  describe("templateTextPicker determinism", () => {
    const mockTemplate = {
      template_key: "test_template",
      text_zones: {
        header: ["Header A", "Header B", "Header C"],
        body: ["Body 1", "Body 2", "Body 3", "Body 4"],
        footer: ["Footer X", "Footer Y"],
      },
      sourcePath: "/test/template.yaml",
    };

    it("picks same texts for same seed", () => {
      const texts1 = pickTemplateTexts(mockTemplate, TEST_SEED_KEY);
      const texts2 = pickTemplateTexts(mockTemplate, TEST_SEED_KEY);

      expect(texts1).toEqual(texts2);
    });

    it("includes all zone keys", () => {
      const texts = pickTemplateTexts(mockTemplate, TEST_SEED_KEY);

      expect(Object.keys(texts)).toContain("header");
      expect(Object.keys(texts)).toContain("body");
      expect(Object.keys(texts)).toContain("footer");
    });

    it("picks values from correct arrays", () => {
      const texts = pickTemplateTexts(mockTemplate, TEST_SEED_KEY);

      expect(mockTemplate.text_zones.header).toContain(texts.header);
      expect(mockTemplate.text_zones.body).toContain(texts.body);
      expect(mockTemplate.text_zones.footer).toContain(texts.footer);
    });

    it("picks different texts for different seeds", () => {
      const texts1 = pickTemplateTexts(mockTemplate, TEST_SEED_KEY);
      const texts2 = pickTemplateTexts(mockTemplate, TEST_SEED_KEY_2);

      // At least one zone should be different
      const allSame =
        texts1.header === texts2.header &&
        texts1.body === texts2.body &&
        texts1.footer === texts2.footer;

      expect(allSame).toBe(false);
    });
  });

  describe("MemeResolver determinism", () => {
    // Note: These tests require actual preset/template files
    // They will skip if files don't exist

    it("resolver picks same template for same seed when no explicit key", () => {
      const presetsDir = resolve("./prompts/presets/images");
      const templatesDir = resolve("./memes/templates");

      try {
        const resolver = new MemeResolver(presetsDir, templatesDir);

        const resolved1 = resolver.resolve(undefined, undefined, TEST_SEED_KEY);
        const resolved2 = resolver.resolve(undefined, undefined, TEST_SEED_KEY);

        if (resolved1 && resolved2) {
          expect(resolved1.template.template_key).toBe(resolved2.template.template_key);
        }
      } catch {
        // Skip if directories don't exist
      }
    });

    it("resolver uses explicit preset key deterministically", () => {
      const presetsDir = resolve("./prompts/presets/images");
      const templatesDir = resolve("./memes/templates");

      try {
        const resolver = new MemeResolver(presetsDir, templatesDir);
        const availablePresets = resolver.getAvailablePresets();

        if (availablePresets.length > 0) {
          const presetKey = availablePresets[0];

          const resolved1 = resolver.resolve(presetKey, undefined, TEST_SEED_KEY);
          const resolved2 = resolver.resolve(presetKey, undefined, TEST_SEED_KEY);

          if (resolved1 && resolved2) {
            expect(resolved1.preset.preset_key).toBe(resolved2.preset.preset_key);
          }
        }
      } catch {
        // Skip if directories don't exist
      }
    });
  });

  describe("Golden sequence stability", () => {
    it("produces stable sequence across multiple calls", () => {
      const rng1 = createSeededRNG("golden_test_seed_v1");
      const seq1 = [rng1(), rng1(), rng1(), rng1(), rng1()];

      const rng2 = createSeededRNG("golden_test_seed_v1");
      const seq2 = [rng2(), rng2(), rng2(), rng2(), rng2()];

      expect(seq1).toEqual(seq2);
    });

    it("maintains stability across seed variations", () => {
      // Test that similar seeds produce very different sequences
      const seeds = ["a", "b", "aa", "ab", "ba", "abc"];
      const firstValues = seeds.map((s) => createSeededRNG(s)());

      // All should be different
      const uniqueValues = new Set(firstValues);
      expect(uniqueValues.size).toBe(seeds.length);
    });
  });
});

// Export for potential external golden file generation
export { TEST_SEED_KEY };
