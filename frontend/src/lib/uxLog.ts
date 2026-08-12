import { getDeviceId } from "@/lib/deviceId";

export const UX_LOG_STORAGE_KEY = "dama:uxLog";

export type UxEvent = {
  t: number;
  name: string;
  props?: Record<string, unknown>;
  deviceId: string;
};

export const INITIAL_UX_LOG_SNAPSHOT: readonly UxEvent[] = Object.freeze([]);

const listeners = new Set<() => void>();

let cachedFingerprint: string | null = null;
let cachedSnapshot: readonly UxEvent[] = INITIAL_UX_LOG_SNAPSHOT;

function parseStored(raw: string): readonly UxEvent[] {
  if (!raw) return INITIAL_UX_LOG_SNAPSHOT;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return INITIAL_UX_LOG_SNAPSHOT;
    const out: UxEvent[] = [];
    for (const it of v) {
      if (!it || typeof it !== "object") continue;
      const o = it as Record<string, unknown>;
      const t = typeof o.t === "number" ? o.t : Number(o.t);
      const name = typeof o.name === "string" ? o.name : "";
      const deviceId = typeof o.deviceId === "string" ? o.deviceId : "";
      if (!Number.isFinite(t) || !name) continue;
      out.push({
        t,
        name,
        deviceId: deviceId || getDeviceId(),
        props: o.props && typeof o.props === "object" ? (o.props as Record<string, unknown>) : undefined,
      });
    }
    return out;
  } catch {
    return INITIAL_UX_LOG_SNAPSHOT;
  }
}

function storageFingerprint(): string {
  return localStorage.getItem(UX_LOG_STORAGE_KEY) ?? "";
}

function notifyUxLog(): void {
  for (const cb of listeners) cb();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === UX_LOG_STORAGE_KEY || e.key === null) {
      cachedFingerprint = null;
      notifyUxLog();
    }
  });
}

export function subscribeUxLog(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function readUxLog(): readonly UxEvent[] {
  if (typeof window === "undefined") return INITIAL_UX_LOG_SNAPSHOT;
  const fp = storageFingerprint();
  if (cachedFingerprint !== null && fp === cachedFingerprint) return cachedSnapshot;
  cachedFingerprint = fp;
  cachedSnapshot = parseStored(fp);
  return cachedSnapshot;
}

function writeUxLog(next: readonly UxEvent[]) {
  localStorage.setItem(UX_LOG_STORAGE_KEY, JSON.stringify(next));
  cachedFingerprint = storageFingerprint();
  cachedSnapshot = next;
  notifyUxLog();
}

export function trackUxEvent(name: string, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const eventName = (name || "").trim();
  if (!eventName) return;
  const prev = readUxLog();
  const next: UxEvent[] = [
    ...prev,
    { t: Date.now(), name: eventName, props, deviceId: getDeviceId() },
  ];
  // Cap to avoid unbounded growth.
  const capped = next.length > 500 ? next.slice(next.length - 500) : next;
  writeUxLog(capped);
}

export function clearUxLog() {
  if (typeof window === "undefined") return;
  writeUxLog([]);
}
