import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthSession } from "@/hooks/use-auth-session";

export const Route = createFileRoute("/update-password")({
  component: UpdatePasswordScreen,
  head: () => ({
    meta: [{ title: "Set new password — DAMA" }],
  }),
});

function UpdatePasswordScreen() {
  const navigate = useNavigate();
  const { session, loading, supabaseReady } = useAuthSession();
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    // If Supabase confirms email/reset in the URL hash, let it initialize.
    if (!supabase || !isSupabaseConfigured) return;
    void supabase.auth.getSession();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!supabase) return;

    const p1 = pw1.trim();
    const p2 = pw2.trim();
    if (!p1 || !p2) {
      setError("Enter the new password twice.");
      return;
    }
    if (p1 !== p2) {
      setError("Passwords do not match.");
      return;
    }
    if (p1.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }

    setPending(true);
    try {
      const { error: upErr } = await supabase.auth.updateUser({ password: p1 });
      if (upErr) throw upErr;
      setInfo("Password updated.");
      navigate({ to: "/profile" });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not update password.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen pb-10">
      <ScreenHeader title="Set new password" showBack />
      <div className="mx-auto max-w-sm px-5 pt-2">
        {!isSupabaseConfigured ? (
          <p className="text-sm text-muted-foreground">Supabase isn’t configured yet.</p>
        ) : !supabaseReady ? (
          <p className="text-sm text-muted-foreground">Auth isn’t ready yet.</p>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Loading session…</p>
        ) : !session ? (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Open this page from the password-reset email link so the app can verify you.
            </p>
            <p>
              <Link to="/reset-password" className="text-primary underline-offset-4 hover:underline">
                Send another reset link
              </Link>
            </p>
          </div>
        ) : (
          <>
            <form onSubmit={onSubmit} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-pw">New password</Label>
                <Input
                  id="new-pw"
                  name="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-pw2">Confirm password</Label>
                <Input
                  id="new-pw2"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  disabled={pending}
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              {info ? (
                <p className="text-sm text-muted-foreground" role="status">
                  {info}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Updating…" : "Update password"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
