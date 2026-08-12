import { describe, expect, it } from "vitest";
import type { ItemSummary } from "../damaApi";
import {
  getFirstSuttaGlobally,
  getNextSuttaInBook,
  getNextSuttaInNikaya,
  getPreviousSuttaInBook,
  getPreviousSuttaInNikaya,
  getSuttaPositionInBook,
  parseSuttaRouteId,
  sortSuttaIds,
} from "../suttaNavOrder";

const samples = (ids: string[]): ItemSummary[] => ids.map((suttaid) => ({ suttaid }));

describe("suttaNavOrder", () => {
  it("parseSuttaRouteId extracts id", () => {
    expect(parseSuttaRouteId("/sutta/7.4.38")).toBe("7.4.38");
    expect(parseSuttaRouteId("/sutta/SN%201.1")).toBe("SN 1.1");
    expect(parseSuttaRouteId("/")).toBeUndefined();
    expect(parseSuttaRouteId("/browse")).toBeUndefined();
  });

  it("sortSuttaIds uses numeric-aware order", () => {
    const s = sortSuttaIds(samples(["10.1", "2.3", "2.10"]));
    expect(s.map((x) => x.suttaid)).toEqual(["2.3", "2.10", "10.1"]);
  });

  it("getNextSuttaInBook follows AN nipāta order", () => {
    const items = samples(["7.4.38", "7.4.39", "8.1.1"]);
    expect(getNextSuttaInBook(items, "7.4.38")?.suttaid).toBe("7.4.39");
    expect(getNextSuttaInBook(items, "7.4.39")).toBeNull();
  });

  it("getPreviousSuttaInBook follows AN nipāta order", () => {
    const items = samples(["7.4.38", "7.4.39", "8.1.1"]);
    expect(getPreviousSuttaInBook(items, "7.4.39")?.suttaid).toBe("7.4.38");
    expect(getPreviousSuttaInBook(items, "7.4.38")).toBeNull();
  });

  it("getNextSuttaInNikaya continues into the next book", () => {
    const items = samples(["1.21.47", "1.48", "2.1.2", "DN 1"]);
    expect(getNextSuttaInNikaya(items, "1.48")?.suttaid).toBe("2.1.2");
  });

  it("getPreviousSuttaInNikaya continues into the previous book", () => {
    const items = samples(["1.48", "2.1.2", "2.1.3", "DN 1"]);
    expect(getPreviousSuttaInNikaya(items, "2.1.2")?.suttaid).toBe("1.48");
  });

  it("getSuttaPositionInBook reports current position within the same book", () => {
    const items = samples(["11.6", "11.16", "11.17", "10.1"]);

    expect(getSuttaPositionInBook(items, "11.6")).toEqual({ position: 1, total: 3 });
    expect(getSuttaPositionInBook(items, "11.17")).toEqual({ position: 3, total: 3 });
    expect(getSuttaPositionInBook(items, "10.1")).toEqual({ position: 1, total: 1 });
  });

  it("getFirstSuttaGlobally picks first sorted id", () => {
    const items = samples(["10.1", "2.3"]);
    expect(getFirstSuttaGlobally(items)?.suttaid).toBe("2.3");
  });
});
