const IN_PROGRESS_PREFIX = "dama:freshStartInProgress:";
const DONE_PREFIX = "dama:freshStartDone:";

function key(prefix: string, userId: string): string {
  return `${prefix}${(userId || "").trim()}`;
}

export function isFreshStartInProgress(userId: string): boolean {
  if (typeof window === "undefined") return false;
  const id = (userId || "").trim();
  if (!id) return false;
  return localStorage.getItem(key(IN_PROGRESS_PREFIX, id)) === "1";
}

export function markFreshStartInProgress(userId: string): void {
  if (typeof window === "undefined") return;
  const id = (userId || "").trim();
  if (!id) return;
  localStorage.setItem(key(IN_PROGRESS_PREFIX, id), "1");
}

export function clearFreshStartInProgress(userId: string): void {
  if (typeof window === "undefined") return;
  const id = (userId || "").trim();
  if (!id) return;
  localStorage.removeItem(key(IN_PROGRESS_PREFIX, id));
}

export function isFreshStartDone(userId: string): boolean {
  if (typeof window === "undefined") return false;
  const id = (userId || "").trim();
  if (!id) return false;
  return localStorage.getItem(key(DONE_PREFIX, id)) === "1";
}

export function markFreshStartDone(userId: string): void {
  if (typeof window === "undefined") return;
  const id = (userId || "").trim();
  if (!id) return;
  localStorage.setItem(key(DONE_PREFIX, id), "1");
}

