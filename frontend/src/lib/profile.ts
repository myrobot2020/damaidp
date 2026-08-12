import { supabase } from "@/lib/supabase";

export type ProfileRow = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type Profile = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export function normalizeUsername(raw: string): string {
  return (raw ?? "").trim();
}

export function validateUsername(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = normalizeUsername(raw);
  if (value.length < 1) return { ok: false, error: "Username cannot be empty." };
  if (value.length > 256) return { ok: false, error: "Username must be 256 characters or less." };
  return { ok: true, value };
}

function toProfile(row: ProfileRow): Profile {
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  };
}

function coerceSupabaseError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (err && typeof err === "object") {
    const anyErr = err as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts: string[] = [];
    if (typeof anyErr.message === "string" && anyErr.message.trim()) parts.push(anyErr.message.trim());
    if (typeof anyErr.details === "string" && anyErr.details.trim()) parts.push(anyErr.details.trim());
    if (typeof anyErr.hint === "string" && anyErr.hint.trim()) parts.push(anyErr.hint.trim());
    if (typeof anyErr.code === "string" && anyErr.code.trim()) parts.push(`code=${anyErr.code.trim()}`);
    if (parts.length) return new Error(parts.join(" · "));
  }
  return new Error(String(err));
}

export async function fetchProfileByUserId(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const uid = (userId || "").trim();
  if (!uid) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, username, display_name, avatar_url")
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw coerceSupabaseError(error);
  if (!data) return null;
  return toProfile(data as ProfileRow);
}

export async function createProfile(params: {
  userId: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}): Promise<Profile> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const uid = params.userId.trim();
  const v = validateUsername(params.username);
  if (!v.ok) throw new Error(v.error);
  const row = {
    user_id: uid,
    username: v.value,
    display_name: params.displayName ?? null,
    avatar_url: params.avatarUrl ?? null,
  };
  const { data, error } = await supabase
    .from("profiles")
    .insert(row)
    .select("user_id, username, display_name, avatar_url")
    .single();
  if (error) throw coerceSupabaseError(error);
  return toProfile(data as ProfileRow);
}

export async function updateProfile(params: {
  userId: string;
  username?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}): Promise<Profile> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const uid = params.userId.trim();
  if (!uid) throw new Error("Missing user id.");

  const patch: Partial<ProfileRow> = {};
  if (typeof params.username === "string") {
    const v = validateUsername(params.username);
    if (!v.ok) throw new Error(v.error);
    patch.username = v.value;
  }
  if (params.displayName !== undefined) patch.display_name = params.displayName;
  if (params.avatarUrl !== undefined) patch.avatar_url = params.avatarUrl;

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("user_id", uid)
    .select("user_id, username, display_name, avatar_url")
    .single();
  if (error) throw coerceSupabaseError(error);
  return toProfile(data as ProfileRow);
}

export function isLikelyUniqueViolation(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /duplicate key value violates unique constraint/i.test(msg) || /violates unique constraint/i.test(msg);
}
