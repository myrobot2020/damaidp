import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@supabase/supabase-js";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: {} })),
}));

describe("lib/supabase", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is not configured and does not create a client when env is missing", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    const mod = await import("../supabase");
    expect(mod.isSupabaseConfigured).toBe(false);
    expect(mod.supabase).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
    expect(() => mod.requireSupabase()).toThrow(/Supabase is not configured/);
  });

  it("creates a browser client when URL and anon key are set", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon");
    const mod = await import("../supabase");
    expect(mod.isSupabaseConfigured).toBe(true);
    expect(mod.supabase).not.toBeNull();
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith("https://example.supabase.co", "test-anon", {
      auth: {
        flowType: "pkce",
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  });

  it("accepts publishable key when anon key is absent", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "pub-key");
    const mod = await import("../supabase");
    expect(mod.isSupabaseConfigured).toBe(true);
    expect(createClient).toHaveBeenCalledWith("https://example.supabase.co", "pub-key", {
      auth: {
        flowType: "pkce",
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  });
});
