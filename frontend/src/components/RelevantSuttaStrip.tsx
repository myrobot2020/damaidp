import { Link } from "@tanstack/react-router";
import { ChevronRight, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getItems, type ItemSummary } from "@/lib/damaApi";
import { getNextSuttaInBook, getSuttaPositionInBook } from "@/lib/suttaNavOrder";

const FETCH_MS = 15000;

function headingFromSummary(it: ItemSummary): string {
  const t = it.title?.trim();
  return t || it.suttaid;
}

export function RelevantSuttaStrip({
  suttaId,
  label = "Next sutta",
  audioEnabled,
}: {
  suttaId: string;
  label?: string;
  audioEnabled: boolean;
}) {
  const id = (suttaId || "").trim();
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [load, setLoad] = useState<"idle" | "loading" | "ok" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const timer = window.setTimeout(() => ac.abort(), FETCH_MS);
    setLoad("loading");
    (async () => {
      try {
        const data = await getItems({ book: "all" }, ac.signal);
        if (cancelled) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setLoad("ok");
      } catch {
        if (cancelled) return;
        setItems([]);
        setLoad("error");
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      ac.abort();
    };
  }, []);

  const nextItem = useMemo(() => {
    if (!id || load !== "ok" || items.length === 0) return null;
    return getNextSuttaInBook(items, id);
  }, [id, items, load]);

  const nextPosition = useMemo(() => {
    if (!nextItem || load !== "ok" || items.length === 0) return null;
    return getSuttaPositionInBook(items, nextItem.suttaid);
  }, [nextItem, items, load]);

  if (!id) return null;

  const targetId = nextItem?.suttaid ?? id;
  const title = nextItem ? headingFromSummary(nextItem) : id;
  const detail = nextPosition ? `${nextPosition.position}/${nextPosition.total}` : targetId;
  const displayLabel = load === "ok" && !nextItem ? "Last sutta in this book" : label;

  return (
    <Link
      to="/sutta/$suttaId"
      params={{ suttaId: targetId }}
      className="mb-1.5 flex items-center gap-2 rounded-2xl bg-background px-3 py-2.5 ring-1 ring-primary/25 transition-colors hover:bg-primary/10"
    >
      <ChevronRight size={20} className="shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1 text-left">
        <div className="label-mono text-[10px] text-muted-foreground leading-tight">
          {load === "loading" || load === "idle" ? "Finding next sutta" : displayLabel}
        </div>
        <div className="text-sm font-medium text-foreground truncate">{title}</div>
        <div className="label-mono text-[11px] text-primary/90 truncate">{detail}</div>
      </div>
      <div
        className={`size-9 rounded-full glass flex items-center justify-center shrink-0 ${
          audioEnabled && !nextItem ? "text-primary" : "text-muted-foreground opacity-40"
        }`}
        aria-label={nextItem ? "Open next sutta" : audioEnabled ? "Audio available" : "Audio disabled"}
        title={nextItem ? "Open next sutta" : audioEnabled ? "Open sutta to play audio" : "Audio unlocks on review (yellow leaf)"}
      >
        <Play size={16} className="ml-0.5" />
      </div>
    </Link>
  );
}
