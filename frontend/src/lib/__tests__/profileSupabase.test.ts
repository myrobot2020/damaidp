import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  single: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  from: vi.fn(),
}));

vi.mock("../supabase", () => ({
  supabase: {
    from: db.from,
  },
}));

function wireQuery() {
  db.from.mockReturnValue({ select: db.select, insert: db.insert, update: db.update });
  db.select.mockReturnValue({ eq: db.eq, single: db.single });
  db.eq.mockReturnValue({ maybeSingle: db.maybeSingle, select: db.select });
  db.insert.mockReturnValue({ select: db.select });
  db.update.mockReturnValue({ eq: db.eq });
}

describe("profile Supabase helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wireQuery();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("fetches and maps a profile by user id", async () => {
    db.maybeSingle.mockResolvedValue({
      data: { user_id: "u1", username: "nik", display_name: "Nik", avatar_url: null },
      error: null,
    });
    const mod = await import("../profile");

    await expect(mod.fetchProfileByUserId(" u1 ")).resolves.toEqual({
      userId: "u1",
      username: "nik",
      displayName: "Nik",
      avatarUrl: null,
    });
    expect(db.from).toHaveBeenCalledWith("profiles");
    expect(db.eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("returns null for blank or missing profiles", async () => {
    db.maybeSingle.mockResolvedValue({ data: null, error: null });
    const mod = await import("../profile");

    await expect(mod.fetchProfileByUserId(" ")).resolves.toBeNull();
    await expect(mod.fetchProfileByUserId("u1")).resolves.toBeNull();
  });

  it("creates and updates profiles", async () => {
    db.single
      .mockResolvedValueOnce({
        data: { user_id: "u1", username: "nik", display_name: null, avatar_url: "a" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { user_id: "u1", username: "new", display_name: "N", avatar_url: null },
        error: null,
      });
    const mod = await import("../profile");

    await expect(mod.createProfile({ userId: " u1 ", username: " nik ", avatarUrl: "a" })).resolves.toMatchObject({
      userId: "u1",
      username: "nik",
      avatarUrl: "a",
    });
    expect(db.insert).toHaveBeenCalledWith({
      user_id: "u1",
      username: "nik",
      display_name: null,
      avatar_url: "a",
    });

    await expect(mod.updateProfile({ userId: "u1", username: " new ", displayName: "N", avatarUrl: null })).resolves.toMatchObject({
      userId: "u1",
      username: "new",
      displayName: "N",
    });
    expect(db.update).toHaveBeenCalledWith({ username: "new", display_name: "N", avatar_url: null });
  });

  it("coerces Supabase errors and detects unique violations", async () => {
    db.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "duplicate key value violates unique constraint", code: "23505" },
    });
    const mod = await import("../profile");

    await expect(mod.fetchProfileByUserId("u1")).rejects.toThrow(/duplicate key value/);
    await expect(mod.updateProfile({ userId: "", username: "x" })).rejects.toThrow("Missing user id");
    await expect(mod.createProfile({ userId: "u1", username: "" })).rejects.toThrow("Username cannot be empty");
    expect(mod.isLikelyUniqueViolation(new Error("duplicate key value violates unique constraint"))).toBe(true);
    expect(mod.isLikelyUniqueViolation("other")).toBe(false);
  });
});
