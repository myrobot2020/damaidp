import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Profile } from "@/lib/profile";
import { fetchProfileByUserId } from "@/lib/profile";
import { supabase } from "@/lib/supabase";

interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  profileAvailable: boolean;
  loading: boolean;
  supabaseReady: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  profileAvailable: true,
  loading: true,
  supabaseReady: false,
  error: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileAvailable, setProfileAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!supabase || !userId) {
      setProfile(null);
      setProfileAvailable(Boolean(supabase));
      setError(null);
      if (!session) {
        // Only stop loading if we don't have a session,
        // otherwise we wait for profile fetch.
        setLoading(false);
      }
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const p = await fetchProfileByUserId(userId);
        if (cancelled) return;
        setProfile(p);
        setProfileAvailable(true);
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        const missingTable =
          /relation .*profiles.* does not exist/i.test(msg) ||
          /could not find .*profiles/i.test(msg) ||
          /schema cache/i.test(msg) ||
          /pgrst205/i.test(msg) ||
          /404/i.test(msg);
        setProfileAvailable(!missingTable);
        setProfile(null);
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        profileAvailable,
        loading,
        supabaseReady: Boolean(supabase),
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
