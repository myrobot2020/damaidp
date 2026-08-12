import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AN_NIPATA_OPTIONS, filterItemsByNipata, getItems, ItemSummary } from "@/lib/damaApi";

type Props = {
  className?: string;
  listMaxClassName?: string;
  heading?: string;
  description?: ReactNode;
};

export function CorpusIndexPanel({
  className = "",
  listMaxClassName = "max-h-44",
  heading = "Corpus index (an1–an11)",
  description = (
    <>
      Same layout as repo folders <span className="text-foreground/80">an1</span> …{" "}
      <span className="text-foreground/80">an11</span>. Loads merged corpus once, then filters by
      nipāta. Requires dama5 on port 8000 (Vite proxy).
    </>
  ),
}: Props) {
  const [nipata, setNipata] = useState<string>("all");
  const [rawItems, setRawItems] = useState<ItemSummary[]>([]);
  const [indexStatus, setIndexStatus] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [indexError, setIndexError] = useState("");

  useEffect(() => {
    const ac = new AbortController();
    setIndexStatus("loading");
    setIndexError("");
    (async () => {
      try {
        const data = await getItems({ book: "all" }, ac.signal);
        setRawItems(Array.isArray(data.items) ? data.items : []);
        setIndexStatus("ok");
      } catch (e) {
        if (ac.signal.aborted) return;
        setIndexStatus("error");
        setIndexError(e instanceof Error ? e.message : String(e));
        setRawItems([]);
      }
    })();
    return () => ac.abort();
  }, []);

  const filteredItems = useMemo(() => filterItemsByNipata(rawItems, nipata), [rawItems, nipata]);

  return (
    <section className={`glass rounded-2xl p-4 ${className}`.trim()}>
      <div className="label-mono text-primary">{heading}</div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <label className="mt-3 flex flex-col gap-1">
        <span className="text-[10px] label-mono text-muted-foreground">Collection</span>
        <select
          value={nipata}
          onChange={(e) => setNipata(e.target.value)}
          className="w-full rounded-xl bg-background/40 border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {AN_NIPATA_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {indexStatus === "loading" && (
        <p className="mt-3 text-xs text-muted-foreground">Loading list…</p>
      )}
      {indexStatus === "error" && (
        <p className="mt-3 text-xs text-destructive break-words">{indexError}</p>
      )}
      {indexStatus === "ok" && (
        <p className="mt-2 text-xs text-muted-foreground">
          Showing {filteredItems.length} of {rawItems.length} suttas
        </p>
      )}
      <div className={`mt-3 overflow-y-auto space-y-1 pr-1 ${listMaxClassName}`}>
        {filteredItems.map((it) => (
          <Link
            key={it.suttaid}
            to="/sutta/$suttaId"
            params={{ suttaId: it.suttaid }}
            className="block rounded-xl px-3 py-2 text-sm bg-background/30 hover:bg-primary/10 border border-border/40"
          >
            <span className="label-mono text-primary text-xs">{it.suttaid}</span>
            <span className="block text-[13px] text-foreground/85 line-clamp-1">
              {it.title?.trim() || "—"}
            </span>
          </Link>
        ))}
        {indexStatus === "ok" && filteredItems.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">No suttas for this collection.</p>
        )}
      </div>
    </section>
  );
}
