import { describe, expect, it } from "vitest";

import { normalizeUsername, validateUsername } from "../profile";

describe("lib/profile", () => {
  it("normalizes by trimming only", () => {
    expect(normalizeUsername("  Hello World  ")).toBe("Hello World");
  });

  it("rejects empty usernames", () => {
    const v = validateUsername("   ");
    expect(v.ok).toBe(false);
  });

  it("accepts arbitrary usernames up to 256 chars", () => {
    const name = "😄 any thing / goes — here";
    const v = validateUsername(name);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.value).toBe(name.trim());
  });

  it("rejects usernames longer than 256 chars", () => {
    const v = validateUsername("a".repeat(257));
    expect(v.ok).toBe(false);
  });
});

