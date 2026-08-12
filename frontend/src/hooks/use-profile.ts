import { useEffect, useState } from "react";

import type { Profile } from "@/lib/profile";
import { fetchProfileByUserId } from "@/lib/profile";
import { supabase } from "@/lib/supabase";

export function useProfile(userId: string | null | undefined): {
  profile: Profile | null;
  loading: boolean;
  available: boolean;
  error: string | null;
} {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const uid = (userId ?? "").trim();
    if (!supabase || !uid) {
      setProfile(null);
      setLoading(false);
      setAvailable(Boolean(supabase));
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const p = await fetchProfileByUserId(uid);
        if (cancelled) return;
        setProfile(p);
        setAvailable(true);
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        // If the schema isn't applied yet, avoid breaking the app / infinite onboarding redirects.
        const missingTable =
          /relation .*profiles.* does not exist/i.test(msg) ||
          /could not find .*profiles/i.test(msg) ||
          /schema cache/i.test(msg) ||
          /pgrst205/i.test(msg) ||
          /404/i.test(msg);
        setAvailable(!missingTable);
        setProfile(null);
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { profile, loading, available, error };
}
