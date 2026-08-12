import { describe, it, expect } from "vitest";
import { getPracticeForItem, getPracticeMode } from "../practice";
import type { ItemDetail } from "../damaApi";

describe("practice utils", () => {
  describe("getPracticeForItem", () => {
    it("should prioritize JSON MCQ if present", () => {
      const item = {
        suttaid: "5.4.40",
        mcq: {
          quote: "Test Quote",
          options: [],
          goldOptionId: "1"
        }
      } as unknown as ItemDetail;

      const practice = getPracticeForItem("5.4.40", item);
      expect(practice.mcq.quote).toBe("Test Quote");
    });

    it("should fallback to hardcoded practice if no JSON MCQ", () => {
      // AN 1.18.13 has a hardcoded practice in bookOnePractices.ts
      const practice = getPracticeForItem("AN 1.18.13", null);
      expect(practice.suttaId).toBe("AN 1.18.13");
    });
  });

  describe("getPracticeMode", () => {
    it("should force mcq if JSON MCQ is present", () => {
      const item = { mcq: {} } as unknown as ItemDetail;
      expect(getPracticeMode("5.4.40", item)).toBe("mcq");
    });

    it("should determine mode based on sutta ID hash if no JSON MCQ", () => {
      expect(getPracticeMode("AN 1.1", null)).toBe("mcq");
      expect(getPracticeMode("AN 1.2", null)).toBe("technique");
      expect(getPracticeMode("AN 1.3", null)).toBe("vow");
    });
  });
});
