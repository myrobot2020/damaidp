import { type ItemSummary, inferNikayaFromSuttaId } from "./damaApi";
import { sortSuttaIds } from "./suttaNavOrder";

export const QUEST_UNLOCKED_STORAGE_KEY = "dama:questUnlockedSuttas";
export const QUEST_RECALL_STORAGE_KEY = "dama:questRecall";

export type ReflectionBot = "simulation" | "buddha" | "psychologist" | "social" | "feminine";

export type RecallEntry = {
  recalledAtMs: number;
  text: string;
  bot: ReflectionBot;
  suttaId: string;
  nikaya: string;
};

export type RecallMap = Record<string, RecallEntry>;

const unlockedListeners = new Set<() => void>();
const recallListeners = new Set<() => void>();

let unlockedFp: string | null = null;
let unlockedSnapshot: string[] = [];

let recallFp: string | null = null;
let recallSnapshot: RecallMap = {};

function readRaw(key: string): string {
  return localStorage.getItem(key) ?? "";
}

function notify(set: Set<() => void>) {
  for (const cb of set) cb();
}

function normalizeSuttaId(id: string): string {
  return (id || "").trim();
}

function ensureDefaultUnlocked(ids: string[]): string[] {
  const hasDefault = ids.some((x) => x === "11.16" || x === "AN 11.16" || x === "AN11.16");
  if (hasDefault) return ids;
  // Use the canonical id format used by the corpus: "11.16" for AN 11.16.
  return ["11.16", ...ids].filter((x, i, a) => a.indexOf(x) === i);
}

function parseUnlocked(raw: string): string[] {
  if (!raw) return ensureDefaultUnlocked([]);
  try {
    const v = JSON.parse(raw) as unknown;
    const arr = Array.isArray(v) ? v : [];
    const ids = arr
      .map((x) => (typeof x === "string" ? normalizeSuttaId(x) : ""))
      .filter(Boolean);
    return ensureDefaultUnlocked(Array.from(new Set(ids)));
  } catch {
    return ensureDefaultUnlocked([]);
  }
}

function parseRecall(raw: string): RecallMap {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return {};
    const out: RecallMap = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (!val || typeof val !== "object") continue;
      const it = val as Record<string, unknown>;
      const suttaId = typeof it.suttaId === "string" ? it.suttaId : k;
      const text = typeof it.text === "string" ? it.text : "";
      const recalledAtMs =
        typeof it.recalledAtMs === "number" ? it.recalledAtMs : Number(it.recalledAtMs);
      const bot = (typeof it.bot === "string" ? it.bot : "buddha") as ReflectionBot;
      const nikaya =
        typeof it.nikaya === "string" ? it.nikaya : inferNikayaFromSuttaId(suttaId);
      if (!normalizeSuttaId(suttaId) || !text.trim() || !Number.isFinite(recalledAtMs)) continue;
      out[normalizeSuttaId(suttaId)] = {
        suttaId: normalizeSuttaId(suttaId),
        text: text.trim(),
        recalledAtMs,
        bot,
        nikaya,
      };
    }
    return out;
  } catch {
    return {};
  }
}

function writeUnlocked(next: string[]): void {
  localStorage.setItem(QUEST_UNLOCKED_STORAGE_KEY, JSON.stringify(next));
  unlockedFp = readRaw(QUEST_UNLOCKED_STORAGE_KEY);
  unlockedSnapshot = next;
  notify(unlockedListeners);
}

function writeRecall(next: RecallMap): void {
  localStorage.setItem(QUEST_RECALL_STORAGE_KEY, JSON.stringify(next));
  recallFp = readRaw(QUEST_RECALL_STORAGE_KEY);
  recallSnapshot = next;
  notify(recallListeners);
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === QUEST_UNLOCKED_STORAGE_KEY || e.key === null) {
      unlockedFp = null;
      notify(unlockedListeners);
    }
    if (e.key === QUEST_RECALL_STORAGE_KEY || e.key === null) {
      recallFp = null;
      notify(recallListeners);
    }
  });
}

export function subscribeQuestUnlocked(onChange: () => void): () => void {
  unlockedListeners.add(onChange);
  return () => unlockedListeners.delete(onChange);
}

export function readQuestUnlocked(): string[] {
  if (typeof window === "undefined") return ensureDefaultUnlocked([]);
  const raw = readRaw(QUEST_UNLOCKED_STORAGE_KEY);
  if (unlockedFp !== null && raw === unlockedFp) return unlockedSnapshot;
  unlockedFp = raw;
  unlockedSnapshot = parseUnlocked(raw);
  return unlockedSnapshot;
}

export function subscribeQuestRecall(onChange: () => void): () => void {
  recallListeners.add(onChange);
  return () => recallListeners.delete(onChange);
}

export function readQuestRecall(): RecallMap {
  if (typeof window === "undefined") return {};
  const raw = readRaw(QUEST_RECALL_STORAGE_KEY);
  if (recallFp !== null && raw === recallFp) return recallSnapshot;
  recallFp = raw;
  recallSnapshot = parseRecall(raw);
  return recallSnapshot;
}

export function isSuttaUnlocked(suttaId: string): boolean {
  const id = normalizeSuttaId(suttaId);
  if (!id) return false;
  return readQuestUnlocked().includes(id);
}

export function unlockSutta(suttaId: string): void {
  if (typeof window === "undefined") return;
  const id = normalizeSuttaId(suttaId);
  if (!id) return;
  const prev = readQuestUnlocked();
  if (prev.includes(id)) return;
  writeUnlocked([...prev, id]);
}

export function recordTeacherRecall(suttaId: string, text: string, bot: ReflectionBot): void {
  if (typeof window === "undefined") return;
  const id = normalizeSuttaId(suttaId);
  const trimmed = (text || "").trim();
  if (!id || !trimmed) return;
  const prev = readQuestRecall();
  const nikaya = inferNikayaFromSuttaId(id);
  const next: RecallMap = {
    ...prev,
    [id]: {
      suttaId: id,
      text: trimmed,
      recalledAtMs: Date.now(),
      bot,
      nikaya,
    },
  };
  writeRecall(next);
  unlockSutta(id);
}

export function resetTeacherQuest(): void {
  if (typeof window === "undefined") return;
  writeUnlocked(ensureDefaultUnlocked([]));
  writeRecall({});
}

export function getNextSuttaGlobal(items: ItemSummary[], currentSuttaId: string): ItemSummary | null {
  const sorted = sortSuttaIds(items);
  const idx = sorted.findIndex((x) => x.suttaid === currentSuttaId);
  if (idx < 0) return null;
  return sorted[idx + 1] ?? null;
}
