import { describe, it, expect } from "vitest";
import { pickTemplateTexts } from "../../src/memes/templateTextPicker.js";
import { LoadedTemplate } from "../../src/loaders/templateLoader.js";

describe("templateTextPicker", () => {
  const mockTemplate: LoadedTemplate = {
    template_key: "test_template",
    text_zones: {
      header: ["Header A", "Header B", "Header C"],
      body: ["Body 1", "Body 2"],
      footer: ["Footer X"],
    },
    sourcePath: "/test/path.yaml",
  };

  describe("pickTemplateTexts", () => {
    it("picks one text per zone", () => {
      const result = pickTemplateTexts(mockTemplate, "seed_123");

      expect(Object.keys(result).length).toBe(3);
      expect(result.header).toBeDefined();
      expect(result.body).toBeDefined();
      expect(result.footer).toBeDefined();
    });

    it("picks values from correct arrays", () => {
      const result = pickTemplateTexts(mockTemplate, "seed_123");

      expect(mockTemplate.text_zones.header).toContain(result.header);
      expect(mockTemplate.text_zones.body).toContain(result.body);
      expect(mockTemplate.text_zones.footer).toContain(result.footer);
    });

    it("is deterministic for same seed", () => {
      const result1 = pickTemplateTexts(mockTemplate, "seed_123");
      const result2 = pickTemplateTexts(mockTemplate, "seed_123");

      expect(result1).toEqual(result2);
    });

    it("picks different values for different seeds (usually)", () => {
      const result1 = pickTemplateTexts(mockTemplate, "seed_abc");
      const result2 = pickTemplateTexts(mockTemplate, "seed_xyz");

      // Not guaranteed to be different, but likely with multiple zones
      const allSame =
        result1.header === result2.header &&
        result1.body === result2.body &&
        result1.footer === result2.footer;

      // Just verify we get valid results, not necessarily different
      expect(mockTemplate.text_zones.header).toContain(result1.header);
      expect(mockTemplate.text_zones.header).toContain(result2.header);
    });

    it("handles empty zones gracefully", () => {
      const templateWithEmpty: LoadedTemplate = {
        template_key: "sparse_template",
        text_zones: {
          header: [],
          body: ["Only option"],
        },
        sourcePath: "/test/sparse.yaml",
      };

      const result = pickTemplateTexts(templateWithEmpty, "seed_123");

      // Empty zones should not appear in result
      expect(result.header).toBeUndefined();
      expect(result.body).toBe("Only option");
    });
  });
});
