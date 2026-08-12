import { describe, expect, it } from "vitest";
import { ensureEnglishSuttaSuffix } from "../suttaTitle";

describe("suttaTitle", () => {
  it("adds a lowercase sutta suffix and title-cases words", () => {
    expect(ensureEnglishSuttaSuffix("SHOPKEEPER")).toBe("Shopkeeper sutta");
    expect(ensureEnglishSuttaSuffix("loving kindness")).toBe("Loving Kindness sutta");
  });

  it("does not duplicate an existing sutta suffix", () => {
    expect(ensureEnglishSuttaSuffix("shopkeeper sutta")).toBe("Shopkeeper sutta");
    expect(ensureEnglishSuttaSuffix("shopkeeper SUTTA ")).toBe("Shopkeeper sutta");
  });

  it("returns blank input as-is after trimming", () => {
    expect(ensureEnglishSuttaSuffix("   ")).toBe("");
  });
});
