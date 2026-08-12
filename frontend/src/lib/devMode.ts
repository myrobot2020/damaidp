/**
 * DAMA Dev Mode Utility (Point 31 & 32)
 * Controls visibility of technical features (like Traces) and administrative tools.
 */

const DEV_MODE_KEY = "dama:devMode";

export function isDevMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DEV_MODE_KEY) === "true";
}

export function setDevMode(enabled: boolean): void {
  localStorage.setItem(DEV_MODE_KEY, String(enabled));
}

/**
 * Checks if a user session should have admin privileges.
 * At global scale, this would check a 'role' column in Supabase.
 * For now, it's a simple local toggle.
 */
export function isUserAdmin(): boolean {
  return isDevMode();
}
