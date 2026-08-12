import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthSession } from "@/hooks/use-auth-session";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/login")({
  component: LoginScreen,
});

function LoginScreen() {
  const navigate = useNavigate();
  const { session, loading } = useAuthSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/profile" });
    }
  }, [loading, navigate, session]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!supabase) return;

    const trimmed = email.trim();
    if (!trimmed || !password) {
      setError("Enter email and password.");
      return;
    }

    setPending(true);
    try {
      if (mode === "signin") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: trimmed,
          password,
        });
        if (authError) throw authError;
        navigate({ to: "/profile" });
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email: trimmed,
          password,
        });
        if (authError) throw authError;
        if (!data.session) {
          setInfo(
            "If email confirmation is enabled in Supabase, check your inbox to finish signing up.",
          );
          return;
        }
        navigate({ to: "/onboarding" });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen pb-10">
      <ScreenHeader title="Sign in" showBack />
      <div className="mx-auto max-w-sm px-5 pt-2">
        {!isSupabaseConfigured ? (
          <p className="text-sm text-muted-foreground">
            Add <span className="font-mono text-xs">VITE_SUPABASE_URL</span> and{" "}
            <span className="font-mono text-xs">VITE_SUPABASE_ANON_KEY</span> to{" "}
            <span className="font-mono text-xs">.env.local</span>, restart{" "}
            <span className="font-mono text-xs">npm run dev</span>, then reload this page.
          </p>
        ) : (
          <>
            <div className="flex gap-2 rounded-lg bg-muted/50 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setInfo(null);
                }}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  mode === "signin"
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setInfo(null);
                }}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  mode === "signup"
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Create account
              </button>
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="auth-email">Email</Label>
                <Input
                  id="auth-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  name="password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                {pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
              <Link to="/reset-password" className="text-primary underline-offset-4 hover:underline">
                Forgot password?
              </Link>
              <Link to="/profile" className="text-primary underline-offset-4 hover:underline">
                Back to profile
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
