import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  NIKAYA_OPTIONS,
  getItems,
  type ItemSummary,
  type NikayaId,
  AN_BOOK_TITLES
} from "@/lib/damaApi";

export function CorpusHeaderNav({ currentSuttaId }: { currentSuttaId?: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<ItemSummary[]>([]);

  useEffect(() => {
    getItems().then(res => setItems(res.items)).catch(() => {});
  }, []);

  // Parse current state STRICTLY from the currentSuttaId prop (which follows URL)
  const currentPrefix = useMemo(() => {
    if (!currentSuttaId) return "AN";
    const p = currentSuttaId.split(" ")[0] as NikayaId;
    return ["AN", "SN", "DN", "MN", "KN"].includes(p) ? p : "AN";
  }, [currentSuttaId]);

  const currentBook = useMemo(() => {
    if (!currentSuttaId) return "1";
    // Extracts book from "AN 5.4.40" -> "5" or "SN 1.1" -> "1"
    const core = currentSuttaId.replace(/^[A-Z]+\s+/, "");
    return core.split(".")[0] || "1";
  }, [currentSuttaId]);

  // Derived Data
  const availableNikayas = useMemo(() => {
    const set = new Set(items.map(it => it.nikaya));
    return NIKAYA_OPTIONS.filter(opt => set.has(opt.value));
  }, [items]);

  const availableBooks = useMemo(() => {
    const books = Array.from(new Set(
      items.filter(it => it.nikaya === currentPrefix).map(it => it.book)
    )).sort((a, b) => parseInt(a) - parseInt(b));

    if (currentBook && !books.includes(currentBook)) {
        books.push(currentBook);
        books.sort((a, b) => parseInt(a) - parseInt(b));
    }
    return books;
  }, [items, currentPrefix, currentBook]);

  const suttasInBook = useMemo(() => {
    return items.filter(it => it.nikaya === currentPrefix && it.book === currentBook)
      .sort((a, b) => a.suttaid.localeCompare(b.suttaid, undefined, { numeric: true }));
  }, [items, currentPrefix, currentBook]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-1 w-full max-w-[26rem] mx-auto">
      {/* Collection Selector */}
      <select
        value={currentPrefix}
        onChange={(e) => {
          const nextNik = e.target.value;
          const first = items.find(it => it.nikaya === nextNik);
          if (first) navigate({ to: "/sutta/$suttaId", params: { suttaId: first.suttaid } });
        }}
        className="rounded-full bg-background/60 border paper-rule px-2 py-1 text-[9px] font-bold label-mono text-primary focus:outline-none"
      >
        {availableNikayas.length > 0 ? availableNikayas.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        )) : <option value={currentPrefix}>{currentPrefix}</option>}
      </select>

      {/* Book Selector */}
      <select
        value={currentBook}
        onChange={(e) => {
          const nextBook = e.target.value;
          const first = items.find(it => it.nikaya === currentPrefix && it.book === nextBook);
          if (first) navigate({ to: "/sutta/$suttaId", params: { suttaId: first.suttaid } });
        }}
        className="rounded-full bg-background/60 border paper-rule px-2 py-1 text-[9px] label-mono text-muted-foreground focus:outline-none"
      >
        {availableBooks.length > 0 ? availableBooks.map(b => (
          <option key={b} value={b}>
            {currentPrefix === "AN" ? AN_BOOK_TITLES[parseInt(b)] || `Book ${b}` : `Book ${b}`}
          </option>
        )) : <option value={currentBook}>Book {currentBook}</option>}
      </select>

      {/* Sutta Selector */}
      <div className="min-w-0 flex-1 max-w-[12rem]">
        <select
          value={currentSuttaId}
          onChange={(e) => navigate({ to: "/sutta/$suttaId", params: { suttaId: e.target.value } })}
          className="w-full rounded-full bg-background/60 border paper-rule px-3 py-1 text-[10px] label-mono text-muted-foreground focus:outline-none"
        >
          {suttasInBook.length > 0 ? suttasInBook.map(it => (
            <option key={it.suttaid} value={it.suttaid}>
              {it.suttaid} · {(it.title?.length ?? 0) > 18 ? it.title?.slice(0, 18) + "…" : it.title}
            </option>
          )) : <option value={currentSuttaId}>{currentSuttaId}</option>}
        </select>
      </div>
    </div>
  );
}
