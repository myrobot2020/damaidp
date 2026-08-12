import { useEffect, useRef, useState } from "react";

import type { Session } from "@supabase/supabase-js";

import { readUxLog, subscribeUxLog, type UxEvent } from "@/lib/uxLog";
import { supabase } from "@/lib/supabase";

const UX_LAST_SYNCED_MS_KEY = "dama:uxLogSyncedMs";

function getLastSyncedMs(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(UX_LAST_SYNCED_MS_KEY) ?? "";
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function setLastSyncedMs(ms: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(UX_LAST_SYNCED_MS_KEY, String(ms));
}

type UxRow = {
  user_id: string;
  device_id: string;
  name: string;
  props: Record<string, unknown> | null;
  t: string;
};

function toRows(userId: string, events: readonly UxEvent[], afterMs: number): UxRow[] {
  const rows: UxRow[] = [];
  for (const ev of events) {
    if (!ev || typeof ev.t !== "number") continue;
    if (ev.t <= afterMs) continue;
    if (!ev.name) continue;
    rows.push({
      user_id: userId,
      device_id: ev.deviceId || "unknown",
      name: ev.name,
      props: (ev.props && typeof ev.props === "object" ? (ev.props as Record<string, unknown>) : null) as
        | Record<string, unknown>
        | null,
      t: new Date(ev.t).toISOString(),
    });
  }
  return rows;
}

async function pushUxEvents(userId: string): Promise<number> {
  if (!supabase) return 0;
  const events = readUxLog();
  const after = getLastSyncedMs();
  const rows = toRows(userId, events, after);
  if (rows.length === 0) return after;
  const { error } = await supabase.from("ux_events").insert(rows);
  if (error) throw error;
  const maxT = Math.max(...rows.map((r) => Date.parse(r.t)));
  const next = Number.isFinite(maxT) ? Math.max(after, maxT) : after;
  setLastSyncedMs(next);
  return next;
}

function scheduleMicrotask(cb: () => void) {
  Promise.resolve().then(cb).catch(() => {});
}

/**
 * Optional UX event sync (append-only). If the `ux_events` table is not installed, it silently no-ops.
 */
export function useUxLogSync(session: Session | null, enabled: boolean) {
  const [armed, setArmed] = useState(false);
  const disabledRef = useRef(false);
  const syncingRef = useRef(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !supabase || !session?.user?.id) return;
    const userId = session.user.id;
    let cancelled = false;
    (async () => {
      try {
        await pushUxEvents(userId);
        if (cancelled) return;
        setArmed(true);
      } catch {
        // Table missing or RLS not applied. Disable to avoid spamming requests.
        disabledRef.current = true;
        setArmed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, session?.user?.id]);

  useEffect(() => {
    if (!enabled || !supabase || !session?.user?.id || !armed) return;
    if (disabledRef.current) return;
    const userId = session.user.id;

    const unsub = subscribeUxLog(() => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        if (syncingRef.current) return;
        syncingRef.current = true;
        scheduleMicrotask(() => {
          void pushUxEvents(userId)
            .catch(() => {
              disabledRef.current = true;
            })
            .finally(() => {
              syncingRef.current = false;
            });
        });
      }, 1000);
    });

    return () => {
      unsub();
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    };
  }, [armed, enabled, session?.user?.id]);
}

