import { describe, expect, it } from "vitest";

import { scoreReadSuttaForQuestion, selectReadSuttaContexts } from "../readSuttaContext";

describe("read sutta context selection", () => {
  const contexts = [
    {
      suttaid: "1.1",
      title: "Heedfulness",
      text: "A short teaching about careful effort.",
    },
    {
      suttaid: "11.16",
      title: "Loving-kindness",
      text: "A person develops loving kindness and sleeps at ease.",
    },
  ];

  it("scores question terms against marked-read sutta text", () => {
    expect(
      scoreReadSuttaForQuestion(contexts[1], "How do I practice kindness tonight?"),
    ).toBeGreaterThan(
      scoreReadSuttaForQuestion(contexts[0], "How do I practice kindness tonight?"),
    );
  });

  it("selects the most relevant marked-read excerpts first", () => {
    expect(selectReadSuttaContexts(contexts, "kindness sleep", 1)).toEqual([contexts[1]]);
  });
});
