import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("leaves", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("creates a grey leaf once per sutta", async () => {
    const mod = await import("../leaves");
    const first = mod.ensureLeaf("1.48");
    const second = mod.ensureLeaf("1.48");

    expect(first).toMatchObject({ suttaId: "1.48", state: "grey", createdAtMs: 1_000 });
    expect(second).toEqual(first);
    expect(Object.keys(mod.readLeaves())).toEqual(["1.48"]);
  });

  it("answers a grey leaf into green with review timers", async () => {
    vi.stubEnv("VITE_LEAF_YELLOW_AFTER_MS", "5000");
    vi.stubEnv("VITE_LEAF_FALL_AFTER_MS", "9000");
    const mod = await import("../leaves");

    const leaf = mod.answerLeaf("1.48", "wise");

    expect(leaf).toMatchObject({
      suttaId: "1.48",
      state: "green",
      answeredAtMs: 1_000,
      yellowAtMs: 6_000,
      fallAtMs: 10_000,
      lastOptionId: "wise",
    });
  });

  it("hydrates green to yellow after the review time", async () => {
    const mod = await import("../leaves");
    const leaf = {
      suttaId: "1.48",
      state: "green" as const,
      createdAtMs: 1,
      updatedAtMs: 1,
      yellowAtMs: 5,
      fallAtMs: 10,
    };

    expect(mod.hydrateLeaf(leaf, 4).state).toBe("green");
    expect(mod.hydrateLeaf(leaf, 5)).toMatchObject({ state: "yellow", updatedAtMs: 5 });
  });

  it("hydrates yellow back to grey after fall time", async () => {
    const mod = await import("../leaves");
    const leaf = {
      suttaId: "1.48",
      state: "yellow" as const,
      createdAtMs: 1,
      updatedAtMs: 5,
      fallAtMs: 10,
      answeredAtMs: 2,
      yellowAtMs: 5,
      lastOptionId: "old",
    };

    expect(mod.hydrateLeaf(leaf, 9).state).toBe("yellow");
    expect(mod.hydrateLeaf(leaf, 10)).toEqual({
      suttaId: "1.48",
      state: "grey",
      createdAtMs: 1,
      updatedAtMs: 10,
    });
  });

  it("turns a yellow leaf gold only for the teacher-aligned option", async () => {
    const mod = await import("../leaves");
    localStorage.setItem(
      "dama:leaves",
      JSON.stringify({
        "1.48": {
          suttaId: "1.48",
          state: "yellow",
          createdAtMs: 1,
          updatedAtMs: 2,
          yellowAtMs: 2,
          fallAtMs: 10_000,
        },
      }),
    );

    const wrong = mod.reviewLeafToGold("1.48", "not-it", "gold");
    expect(wrong).toMatchObject({ state: "yellow", lastOptionId: "not-it" });

    const right = mod.reviewLeafToGold("1.48", "gold", "gold");
    expect(right).toMatchObject({ state: "gold", lastOptionId: "gold", goldAtMs: 1_000 });
  });

  it("falls back to normal answer behavior when review is not yellow", async () => {
    const mod = await import("../leaves");
    const leaf = mod.reviewLeafToGold("1.48", "choice", "choice");

    expect(leaf).toMatchObject({ state: "green", lastOptionId: "choice" });
  });
});
