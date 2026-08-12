import { useState, useEffect } from "react";
import { getItems, ItemSummary } from "@/lib/damaApi";

interface CorpusCacheEntry {
  promise: Promise<{ items: ItemSummary[] }>;
  data?: ItemSummary[];
}

const corpusCache = new Map<string, CorpusCacheEntry>();

export function useCorpusItems(
  options?: { q?: string; book?: string },
  signal?: AbortSignal,
) {
  const cacheKey = JSON.stringify(options ?? {});
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [load, setLoad] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoad("loading");

    let entry = corpusCache.get(cacheKey);
    if (!entry) {
      const promise = getItems(options, signal);
      entry = { promise };
      corpusCache.set(cacheKey, entry);
    }

    entry.promise
      .then((res) => {
        if (cancelled) return;
        const fetchedItems = res.items || [];
        entry!.data = fetchedItems;
        setItems(fetchedItems);
        setLoad("ok");
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setItems([]);
        setLoad("error");
        setError(err instanceof Error ? err.message : "Failed to load items");
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey]);

  return { items, load, error };
}
