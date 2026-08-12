/**
 * Simple persistent storage for reading progress (leaf collection).
 */

import { inferNikayaFromSuttaId, type NikayaId } from "./damaApi";

export const READING_PROGRESS_KEY = "dama:readingProgress";
export const READING_PROGRESS_STORAGE_KEY = READING_PROGRESS_KEY;
export const INITIAL_READING_PROGRESS_SNAPSHOT: ReadingProgressMap = {};

export type SuttaProgress = {
  openedAtMs: number;
  readAtMs?: number;
  openCount?: number;
};

export type ReadingProgressMap = Record<string, SuttaProgress>;

const listeners = new Set<() => void>();
let lastRaw: string | null = null;
let lastSnapshot: ReadingProgressMap = INITIAL_READING_PROGRESS_SNAPSHOT;

function notify(): void {
  for (const cb of listeners) cb();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === READING_PROGRESS_KEY || e.key === null) {
      lastRaw = null;
      notify();
    }
  });
}

export function subscribeReadingProgress(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function readReadingProgress(): ReadingProgressMap {
  if (typeof window === "undefined") return INITIAL_READING_PROGRESS_SNAPSHOT;
  try {
    const raw = localStorage.getItem(READING_PROGRESS_KEY);
    if (raw === lastRaw && lastRaw !== null) return lastSnapshot;

    if (raw === null) {
      lastRaw = null;
      lastSnapshot = INITIAL_READING_PROGRESS_SNAPSHOT;
      return lastSnapshot;
    }

    const data = JSON.parse(raw);
    lastRaw = raw;
    lastSnapshot = data;
    return lastSnapshot;
  } catch {
    return INITIAL_READING_PROGRESS_SNAPSHOT;
  }
}

export function recordSuttaOpened(suttaId: string, atMs?: number): void {
  if (typeof window === "undefined") return;
  const prev = readReadingProgress();
  const existing = prev[suttaId] || { openedAtMs: 0, openCount: 0 };
  const next = {
    ...prev,
    [suttaId]: {
      ...existing,
      openedAtMs: atMs ?? Date.now(),
      openCount: (existing.openCount || 0) + 1,
    },
  };
  localStorage.setItem(READING_PROGRESS_KEY, JSON.stringify(next));
  notify();
}

export function markSuttaRead(suttaId: string, atMs?: number): void {
  if (typeof window === "undefined") return;
  const prev = readReadingProgress();
  const next = {
    ...prev,
    [suttaId]: { ...(prev[suttaId] || {}), readAtMs: atMs ?? Date.now() },
  };
  localStorage.setItem(READING_PROGRESS_KEY, JSON.stringify(next));
  notify();
}

export function markSuttasRead(suttaIds: string[], atMs?: number): void {
  if (typeof window === "undefined") return;
  const prev = readReadingProgress();
  const now = atMs ?? Date.now();
  const next = { ...prev };
  for (const id of suttaIds) {
    if (!id.trim()) continue;
    next[id] = { ...(next[id] || {}), readAtMs: now };
  }
  localStorage.setItem(READING_PROGRESS_KEY, JSON.stringify(next));
  notify();
}

export function clearSuttaRead(suttaId: string): void {
  if (typeof window === "undefined") return;
  const prev = readReadingProgress();
  const entry = prev[suttaId];
  if (!entry) return;
  const { readAtMs, ...rest } = entry;
  const next = { ...prev, [suttaId]: rest };
  localStorage.setItem(READING_PROGRESS_KEY, JSON.stringify(next));
  notify();
}

export function clearSuttasRead(suttaIds: string[]): void {
  if (typeof window === "undefined") return;
  const prev = readReadingProgress();
  const next = { ...prev };
  for (const id of suttaIds) {
    const entry = next[id];
    if (entry) {
      const { readAtMs, ...rest } = entry;
      next[id] = rest;
    }
  }
  localStorage.setItem(READING_PROGRESS_KEY, JSON.stringify(next));
  notify();
}

export function resetReadingProgress(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(READING_PROGRESS_KEY, JSON.stringify({}));
  notify();
}

export function mergeReadingProgress(incoming: ReadingProgressMap): void {
  if (typeof window === "undefined") return;
  const prev = readReadingProgress();
  const next = { ...prev };
  let changed = false;
  for (const [id, entry] of Object.entries(incoming)) {
    const existing = next[id];
    if (!existing) {
      next[id] = entry;
      changed = true;
    } else {
      const merged = { ...existing };
      if (entry.openedAtMs > (existing.openedAtMs || 0)) {
        merged.openedAtMs = entry.openedAtMs;
        changed = true;
      }
      if (entry.readAtMs && entry.readAtMs > (existing.readAtMs || 0)) {
        merged.readAtMs = entry.readAtMs;
        changed = true;
      }
      if ((entry.openCount || 0) > (existing.openCount || 0)) {
        merged.openCount = entry.openCount;
        changed = true;
      }
      next[id] = merged;
    }
  }
  if (changed) {
    localStorage.setItem(READING_PROGRESS_KEY, JSON.stringify(next));
    notify();
  }
}

export function getLastOpenedSuttaId(): string | null {
  const p = readReadingProgress();
  const sorted = Object.entries(p).sort(
    ([, a], [, b]) => (b.openedAtMs || 0) - (a.openedAtMs || 0),
  );
  return sorted[0]?.[0] || null;
}

export function getReadSuttaIds(progress: ReadingProgressMap): string[] {
  return Object.entries(progress)
    .filter(([, p]) => !!p.readAtMs)
    .map(([id]) => id)
    .sort();
}

export function countReadByNikaya(ids: string[]): Record<NikayaId, number> {
  const counts: Record<NikayaId, number> = { AN: 0, SN: 0, DN: 0, MN: 0, KN: 0 };
  for (const id of ids) {
    counts[inferNikayaFromSuttaId(id)]++;
  }
  return counts;
}
