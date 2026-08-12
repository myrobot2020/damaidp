import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { ScreenHeader } from "@/components/ScreenHeader";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackScreen,
  head: () => ({
    meta: [{ title: "Signing in — DAMA" }],
  }),
});

function AuthCallbackScreen() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"working" | "error" | "done">("working");
  const [error, setError] = useState<string | null>(null);

  const search = Route.useSearch() as { code?: string; next?: string };
  const next = useMemo(() => {
    const raw = (search?.next ?? "").trim();
    if (!raw) return "/profile";
    // Only allow internal redirects.
    if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
    return "/profile";
  }, [search?.next]);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) {
      setStatus("error");
      setError(
        "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local, then reload.",
      );
      return;
    }

    const code = (search?.code ?? "").trim();
    (async () => {
      try {
        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) throw exErr;
        } else {
          // If the provider already handled the session in URL, this is a no-op.
          await supabase.auth.getSession();
        }
        setStatus("done");
        navigate({ to: next });
      } catch (e: unknown) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Could not complete sign-in.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen pb-10">
      <ScreenHeader title="Signing in" showBack={false} />
      <div className="px-5 pt-2">
        {!isSupabaseConfigured ? (
          <p className="text-sm text-muted-foreground">
            Supabase env vars are missing.
          </p>
        ) : status === "working" ? (
          <div className="glass rounded-2xl p-4">
            <div className="label-mono text-muted-foreground">Auth</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Completing sign-in…
            </p>
          </div>
        ) : status === "error" ? (
          <div className="glass rounded-2xl p-4">
            <div className="label-mono text-destructive">Could not sign in</div>
            <p className="mt-2 text-sm text-muted-foreground break-words">
              {error ?? "Unknown error"}
            </p>
          </div>
        ) : (
          <div className="glass rounded-2xl p-4">
            <div className="label-mono text-primary">Done</div>
            <p className="mt-2 text-sm text-muted-foreground">Redirecting…</p>
          </div>
        )}
      </div>
    </div>
  );
}
