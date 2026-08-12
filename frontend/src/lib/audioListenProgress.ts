/**
 * Persists how far the user has listened into each sutta's teacher audio clip (0–1 of the clip).
 * Used to treat ≥ {@link LISTEN_COMPLETE_THRESHOLD} as "heard" on the Tree page.
 *
 * `readAudioListenProgress` is snapshot-cached so `useSyncExternalStore` does not infinite-loop
 * (same reference until localStorage changes).
 */

import type { NikayaId } from "./damaApi";
import { inferNikayaFromSuttaId } from "./damaApi";

export const AUDIO_LISTEN_STORAGE_KEY = "dama:audioListenProgress";

/** Fraction of the sutta audio clip that counts as "listened" for Tree stats. */
export const LISTEN_COMPLETE_THRESHOLD = 0.75;

export type AudioListenProgressMap = Record<string, number>;

/** Stable empty map for SSR and `getServerSnapshot`. */
export const EMPTY_AUDIO_PROGRESS_MAP: AudioListenProgressMap = Object.freeze({});

const listeners = new Set<() => void>();

/** Fingerprint + snapshot for useSyncExternalStore (must return same ref until storage changes). */
let cachedFingerprint: string | null = null;
let cachedSnapshot: AudioListenProgressMap = EMPTY_AUDIO_PROGRESS_MAP;

function parseStored(raw: string): AudioListenProgressMap {
  if (!raw) return EMPTY_AUDIO_PROGRESS_MAP;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return EMPTY_AUDIO_PROGRESS_MAP;
    const out: AudioListenProgressMap = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const n = typeof val === "number" ? val : Number(val);
      if (Number.isFinite(n)) out[k] = Math.min(1, Math.max(0, n));
    }
    return out;
  } catch {
    return EMPTY_AUDIO_PROGRESS_MAP;
  }
}

function storageFingerprint(): string {
  return localStorage.getItem(AUDIO_LISTEN_STORAGE_KEY) ?? "";
}

function notifyAudioListenProgress(): void {
  for (const cb of listeners) cb();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === AUDIO_LISTEN_STORAGE_KEY || e.key === null) {
      cachedFingerprint = null;
      for (const cb of listeners) cb();
    }
  });
}

export function subscribeAudioListenProgress(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function readAudioListenProgress(): AudioListenProgressMap {
  if (typeof window === "undefined") return EMPTY_AUDIO_PROGRESS_MAP;
  const fp = storageFingerprint();
  if (cachedFingerprint !== null && fp === cachedFingerprint) return cachedSnapshot;
  cachedFingerprint = fp;
  cachedSnapshot = parseStored(fp);
  return cachedSnapshot;
}

export function resetAudioListenProgress(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUDIO_LISTEN_STORAGE_KEY, JSON.stringify({}));
  cachedFingerprint = storageFingerprint();
  cachedSnapshot = {};
  notifyAudioListenProgress();
}

/**
 * Updates the stored max fraction for this sutta (seeking backward does not erase progress).
 */
export function recordAudioListenProgress(suttaId: string, fraction: number): void {
  if (typeof window === "undefined") return;
  const id = suttaId.trim();
  if (!id) return;
  const f = Math.min(1, Math.max(0, fraction));
  const prevMap = readAudioListenProgress();
  const map: AudioListenProgressMap = { ...prevMap };
  const prev = map[id] ?? 0;
  const next = Math.max(prev, f);
  if (next === prev) return;
  map[id] = next;
  localStorage.setItem(AUDIO_LISTEN_STORAGE_KEY, JSON.stringify(map));
  cachedFingerprint = storageFingerprint();
  cachedSnapshot = map;
  notifyAudioListenProgress();
}

/**
 * Best-effort merge for syncing: keep the max fraction per sutta.
 */
export function mergeAudioListenProgress(incoming: AudioListenProgressMap): void {
  if (typeof window === "undefined") return;
  const prev = readAudioListenProgress();
  let changed = false;
  const next: AudioListenProgressMap = { ...prev };
  for (const [id, frac] of Object.entries(incoming)) {
    const sid = id.trim();
    if (!sid) continue;
    const f = typeof frac === "number" ? frac : Number(frac);
    if (!Number.isFinite(f)) continue;
    const clamped = Math.min(1, Math.max(0, f));
    const merged = Math.max(next[sid] ?? 0, clamped);
    if ((next[sid] ?? 0) !== merged) {
      next[sid] = merged;
      changed = true;
    }
  }
  if (!changed) return;
  localStorage.setItem(AUDIO_LISTEN_STORAGE_KEY, JSON.stringify(next));
  cachedFingerprint = storageFingerprint();
  cachedSnapshot = next;
  notifyAudioListenProgress();
}

export function compareSuttaIds(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function getSuttaIdsHeardAtLeast(
  map: AudioListenProgressMap,
  threshold: number = LISTEN_COMPLETE_THRESHOLD,
): string[] {
  return Object.entries(map)
    .filter(([, frac]) => frac >= threshold)
    .map(([id]) => id)
    .sort(compareSuttaIds);
}

export function countHeardByNikaya(ids: string[]): Record<NikayaId, number> {
  const counts: Record<NikayaId, number> = { AN: 0, SN: 0, DN: 0, MN: 0, KN: 0 };
  for (const id of ids) {
    counts[inferNikayaFromSuttaId(id)]++;
  }
  return counts;
}
