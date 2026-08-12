import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getItems, type ItemSummary, AN_BOOK_TITLES } from "@/lib/damaApi";

export function NextSuttaStrip({ currentSuttaId }: { currentSuttaId?: string }) {
  const [items, setItems] = useState<ItemSummary[]>([]);

  useEffect(() => {
    getItems().then(res => setItems(res.items)).catch(() => {});
  }, []);

  const sortedItems = useMemo(() => {
      return [...items].sort((a, b) => a.suttaid.localeCompare(b.suttaid, undefined, { numeric: true }));
  }, [items]);

  const currentIndex = useMemo(() => {
      return sortedItems.findIndex(it => it.suttaid === currentSuttaId);
  }, [sortedItems, currentSuttaId]);

  const prevItem = currentIndex > 0 ? sortedItems[currentIndex - 1] : null;
  const nextItem = currentIndex < sortedItems.length - 1 ? sortedItems[currentIndex + 1] : null;

  const getPositionLabel = (item: ItemSummary) => {
      const bookItems = items.filter(it => it.nikaya === item.nikaya && it.book === item.book);
      const pos = bookItems.findIndex(it => it.suttaid === item.suttaid) + 1;
      return `${pos}/${bookItems.length}`;
  };

  const navCard = (dir: "prev" | "next", item: ItemSummary) => {
      const isNext = dir === "next";
      const Icon = isNext ? ChevronRight : ChevronLeft;
      const crossesBook = currentSuttaId && (item.nikaya !== currentSuttaId.split(" ")[0] || item.book !== currentSuttaId.replace(/^[A-Z]+\s+/, "").split(".")[0]);

      const label = crossesBook ? (isNext ? "Next Book" : "Prev Book") : (isNext ? "Next Sutta" : "Prev Sutta");
      const title = crossesBook
        ? (item.nikaya === "AN" ? AN_BOOK_TITLES[parseInt(item.book)] : `Book ${item.book}`)
        : item.title;

      return (
        <Link
          to="/sutta/$suttaId"
          params={{ suttaId: item.suttaid }}
          className="flex-1 flex items-center gap-2 bg-background border paper-rule px-4 py-3 rounded-2xl hover:text-primary transition-all active:scale-[0.98]"
        >
          {!isNext && <Icon size={18} className="text-primary shrink-0" />}
          <div className={`min-w-0 flex-1 ${isNext ? 'text-right' : 'text-left'}`}>
            <div className="label-mono text-[9px] text-muted-foreground uppercase tracking-widest">{label}</div>
            <div className="text-xs font-bold truncate">{title}</div>
            <div className="label-mono text-[10px] text-primary">{getPositionLabel(item)}</div>
          </div>
          {isNext && <Icon size={18} className="text-primary shrink-0" />}
        </Link>
      );
  };

  if (items.length === 0) return null;

  return (
    <div className="flex gap-2">
      {prevItem && navCard("prev", prevItem)}
      {nextItem && navCard("next", nextItem)}
    </div>
  );
}
