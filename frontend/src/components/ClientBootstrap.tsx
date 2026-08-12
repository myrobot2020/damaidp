import { useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useAuthSession } from "@/hooks/use-auth-session";
import { useProfile } from "@/hooks/use-profile";
import { clearFreshStartInProgress, isFreshStartDone, markFreshStartDone, markFreshStartInProgress } from "@/lib/freshStart";
import { resetReadingProgress } from "@/lib/readingProgress";
import { resetAudioListenProgress } from "@/lib/audioListenProgress";
import { resetTeacherQuest } from "@/lib/teacherQuest";
import { clearUxLog } from "@/lib/uxLog";
import { REFLECTION_QUERY_STORAGE_KEY } from "@/lib/damaApi";
import { supabase } from "@/lib/supabase";

export function ClientBootstrap() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { session, loading, supabaseReady } = useAuthSession();
  const { profile, loading: profileLoading, available: profileAvailable } = useProfile(
    session?.user?.id ?? null,
  );

  useEffect(() => {
    if (!supabaseReady) return;
    if (loading) return;
    if (!session?.user?.id) return;
    if (typeof window === "undefined") return;

    const email = (session.user.email ?? "").trim().toLowerCase();
    if (email !== "nikhil.exec@gmail.com") return;

    const userId = session.user.id;
    if (isFreshStartDone(userId)) return;

    markFreshStartInProgress(userId);

    resetReadingProgress();
    resetAudioListenProgress();
    resetTeacherQuest();
    clearUxLog();

    localStorage.removeItem("dama:uxLogSyncedMs");
    localStorage.removeItem("dama:reflection");
    localStorage.removeItem("dama:reflectionMode");
    localStorage.removeItem(REFLECTION_QUERY_STORAGE_KEY);

    (async () => {
      try {
        if (supabase) {
          await supabase.from("reading_progress").delete().eq("user_id", userId);
          await supabase.from("audio_listen_progress").delete().eq("user_id", userId);
          await supabase.from("ux_events").delete().eq("user_id", userId);
        }
      } catch {
        // Best-effort only.
      } finally {
        clearFreshStartInProgress(userId);
        markFreshStartDone(userId);
      }
    })();
  }, [loading, session?.user?.email, session?.user?.id, supabaseReady]);

  useEffect(() => {
    if (!supabaseReady) return;
    if (loading) return;
    if (!session?.user?.id) return;
    if (!profileAvailable) return;
    if (profileLoading) return;
    if (profile) return;

    const onOnboarding = pathname === "/onboarding";
    const inAuthCallback = pathname === "/auth/callback";
    const inUpdatePassword = pathname === "/update-password";
    if (onOnboarding || inAuthCallback || inUpdatePassword) return;

    navigate({ to: "/onboarding" });
  }, [
    loading,
    navigate,
    pathname,
    profile,
    profileAvailable,
    profileLoading,
    session?.user?.id,
    supabaseReady,
  ]);

  return null;
}
