import { useEffect, useRef, useState } from "react";

import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { isFreshStartInProgress } from "@/lib/freshStart";
import {
  type ReadingProgressMap,
  mergeReadingProgress,
  readReadingProgress,
  subscribeReadingProgress,
} from "@/lib/readingProgress";

type ReadingProgressRow = {
  user_id: string;
  sutta_id: string;
  opened_at: string | null;
  open_count: number | null;
  read_at: string | null;
};

function readingMapToRows(userId: string, map: ReadingProgressMap): ReadingProgressRow[] {
  const rows: ReadingProgressRow[] = [];
  for (const [suttaId, it] of Object.entries(map)) {
    const sid = suttaId.trim();
    if (!sid) continue;
    rows.push({
      user_id: userId,
      sutta_id: sid,
      opened_at: it.openedAtMs ? new Date(it.openedAtMs).toISOString() : null,
      open_count: typeof it.openCount === "number" ? it.openCount : null,
      read_at: it.readAtMs ? new Date(it.readAtMs).toISOString() : null,
    });
  }
  return rows;
}

async function pullReadingProgress(userId: string): Promise<ReadingProgressMap> {
  if (!supabase) return {};
  const { data, error } = await supabase
    .from("reading_progress")
    .select("sutta_id, opened_at, open_count, read_at")
    .eq("user_id", userId);
  if (error) throw error;
  const out: ReadingProgressMap = {};
  for (const row of (data ?? []) as Array<{
    sutta_id: string;
    opened_at: string | null;
    open_count: number | null;
    read_at: string | null;
  }>) {
    const sid = (row.sutta_id || "").trim();
    if (!sid) continue;
    const openedAtMs = row.opened_at ? Date.parse(row.opened_at) : 0;
    const readAtMs = row.read_at ? Date.parse(row.read_at) : undefined;
    out[sid] = {
      openedAtMs: Number.isFinite(openedAtMs) ? openedAtMs : 0,
      readAtMs: Number.isFinite(readAtMs) ? readAtMs : undefined,
      openCount: typeof row.open_count === "number" ? row.open_count : undefined,
    };
  }
  return out;
}

async function pushReadingProgress(userId: string): Promise<void> {
  if (!supabase) return;
  const map = readReadingProgress();
  const rows = readingMapToRows(userId, map);
  if (rows.length === 0) return;
  const { error } = await supabase
    .from("reading_progress")
    .upsert(rows, { onConflict: "user_id,sutta_id" });
  if (error) throw error;
}

function scheduleMicrotask(cb: () => void) {
  Promise.resolve().then(cb).catch(() => {});
}

/**
 * Best-effort local↔Supabase sync for reading progress.
 *
 * - Pull once after sign-in (merge into local).
 * - Then push changes with a short debounce.
 * - Failures are non-fatal (app remains local-first).
 */
export function useReadingProgressSync(session: Session | null, enabled: boolean) {
  const [armed, setArmed] = useState(false);
  const syncingRef = useRef(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !supabase || !session?.user?.id) return;
    const userId = session.user.id;
    if (typeof window !== "undefined" && isFreshStartInProgress(userId)) {
      setArmed(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const remote = await pullReadingProgress(userId);
        if (cancelled) return;
        mergeReadingProgress(remote);
        setArmed(true);
      } catch {
        // Missing table/RLS/etc — keep local-only.
        setArmed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, session?.user?.id]);

  useEffect(() => {
    if (!enabled || !supabase || !session?.user?.id || !armed) return;
    const userId = session.user.id;

    const unsub = subscribeReadingProgress(() => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        if (syncingRef.current) return;
        syncingRef.current = true;
        scheduleMicrotask(() => {
          void pushReadingProgress(userId).finally(() => {
            syncingRef.current = false;
          });
        });
      }, 750);
    });

    // Initial push (after pull merge) so Supabase has our latest.
    void pushReadingProgress(userId).catch(() => {});

    return () => {
      unsub();
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    };
  }, [armed, enabled, session?.user?.id]);
}
