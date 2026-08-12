import { describe, expect, it } from "vitest";
import { getSuttaMCQ, suttaMCQs } from "../suttaQuizzes";

describe("suttaQuizzes", () => {
  it("has one MCQ for each requested Book of Ones sutta", () => {
    expect(suttaMCQs.map((mcq) => mcq.suttaId)).toEqual(
      expect.arrayContaining([
        "AN 1.18.13",
        "AN 1.19",
        "AN 1.19.2",
        "AN 1.20.1",
        "AN 1.20.2",
        "AN 1.21.47",
        "1.48",
      ]),
    );
  });

  it("resolves AN-prefixed and unprefixed ids", () => {
    expect(getSuttaMCQ("AN 1.19")?.goldOptionId).toBe("rare-receptivity");
    expect(getSuttaMCQ("1.19")?.goldOptionId).toBe("rare-receptivity");
    expect(getSuttaMCQ("AN 1.48")?.goldOptionId).toBe("trainability");
    expect(getSuttaMCQ("AN 11.6")?.goldOptionId).toBe("respect-noble-ones");
  });

  it("shows teacher summaries for the Book of Ones quizzes instead of teacher clips", () => {
    const bookOfOnes = suttaMCQs.filter((mcq) => mcq.suttaId.startsWith("AN 1."));

    expect(bookOfOnes).toHaveLength(6);
    for (const mcq of bookOfOnes) {
      expect(mcq.teacherClip).toBeUndefined();
      expect(mcq.teacherSummary?.length).toBeGreaterThan(80);
    }
  });
});
