export const DEVICE_ID_STORAGE_KEY = "dama:deviceId";

function randomId(): string {
  // Not a UUID, but stable enough for local UX logs.
  return `dev_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY)?.trim();
  if (existing) return existing;
  const next = randomId();
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, next);
  return next;
}

