export type LeafState = "grey" | "green" | "yellow" | "gold";

export type Leaf = {
  suttaId: string;
  state: LeafState;
  createdAtMs: number;
  updatedAtMs: number;
  /** First-answer timestamp (grey -> green). */
  answeredAtMs?: number;
  /** When the leaf turns yellow (review due). */
  yellowAtMs?: number;
  /** When a yellow leaf falls off (back to grey) unless it becomes gold. */
  fallAtMs?: number;
  /** When it became gold (fixed). */
  goldAtMs?: number;
  /** Latest selected option id (reflection choice). */
  lastOptionId?: string;
};

export type LeavesStore = Record<string, Leaf>;
export const INITIAL_LEAVES_SNAPSHOT: LeavesStore = {};

const STORAGE_KEY = "dama:leaves";

const DAY_MS = 24 * 60 * 60 * 1000;

// For localhost demos: turn leaves yellow quickly (7s) unless overridden.
// In production builds, defaults are in days.
const DEV_YELLOW_AFTER_MS = 7_000;
const DEV_FALL_AFTER_MS = 14_000;

function readMsEnv(key: string): number | null {
  // Vite only exposes VITE_* vars to the client bundle.
  const raw = (import.meta as any)?.env?.[key] as unknown;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function yellowAfterMs(): number {
  const fromEnv = readMsEnv("VITE_LEAF_YELLOW_AFTER_MS");
  if (fromEnv) return fromEnv;
  if ((import.meta as any)?.env?.DEV) return DEV_YELLOW_AFTER_MS;
  return 7 * DAY_MS;
}

function fallAfterMs(): number {
  const fromEnv = readMsEnv("VITE_LEAF_FALL_AFTER_MS");
  if (fromEnv) return fromEnv;
  if ((import.meta as any)?.env?.DEV) return DEV_FALL_AFTER_MS;
  return 14 * DAY_MS;
}

const listeners = new Set<() => void>();
let fp: string | null = null;
let snapshot: LeavesStore = {};

function readRaw(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

function notify() {
  for (const cb of listeners) cb();
}

function safeParse(raw: string): LeavesStore {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return {};
    const out: LeavesStore = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (!val || typeof val !== "object") continue;
      const it = val as Record<string, unknown>;
      const suttaId = typeof it.suttaId === "string" ? it.suttaId : k;
      const state = typeof it.state === "string" ? (it.state as LeafState) : "grey";
      const createdAtMs = typeof it.createdAtMs === "number" ? it.createdAtMs : Number(it.createdAtMs);
      const updatedAtMs = typeof it.updatedAtMs === "number" ? it.updatedAtMs : Number(it.updatedAtMs);
      if (!suttaId.trim() || !Number.isFinite(createdAtMs) || !Number.isFinite(updatedAtMs)) continue;
      out[suttaId] = {
        suttaId,
        state: state === "grey" || state === "green" || state === "yellow" || state === "gold" ? state : "grey",
        createdAtMs,
        updatedAtMs,
        answeredAtMs: typeof it.answeredAtMs === "number" ? it.answeredAtMs : Number(it.answeredAtMs) || undefined,
        yellowAtMs: typeof it.yellowAtMs === "number" ? it.yellowAtMs : Number(it.yellowAtMs) || undefined,
        fallAtMs: typeof it.fallAtMs === "number" ? it.fallAtMs : Number(it.fallAtMs) || undefined,
        goldAtMs: typeof it.goldAtMs === "number" ? it.goldAtMs : Number(it.goldAtMs) || undefined,
        lastOptionId: typeof it.lastOptionId === "string" ? it.lastOptionId : undefined,
      };
    }
    return out;
  } catch {
    return {};
  }
}

function write(next: LeavesStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  fp = readRaw();
  snapshot = next;
  notify();
}

export function subscribeLeaves(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function readLeaves(): LeavesStore {
  const raw = readRaw();
  if (fp !== null && raw === fp) return snapshot;
  fp = raw;
  snapshot = safeParse(raw);
  return snapshot;
}

export function ensureLeaf(suttaId: string): Leaf {
  const id = (suttaId || "").trim();
  if (!id) throw new Error("Missing suttaId");
  const prev = readLeaves();
  const now = Date.now();
  const existing = prev[id];
  if (existing) return hydrateLeaf(existing, now);
  const leaf: Leaf = { suttaId: id, state: "grey", createdAtMs: now, updatedAtMs: now };
  write({ ...prev, [id]: leaf });
  return leaf;
}

export function hydrateLeaf(leaf: Leaf, nowMs = Date.now()): Leaf {
  if (leaf.state === "gold") return leaf;
  if (leaf.state === "green" && leaf.yellowAtMs && nowMs >= leaf.yellowAtMs) {
    return { ...leaf, state: "yellow", updatedAtMs: nowMs };
  }
  if (leaf.state === "yellow" && leaf.fallAtMs && nowMs >= leaf.fallAtMs) {
    return { suttaId: leaf.suttaId, state: "grey", createdAtMs: leaf.createdAtMs, updatedAtMs: nowMs };
  }
  return leaf;
}

export function upsertHydratedLeaf(suttaId: string): Leaf {
  const id = (suttaId || "").trim();
  const prev = readLeaves();
  const now = Date.now();
  const base = prev[id] ?? ensureLeaf(id);
  const hydrated = hydrateLeaf(base, now);
  if (hydrated === base) return base;
  write({ ...prev, [id]: hydrated });
  return hydrated;
}

export function answerLeaf(suttaId: string, optionId: string): Leaf {
  const id = (suttaId || "").trim();
  const opt = (optionId || "").trim();
  const now = Date.now();
  const prev = readLeaves();
  const base = prev[id] ?? ensureLeaf(id);
  const hydrated = hydrateLeaf(base, now);

  const next: Leaf = {
    ...hydrated,
    state: hydrated.state === "grey" ? "green" : hydrated.state,
    answeredAtMs: hydrated.answeredAtMs ?? now,
    lastOptionId: opt || hydrated.lastOptionId,
    updatedAtMs: now,
  };

  if (hydrated.state === "grey") {
    next.yellowAtMs = now + yellowAfterMs();
    next.fallAtMs = now + fallAfterMs();
  }

  write({ ...prev, [id]: next });
  return next;
}

export function reviewLeafToGold(suttaId: string, optionId: string, goldOptionId: string): Leaf {
  const id = (suttaId || "").trim();
  const opt = (optionId || "").trim();
  const gold = (goldOptionId || "").trim();
  const now = Date.now();
  const prev = readLeaves();
  const base = prev[id] ?? ensureLeaf(id);
  const hydrated = hydrateLeaf(base, now);

  if (hydrated.state !== "yellow") return answerLeaf(id, opt);

  const toGold = opt && gold && opt === gold;
  const next: Leaf = {
    ...hydrated,
    state: toGold ? "gold" : "yellow",
    goldAtMs: toGold ? now : hydrated.goldAtMs,
    lastOptionId: opt || hydrated.lastOptionId,
    updatedAtMs: now,
  };
  write({ ...prev, [id]: next });
  return next;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      fp = null;
      notify();
    }
  });
}
