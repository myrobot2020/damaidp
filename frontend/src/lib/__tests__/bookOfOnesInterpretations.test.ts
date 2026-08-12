import { describe, expect, it } from "vitest";
import { BOOK_OF_ONES_INTERPRETATIONS } from "../bookOfOnesInterpretations";

describe("BOOK_OF_ONES_INTERPRETATIONS", () => {
  it("covers five Book of Ones suttas with Book of Elevens-style image slots", () => {
    expect(BOOK_OF_ONES_INTERPRETATIONS).toHaveLength(5);
    expect(BOOK_OF_ONES_INTERPRETATIONS.map((x) => x.suttaId)).toEqual([
      "AN 1.18.13",
      "AN 1.19",
      "AN 1.19.2",
      "AN 1.20.1",
      "AN 1.20.2",
    ]);
    expect(BOOK_OF_ONES_INTERPRETATIONS.map((x) => x.imageIndex)).toEqual([1, 2, 3, 4, 5]);
  });
});
