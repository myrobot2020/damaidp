import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  AN_BOOK_TITLES,
  anBookFromSuttaId,
  canonIndexSubtitle,
  getItem,
  itemDisplayHeading,
  stripTranscriptNoise,
  type ItemDetail,
} from "@/lib/damaApi";

export const Route = createFileRoute("/book-transition")({
  head: () => ({
    meta: [
      { title: "Book Complete — DAMA" },
      { name: "description", content: "A pause between books." },
    ],
  }),
  component: BookTransitionScreen,
});

function bookLabel(id: string): string {
  const anBook = anBookFromSuttaId(id);
  if (anBook != null) return AN_BOOK_TITLES[anBook] ?? `Book ${anBook}`;
  const m = id.trim().match(/^([A-Z]+)\s+(\d+)\./i);
  if (m) return `${m[1].toUpperCase()} Book ${m[2]}`;
  return "Next book";
}

function quoteFromItem(item: ItemDetail | null, fallbackId: string): string {
  const text = stripTranscriptNoise(item?.sc_sutta || item?.sutta || "");
  if (!text) return `You have completed ${bookLabel(fallbackId)}.`;
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 260 ? `${compact.slice(0, 260).trim()}...` : compact;
}

function BookTransitionScreen() {
  const search = Route.useSearch() as { from?: string; to?: string };
  const from = (search.from || "").trim();
  const to = (search.to || "").trim();
  const quoteId = to || from;
  const [quoteItem, setQuoteItem] = useState<ItemDetail | null>(null);

  useEffect(() => {
    if (!quoteId) return;
    let cancelled = false;
    const ac = new AbortController();
    getItem(quoteId, undefined, ac.signal)
      .then((item) => {
        if (!cancelled) setQuoteItem(item);
      })
      .catch(() => {
        if (!cancelled) setQuoteItem(null);
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [quoteId]);

  const quote = useMemo(() => quoteFromItem(quoteItem, quoteId), [quoteItem, quoteId]);
  const quoteTitle = quoteItem ? itemDisplayHeading(quoteItem) : quoteId;
  const targetBook = to ? bookLabel(to) : "Book of Ones";

  return (
    <div className="min-h-screen dama-screen">
      <ScreenHeader title={targetBook} />
      <main className="px-5 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="label-mono text-primary">Book cover</div>
        <h1 className="mt-2 text-[24px] leading-tight font-semibold tracking-tight">{targetBook}</h1>

        <section className="mt-6 rounded-2xl glass p-5 ring-1 ring-primary/20">
          <div className="label-mono text-[10px] text-muted-foreground">
            {quoteId ? `Quote · ${quoteTitle}` : "Quote"}
          </div>
          <p className="mt-3 text-base leading-relaxed text-foreground/90">"{quote}"</p>
          {quoteId ? (
            <div className="mt-4 text-[11px] text-muted-foreground label-mono normal-case">
              {canonIndexSubtitle(quoteId)}
            </div>
          ) : null}
        </section>

        {to ? (
          <Link
            to="/tree"
            search={{ focus: to }}
            className="mt-6 flex items-center justify-between rounded-2xl bg-primary px-4 py-4 font-semibold text-primary-foreground shadow-lg shadow-primary/20"
          >
            <span>Open tree</span>
            <ChevronRight size={20} />
          </Link>
        ) : (
          <Link
            to="/sutta"
            className="mt-6 flex items-center justify-between rounded-2xl bg-primary px-4 py-4 font-semibold text-primary-foreground shadow-lg shadow-primary/20"
          >
            <span>Start again</span>
            <ChevronRight size={20} />
          </Link>
        )}
      </main>
    </div>
  );
}
