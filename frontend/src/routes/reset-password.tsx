import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordScreen,
  head: () => ({
    meta: [{ title: "Reset password — DAMA" }],
  }),
});

function ResetPasswordScreen() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const redirectTo = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent("/update-password")}`;
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!supabase) return;

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email.");
      return;
    }

    setPending(true);
    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo,
      });
      if (authError) throw authError;
      setInfo("Check your email for the reset link.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not send reset email.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen pb-10">
      <ScreenHeader title="Reset password" showBack />
      <div className="mx-auto max-w-sm px-5 pt-2">
        {!isSupabaseConfigured ? (
          <p className="text-sm text-muted-foreground">
            Supabase isn’t configured yet.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              We’ll email you a secure link to set a new password.
            </p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                {pending ? "Sending…" : "Send reset link"}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
