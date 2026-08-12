import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CorpusHeaderNav } from "@/components/CorpusHeaderNav";
import {
  AN_NIPATA_OPTIONS,
  filterItemsByNikaya,
  filterItemsByNikayaBook,
  getItems,
  ItemSummary,
  NIKAYA_OPTIONS,
  otherNikayaBookFromSuttaId,
  type NikayaId,
} from "@/lib/damaApi";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return v;
}

export const Route = createFileRoute("/browse")({
  head: () => ({
    meta: [{ title: "Browse Suttas — DAMA" }],
  }),
  component: BrowseScreen,
});

function BrowseScreen() {
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 250);
  const [nikayaFilter, setNikayaFilter] = useState<NikayaId | "all">("AN");
  const [bookFilter, setBookFilter] = useState<string>("all");
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const query = useMemo(() => dq.trim(), [dq]);

  useEffect(() => {
    setBookFilter("all");
  }, [nikayaFilter]);

  const filteredItems = useMemo(() => {
    if (nikayaFilter === "all") return items;
    return filterItemsByNikayaBook(items, nikayaFilter, bookFilter);
  }, [items, nikayaFilter, bookFilter]);

  const bookOptions = useMemo(() => {
    if (nikayaFilter === "all") {
      return [{ value: "all", label: "All collections" }];
    }
    if (nikayaFilter === "AN") return AN_NIPATA_OPTIONS;
    const sub = filterItemsByNikaya(items, nikayaFilter);
    const nums = Array.from(
      new Set(
        sub
          .map((it) => otherNikayaBookFromSuttaId(it.suttaid))
          .filter((x): x is number => x != null),
      ),
    ).sort((a, b) => a - b);
    return [
      { value: "all", label: "All books" },
      ...nums.map((n) => ({ value: String(n), label: `Book ${n}` })),
    ];
  }, [nikayaFilter, items]);

  useEffect(() => {
    const ac = new AbortController();
    setStatus("loading");
    setErrorMsg("");
    (async () => {
      try {
        const data = await getItems({ q: query, book: "all" }, ac.signal);
        setItems(Array.isArray(data.items) ? data.items : []);
        setStatus("ok");
      } catch (e) {
        if (ac.signal.aborted) return;
        setStatus("error");
        setErrorMsg(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => ac.abort();
  }, [query]);

  return (
    <div className="min-h-screen dama-screen">
      <ScreenHeader showBack={false} center={<CorpusHeaderNav />} />
      <div className="px-5">
        <div className="mt-2">
          <div className="label-mono text-muted-foreground">Search</div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type a sutta id or keyword…"
            className="mt-2 w-full glass rounded-2xl px-4 py-3 text-[15px] bg-transparent focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
          />
        </div>

        <label className="mt-3 block">
          <div className="label-mono text-muted-foreground">Nikāya</div>
          <select
            value={nikayaFilter}
            onChange={(e) => setNikayaFilter(e.target.value as NikayaId | "all")}
            className="mt-2 w-full glass rounded-2xl px-4 py-3 text-[15px] bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All nikāyas</option>
            {NIKAYA_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.title}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block">
          <div className="label-mono text-muted-foreground">Book / division</div>
          <select
            value={bookFilter}
            onChange={(e) => setBookFilter(e.target.value)}
            disabled={nikayaFilter === "all"}
            className="mt-2 w-full glass rounded-2xl px-4 py-3 text-[15px] bg-transparent focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          >
            {bookOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {status === "error" && (
          <div className="mt-5 glass rounded-2xl p-4">
            <div className="label-mono text-destructive">Could not load items</div>
            <p className="mt-2 text-sm text-muted-foreground break-words">
              {errorMsg || "Unknown error"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Make sure GCS index is updated.
            </p>
          </div>
        )}

        <div className="mt-5">
          <div className="label-mono text-muted-foreground mb-2">
            {status === "loading"
              ? "Loading…"
              : `${filteredItems.length} shown${nikayaFilter !== "all" || bookFilter !== "all" ? ` (${items.length} from search)` : ""}`}
          </div>
          <div className="space-y-2">
            {filteredItems.slice(0, 200).map((it) => (
              <Link
                key={it.suttaid}
                to="/sutta/$suttaId"
                params={{ suttaId: it.suttaid }}
                className="glass rounded-2xl p-4 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="label-mono text-primary">{it.suttaid}</div>
                  <div className="mt-1 text-sm text-foreground/85 truncate">
                    {it.title?.trim() || "Untitled"}
                  </div>
                </div>
                {!!it.has_commentary && (
                  <span className="shrink-0 px-2 py-1 rounded-full bg-primary/10 ring-1 ring-primary/25 text-xs text-primary">
                    comm.
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
