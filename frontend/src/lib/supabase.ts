import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

/**
 * True when both project URL and anon (or publishable) key are set.
 * Lets the app run before Supabase is wired; call sites should gate auth UI on this.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Browser Supabase client. Null on the server and until env vars are set — see `.env.example`.
 */
export const supabase: SupabaseClient | null =
  typeof window !== "undefined" && url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          flowType: "pkce",
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    : null;

/**
 * Returns the client or throws with a clear message (for routes/hooks that require auth).
 */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local (see .env.example).",
    );
  }
  return supabase;
}
