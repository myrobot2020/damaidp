import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { isDevMode, setDevMode } from "@/lib/devMode";
import { SlidersHorizontal } from "lucide-react";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useProfile } from "@/hooks/use-profile";
import { isLikelyUniqueViolation, updateProfile, validateUsername } from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { clearUxLog, readUxLog, subscribeUxLog, trackUxEvent, INITIAL_UX_LOG_SNAPSHOT } from "@/lib/uxLog";
import { readSettings, subscribeSettings, updateSettings, DEFAULT_SETTINGS } from "@/lib/settings";

export const Route = createFileRoute("/profile")({
  component: ProfileScreen,
});

const UX_TOOLS_STORAGE_KEY = "dama:uxToolsEnabled";

function ProfileScreen() {
  const search = Route.useSearch() as { devtools?: string };
  const { session, loading, supabaseReady } = useAuthSession();
  const user = session?.user ?? null;
  const { profile, loading: profileLoading, available: profileAvailable } = useProfile(user?.id);
  const [note, setNote] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [editPending, setEditPending] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [uxToolsEnabled, setUxToolsEnabled] = useState(false);
  const [devModeEnabled, setDevModeEnabled] = useState(false);
  const [corpusMode, setCorpusMode] = useState<"prod" | "test">("prod");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const dir = localStorage.getItem("dama_corpus_dir") || "/data/validated-json";
      setCorpusMode(dir.includes("test-json") ? "test" : "prod");
    }
  }, []);

  const toggleCorpusMode = () => {
    const nextMode = corpusMode === "prod" ? "test" : "prod";
    const nextDir = nextMode === "test" ? "/data/test-json" : "/data/validated-json";
    if (typeof window !== "undefined") {
      localStorage.setItem("dama_corpus_dir", nextDir);
    }
    setCorpusMode(nextMode);
    trackUxEvent("settings_corpus_mode_change", { mode: nextMode });
    window.location.reload();
  };

  const settings = useSyncExternalStore(subscribeSettings, readSettings, () => DEFAULT_SETTINGS);

  const uxLog = useSyncExternalStore(subscribeUxLog, readUxLog, () => INITIAL_UX_LOG_SNAPSHOT);
  const recentUx = useMemo(() => {
    const arr = Array.isArray(uxLog) ? uxLog : [];
    return arr.slice(Math.max(0, arr.length - 25)).reverse();
  }, [uxLog]);

  const copyUxLog = async () => {
    const payload = JSON.stringify(uxLog, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      trackUxEvent("ux_export_copy", { count: Array.isArray(uxLog) ? uxLog.length : 0 });
    } catch {
      // Fallback: open in a new tab for manual copy.
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      trackUxEvent("ux_export_blob", { count: Array.isArray(uxLog) ? uxLog.length : 0 });
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = localStorage.getItem(UX_TOOLS_STORAGE_KEY);
    setUxToolsEnabled(v === "1");
    setDevModeEnabled(isDevMode());
  }, []);

  const toggleDevMode = () => {
    const next = !devModeEnabled;
    setDevModeEnabled(next);
    setDevMode(next);
    trackUxEvent(next ? "dev_mode_enable" : "dev_mode_disable");
  };

  const toggleUxTools = () => {
    const next = !uxToolsEnabled;
    setUxToolsEnabled(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(UX_TOOLS_STORAGE_KEY, next ? "1" : "0");
    }
    trackUxEvent(next ? "ux_tools_enable" : "ux_tools_disable");
  };

  useEffect(() => {
    // Keep the draft in sync with the saved value unless the user is currently editing it.
    const current = (profile?.username ?? "").trim();
    if (!current) return;
    if (usernameTouched) return;
    setEditUsername(current);
  }, [profile?.username, usernameTouched]);

  const currentUsername = (profile?.username ?? "").trim();
  const draftUsername = editUsername.trim();
  const usernameLocked = currentUsername.length > 0;
  const canSaveUsername =
    Boolean(user && profileAvailable) &&
    !editPending &&
    !usernameLocked &&
    draftUsername.length > 0 &&
    draftUsername !== currentUsername;

  const showDevTools = Boolean(user) && search?.devtools === "1";

  return (
    <div className={`min-h-screen ${user ? "dama-screen" : "pb-10 bg-background"}`}>
      <ScreenHeader title="Profile" showBack={false} />
      <div className="px-7 pb-10 text-center">
        <div className="mt-3 h-28 overflow-hidden border-y paper-rule">
          <img
            src="/panels/buddha-mountain.png"
            alt=""
            className="h-full w-full object-cover ink-panel opacity-90"
          />
        </div>

        <div className="mx-auto mt-8 flex size-16 items-center justify-center rounded-full border paper-rule bg-background text-reading text-2xl text-foreground/80">
          {(profile?.username ?? user?.email ?? "Guest").trim().charAt(0).toUpperCase() || "G"}
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading session…</p>
        ) : !supabaseReady ? (
          <div className="mt-6 space-y-3 text-sm text-muted-foreground">
            <p>
              Supabase env vars are missing. Add them to{" "}
              <span className="font-mono text-xs">.env.local</span> and restart the dev server.
            </p>
          </div>
        ) : user ? (
          <>
            <h1 className="mt-4 text-reading text-2xl tracking-tight">
              <span className="block truncate max-w-full">
                {profile?.username ?? user.email ?? "Signed in"}
              </span>
            </h1>
            <div className="mt-1 label-mono text-primary text-xs truncate max-w-full mx-auto">
              User id · {user.id.slice(0, 8)}…
            </div>
            {user.email ? (
              <div className="mt-1 text-xs text-muted-foreground truncate max-w-full mx-auto">
                {user.email}
              </div>
            ) : null}
            <div className="mt-8 flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => supabase?.auth.signOut()}
                className="rounded-full border-foreground/80 bg-transparent px-6"
              >
                Sign out
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-reading text-2xl tracking-tight">Guest</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to sync your reading across devices.
            </p>
            <div className="mt-8 flex justify-center">
              <Button type="button" asChild className="rounded-full border border-foreground/80 bg-transparent px-6 text-foreground shadow-none hover:bg-foreground hover:text-background">
                <Link to="/login">Sign in or create account</Link>
              </Button>
            </div>
          </>
        )}

        {supabaseReady && user && profileAvailable && !profileLoading && !profile ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Username not set yet.{" "}
            <Link to="/onboarding" className="text-primary underline-offset-4 hover:underline">
              Choose one
            </Link>
            .
          </p>
        ) : null}

        <div className="mt-10 space-y-8 text-left">
          <section>
            <div className="label-mono text-muted-foreground">Theme</div>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t paper-rule pt-3">
              <button
                type="button"
                aria-pressed={settings.theme === "paper"}
                onClick={() => {
                  updateSettings({ theme: "paper" });
                  trackUxEvent("settings_theme_change", { theme: "paper" });
                }}
                className={`rounded-full border px-5 py-3 text-sm transition-colors ${
                  settings.theme === "paper"
                    ? "border-foreground bg-foreground text-background"
                    : "paper-rule bg-transparent text-muted-foreground"
                }`}
              >
                Paper
              </button>
              <button
                type="button"
                aria-pressed={settings.theme === "charcoal"}
                onClick={() => {
                  updateSettings({ theme: "charcoal" });
                  trackUxEvent("settings_theme_change", { theme: "charcoal" });
                }}
                className={`rounded-full border px-5 py-3 text-sm transition-colors ${
                  settings.theme === "charcoal"
                    ? "border-foreground bg-foreground text-background"
                    : "paper-rule bg-transparent text-muted-foreground"
                }`}
              >
                Charcoal
              </button>
            </div>
          </section>

          <section>
            <div className="label-mono text-muted-foreground">Preferences</div>
            <div className="mt-4 space-y-2 border-t paper-rule pt-4">
              <Label htmlFor="app-language" className="text-reading text-lg font-normal">
                App language
              </Label>
              <select
                id="app-language"
                value={settings.language}
                onChange={(e) => {
                  const val = e.target.value as "en" | "ja";
                  updateSettings({ language: val });
                  trackUxEvent("settings_language_change", { language: val });
                }}
                className="w-full rounded-full border paper-rule bg-transparent px-4 py-3 text-sm font-medium text-foreground/90 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="en">English</option>
                <option value="ja">日本語 (Japanese)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Sets the default language for suttas when a translation is available.
              </p>
            </div>
          </section>

          {supabaseReady && user && profileAvailable && !usernameLocked ? (
            <section>
              <div className="label-mono text-muted-foreground">Account</div>
              <form
                className="mt-4 space-y-4 border-t paper-rule pt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (usernameLocked) return;
                  if (!canSaveUsername) return;
                  const v = validateUsername(draftUsername);
                  if (!v.ok) {
                    setEditError(v.error);
                    return;
                  }
                  setEditPending(true);
                  setEditError(null);
                  void updateProfile({ userId: user.id, username: v.value })
                    .then(() => {
                      trackUxEvent("profile_update_username", { username: v.value });
                      setEditUsername(v.value);
                      setUsernameTouched(false);
                    })
                    .catch((e: unknown) => {
                      if (isLikelyUniqueViolation(e)) {
                        setEditError("That username is taken. Try another.");
                      } else {
                        setEditError(e instanceof Error ? e.message : "Could not update username.");
                      }
                    })
                    .finally(() => setEditPending(false));
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="profile-username">Username</Label>
                  <Input
                    id="profile-username"
                    name="username"
                    autoComplete="username"
                    value={editUsername}
                    onChange={(e) => {
                      setUsernameTouched(true);
                      setEditUsername(e.target.value);
                    }}
                    disabled={editPending}
                  />
                  <p className="text-xs text-muted-foreground">Up to 256 characters.</p>
                </div>
                {editError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {editError}
                  </p>
                ) : null}
                {canSaveUsername ? (
                  <Button type="submit" className="w-full rounded-full" disabled={editPending}>
                    {editPending ? "Saving…" : "Save username"}
                  </Button>
                ) : null}
              </form>
            </section>
          ) : null}

          <section>
            <div className="label-mono text-muted-foreground">Engineering</div>
            <div className="mt-4 flex items-center justify-between border-t paper-rule pt-4">
              <div>
                <div className="text-reading text-lg">Dev mode</div>
                <div className="text-xs text-muted-foreground">Surfaces traces and admin tools.</div>
              </div>
              <Button
                size="sm"
                variant={devModeEnabled ? "default" : "outline"}
                onClick={toggleDevMode}
                className="gap-2 rounded-full bg-transparent text-foreground shadow-none"
              >
                <SlidersHorizontal size={14} />
                {devModeEnabled ? "ON" : "OFF"}
              </Button>
            </div>
            <div className="mt-4 flex items-center justify-between border-t paper-rule pt-4">
              <div>
                <div className="text-reading text-lg">Dataset Mode</div>
                <div className="text-xs text-muted-foreground">Toggle between Production and Test/Sample suttas.</div>
              </div>
              <Button
                size="sm"
                variant={corpusMode === "test" ? "default" : "outline"}
                onClick={toggleCorpusMode}
                className="gap-2 rounded-full bg-transparent text-foreground shadow-none px-4"
              >
                {corpusMode === "test" ? "TEST DATASET" : "PRODUCTION"}
              </Button>
            </div>
          </section>
        </div>

        {showDevTools && uxToolsEnabled ? (
          <div className="mt-4 text-left">
          <div className="border-y paper-rule py-4">
            <div className="label-mono text-muted-foreground">UX notes (for you)</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Use this while you work on images: write what felt confusing/slow/pleasant. Saved locally.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Example: The sutta header feels cramped on mobile; need more spacing above buttons…"
              rows={4}
              className="mt-3 w-full resize-none border-y paper-rule bg-transparent p-3 text-[14px] leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                className="flex-1"
                disabled={!note.trim()}
                onClick={() => {
                  const text = note.trim();
                  if (!text) return;
                  trackUxEvent("ux_note", { text });
                  setNote("");
                }}
              >
                Save note
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setNote("");
                  trackUxEvent("ux_note_clear_draft");
                }}
              >
                Clear
              </Button>
            </div>
          </div>

          <div className="mt-3 border-y paper-rule py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="label-mono text-muted-foreground">UX log</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Last {recentUx.length} event(s) · {Array.isArray(uxLog) ? uxLog.length : 0} total
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => void copyUxLog()}>
                  Export
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    clearUxLog();
                    trackUxEvent("ux_clear");
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
            {recentUx.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No events yet.</p>
            ) : (
              <div className="mt-3 max-h-[min(40vh,16rem)] overflow-y-auto space-y-2 pr-1">
                {recentUx.map((ev) => (
                  <div
                    key={`${ev.t}:${ev.name}`}
                    className="rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-2"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="text-sm font-medium text-foreground/95">{ev.name}</div>
                      <div className="label-mono text-[10px] text-muted-foreground tabular-nums">
                        {new Date(ev.t).toLocaleString()}
                      </div>
                    </div>
                    {ev.props ? (
                      <pre className="mt-2 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">
                        {JSON.stringify(ev.props, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        ) : null}
      </div>
    </div>
  );
}
