/**
 * Persists app-wide settings like preferred language.
 */

export const SETTINGS_STORAGE_KEY = "dama:settings";

export type AppLanguage = "en" | "ja";
export type AppTheme = "paper" | "charcoal";

export type AppSettings = {
  language: AppLanguage;
  theme: AppTheme;
};

export const DEFAULT_SETTINGS: AppSettings = {
  language: "en",
  theme: "paper",
};

const listeners = new Set<() => void>();

let cachedFingerprint: string | null = null;
let cachedSnapshot: AppSettings = DEFAULT_SETTINGS;

function parseStored(raw: string): AppSettings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return DEFAULT_SETTINGS;
    const it = v as Record<string, unknown>;
    const language = it.language === "ja" ? "ja" : "en";
    const theme = it.theme === "charcoal" ? "charcoal" : "paper";
    return { language, theme };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function storageFingerprint(): string {
  return localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "";
}

function notifySettingsChange(): void {
  for (const cb of listeners) cb();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === SETTINGS_STORAGE_KEY || e.key === null) {
      cachedFingerprint = null;
      notifySettingsChange();
    }
  });
}

export function subscribeSettings(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function readSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  const fp = storageFingerprint();
  if (cachedFingerprint !== null && fp === cachedFingerprint) return cachedSnapshot;
  cachedFingerprint = fp;
  cachedSnapshot = parseStored(fp);
  return cachedSnapshot;
}

export function updateSettings(patch: Partial<AppSettings>): void {
  if (typeof window === "undefined") return;
  const current = readSettings();
  const next = { ...current, ...patch };
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  cachedFingerprint = storageFingerprint();
  cachedSnapshot = next;
  notifySettingsChange();
}
