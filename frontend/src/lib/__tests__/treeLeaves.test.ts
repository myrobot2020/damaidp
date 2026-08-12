import { describe, expect, it } from "vitest";
import type { ItemSummary } from "../damaApi";
import type { LeavesStore } from "../leaves";
import {
  buildTreeLeaves,
  countTreeItemsByCollection,
  getSuttasForTreeBook,
  getTreeBooksForNikaya,
  resolveTreeBook,
} from "../treeLeaves";

const items = (ids: string[]): ItemSummary[] => ids.map((suttaid) => ({ suttaid }));

describe("treeLeaves", () => {
  it("defaults the tree to AN Book of Ones", () => {
    expect(resolveTreeBook("")).toEqual({ nikaya: "AN", book: "1" });
    expect(resolveTreeBook(undefined)).toEqual({ nikaya: "AN", book: "1" });
  });

  it("uses the focused sutta to choose the AN book", () => {
    expect(resolveTreeBook("5.42")).toEqual({ nikaya: "AN", book: "5" });
    expect(resolveTreeBook("AN 11.16")).toEqual({ nikaya: "AN", book: "11" });
  });

  it("counts leaves from every sutta in the selected AN book", () => {
    const book = resolveTreeBook("1.1");
    const suttas = getSuttasForTreeBook(items(["1.10", "2.1", "1.2", "SN 1.1"]), book);
    expect(suttas.map((it) => it.suttaid)).toEqual(["1.2", "1.10"]);

    const leaves = buildTreeLeaves(suttas, {}, 1000, true);
    expect(leaves).toHaveLength(2);
    expect(leaves.map((leaf) => leaf.suttaId)).toEqual(["1.2", "1.10"]);
    expect(leaves.every((leaf) => leaf.state === "grey")).toBe(true);
  });

  it("lists available books for each nikaya from the corpus index", () => {
    const corpus = items(["1.2", "11.16", "SN 1.1", "SN 2.1", "DN 1.1", "MN 10.1"]);

    expect(getTreeBooksForNikaya(corpus, "ALL")).toEqual(["all"]);
    expect(getTreeBooksForNikaya(corpus, "AN")).toEqual(["all", "1", "11"]);
    expect(getTreeBooksForNikaya(corpus, "SN")).toEqual(["all", "1", "2"]);
    expect(getTreeBooksForNikaya(corpus, "DN")).toEqual(["all", "1"]);
    expect(getTreeBooksForNikaya(corpus, "MN")).toEqual(["all", "10"]);
  });

  it("supports all-books views", () => {
    const corpus = items(["1.2", "11.16", "SN 1.1", "SN 2.1"]);

    expect(
      getSuttasForTreeBook(corpus, { nikaya: "AN", book: "all" }).map((it) => it.suttaid),
    ).toEqual(["1.2", "11.16"]);
    expect(
      getSuttasForTreeBook(corpus, { nikaya: "ALL", book: "all" }).map((it) => it.suttaid),
    ).toEqual(["1.2", "11.16", "SN 1.1", "SN 2.1"]);
  });

  it("counts indexed items by collection", () => {
    expect(countTreeItemsByCollection(items(["1.2", "SN 1.1", "SN 2.1", "DN 1.1"]))).toMatchObject({
      ALL: 4,
      AN: 1,
      SN: 2,
      DN: 1,
      MN: 0,
      KN: 0,
    });
  });

  it("layers saved leaf progress onto corpus-generated leaves", () => {
    const suttas = getSuttasForTreeBook(items(["1.1", "1.2"]), resolveTreeBook("1.1"));
    const stored: LeavesStore = {
      "1.2": {
        suttaId: "1.2",
        state: "gold",
        createdAtMs: 1,
        updatedAtMs: 2,
        goldAtMs: 2,
      },
      "9.1": {
        suttaId: "9.1",
        state: "green",
        createdAtMs: 1,
        updatedAtMs: 2,
      },
    };

    const leaves = buildTreeLeaves(suttas, stored, 1000, true);
    expect(leaves.map((leaf) => [leaf.suttaId, leaf.state])).toEqual([
      ["1.1", "grey"],
      ["1.2", "gold"],
    ]);
  });

  it("does not fall back to unrelated saved leaves when the corpus index is loaded", () => {
    const stored: LeavesStore = {
      "9.1": {
        suttaId: "9.1",
        state: "green",
        createdAtMs: 1,
        updatedAtMs: 2,
      },
    };

    expect(buildTreeLeaves([], stored, 1000, true)).toEqual([]);
  });

  it("falls back to saved leaves before the corpus index is available", () => {
    const stored: LeavesStore = {
      "9.1": {
        suttaId: "9.1",
        state: "green",
        createdAtMs: 1,
        updatedAtMs: 2,
      },
    };

    expect(buildTreeLeaves([], stored, 1000, false).map((leaf) => leaf.suttaId)).toEqual(["9.1"]);
  });
});
