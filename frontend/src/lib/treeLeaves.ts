import {
  anBookFromSuttaId,
  filterItemsByNikaya,
  filterItemsByNikayaBook,
  filterItemsByNipata,
  inferNikayaFromSuttaId,
  otherNikayaBookFromSuttaId,
  type ItemSummary,
  type NikayaId,
} from "./damaApi";
import { hydrateLeaf, type Leaf, type LeavesStore } from "./leaves";

export type TreeCollection = NikayaId | "ALL";

export type TreeBook = {
  nikaya: TreeCollection;
  book: string;
};

export function getTreeBooksForNikaya(items: ItemSummary[], nikaya: TreeCollection): string[] {
  if (nikaya === "ALL") return items.length > 0 ? ["all"] : [];

  const books = new Set<string>();
  for (const item of filterItemsByNikaya(items, nikaya)) {
    const book =
      nikaya === "AN" ? anBookFromSuttaId(item.suttaid) : otherNikayaBookFromSuttaId(item.suttaid);
    if (book != null) books.add(String(book));
  }
  const out = [...books].sort((a, b) => Number(a) - Number(b));
  return out.length > 0 ? ["all", ...out] : [];
}

export function countTreeItemsByCollection(items: ItemSummary[]): Record<TreeCollection, number> {
  const counts: Record<TreeCollection, number> = {
    ALL: items.length,
    AN: 0,
    SN: 0,
    DN: 0,
    MN: 0,
    KN: 0,
  };
  for (const item of items) {
    const nikaya = inferNikayaFromSuttaId(item.suttaid);
    counts[nikaya]++;
  }
  return counts;
}

export function resolveTreeBook(focus: string | undefined | null): TreeBook {
  const id = (focus ?? "").trim();
  const nikaya = id ? inferNikayaFromSuttaId(id) : "AN";
  if (nikaya === "AN") return { nikaya, book: String(anBookFromSuttaId(id) ?? 1) };
  return { nikaya, book: String(otherNikayaBookFromSuttaId(id) ?? 1) };
}

export function getSuttasForTreeBook(items: ItemSummary[], treeBook: TreeBook): ItemSummary[] {
  if (treeBook.nikaya === "ALL") {
    return [...items].sort((a, b) =>
      a.suttaid.localeCompare(b.suttaid, undefined, { numeric: true }),
    );
  }

  const nikayaItems = filterItemsByNikaya(items, treeBook.nikaya);
  if (treeBook.book === "all") {
    return [...nikayaItems].sort((a, b) =>
      a.suttaid.localeCompare(b.suttaid, undefined, { numeric: true }),
    );
  }

  const filtered =
    treeBook.nikaya === "AN"
      ? filterItemsByNipata(nikayaItems, treeBook.book)
      : filterItemsByNikayaBook(items, treeBook.nikaya, treeBook.book);
  return [...filtered].sort((a, b) =>
    a.suttaid.localeCompare(b.suttaid, undefined, { numeric: true }),
  );
}

export function buildTreeLeaves(
  suttasInBook: ItemSummary[],
  leaves: LeavesStore,
  nowMs: number,
  hasCorpusIndex: boolean,
): Leaf[] {
  if (hasCorpusIndex) {
    return suttasInBook.map((it) => {
      const saved = leaves[it.suttaid];
      return saved
        ? hydrateLeaf(saved, nowMs)
        : { suttaId: it.suttaid, state: "grey", createdAtMs: nowMs, updatedAtMs: nowMs };
    });
  }

  return Object.keys(leaves)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((id) => hydrateLeaf(leaves[id]!, nowMs));
}
