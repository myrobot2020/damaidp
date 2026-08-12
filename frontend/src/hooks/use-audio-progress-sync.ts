import { useEffect, useRef, useState } from "react";

import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { isFreshStartInProgress } from "@/lib/freshStart";
import {
  mergeAudioListenProgress,
  readAudioListenProgress,
  subscribeAudioListenProgress,
  type AudioListenProgressMap,
} from "@/lib/audioListenProgress";

type AudioProgressRow = {
  user_id: string;
  sutta_id: string;
  fraction: number;
};

function audioMapToRows(userId: string, map: AudioListenProgressMap): AudioProgressRow[] {
  const rows: AudioProgressRow[] = [];
  for (const [suttaId, frac] of Object.entries(map)) {
    const sid = suttaId.trim();
    if (!sid) continue;
    const f = typeof frac === "number" ? frac : Number(frac);
    if (!Number.isFinite(f)) continue;
    rows.push({
      user_id: userId,
      sutta_id: sid,
      fraction: Math.min(1, Math.max(0, f)),
    });
  }
  return rows;
}

async function pullAudioProgress(userId: string): Promise<AudioListenProgressMap> {
  if (!supabase) return {};
  const { data, error } = await supabase
    .from("audio_listen_progress")
    .select("sutta_id, fraction")
    .eq("user_id", userId);
  if (error) throw error;
  const out: AudioListenProgressMap = {};
  for (const row of (data ?? []) as Array<{ sutta_id: string; fraction: number }>) {
    const sid = (row.sutta_id || "").trim();
    if (!sid) continue;
    const f = typeof row.fraction === "number" ? row.fraction : Number(row.fraction);
    if (!Number.isFinite(f)) continue;
    out[sid] = Math.min(1, Math.max(0, f));
  }
  return out;
}

async function pushAudioProgress(userId: string): Promise<void> {
  if (!supabase) return;
  const map = readAudioListenProgress();
  const rows = audioMapToRows(userId, map);
  if (rows.length === 0) return;
  const { error } = await supabase
    .from("audio_listen_progress")
    .upsert(rows, { onConflict: "user_id,sutta_id" });
  if (error) throw error;
}

function scheduleMicrotask(cb: () => void) {
  Promise.resolve().then(cb).catch(() => {});
}

export function useAudioProgressSync(session: Session | null, enabled: boolean) {
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
        const remote = await pullAudioProgress(userId);
        if (cancelled) return;
        mergeAudioListenProgress(remote);
        setArmed(true);
      } catch {
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

    const unsub = subscribeAudioListenProgress(() => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        if (syncingRef.current) return;
        syncingRef.current = true;
        scheduleMicrotask(() => {
          void pushAudioProgress(userId).finally(() => {
            syncingRef.current = false;
          });
        });
      }, 750);
    });

    void pushAudioProgress(userId).catch(() => {});

    return () => {
      unsub();
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    };
  }, [armed, enabled, session?.user?.id]);
}
