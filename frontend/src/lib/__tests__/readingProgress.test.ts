import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("readingProgress", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("marks one sutta read and can clear it", async () => {
    const mod = await import("../readingProgress");

    mod.markSuttaRead("1.48", 1000);
    expect(mod.getReadSuttaIds(mod.readReadingProgress())).toEqual(["1.48"]);

    mod.clearSuttaRead("1.48");
    expect(mod.getReadSuttaIds(mod.readReadingProgress())).toEqual([]);
  });

  it("marks a whole book worth of suttas read without duplicating ids", async () => {
    const mod = await import("../readingProgress");

    mod.markSuttasRead(["1.1", "1.2", "1.1", "  "], 2000);

    expect(mod.readReadingProgress()).toMatchObject({
      "1.1": { readAtMs: 2000 },
      "1.2": { readAtMs: 2000 },
    });
    expect(mod.getReadSuttaIds(mod.readReadingProgress())).toEqual(["1.1", "1.2"]);
  });

  it("records opens, merges newer synced data, clears batches, and counts by nikaya", async () => {
    const mod = await import("../readingProgress");

    const seen: string[] = [];
    const unsubscribe = mod.subscribeReadingProgress(() => seen.push("changed"));

    mod.recordSuttaOpened("SN 1.1", 1000);
    mod.recordSuttaOpened("SN 1.1", 1500);
    expect(mod.readReadingProgress()["SN 1.1"]).toMatchObject({
      openedAtMs: 1500,
      openCount: 2,
    });

    mod.mergeReadingProgress({
      "SN 1.1": { openedAtMs: 1200, openCount: 5, readAtMs: 3000 },
      "MN 10.1": { openedAtMs: 2500, readAtMs: 2600 },
      " ": { openedAtMs: 9999 },
    });
    expect(mod.readReadingProgress()).toMatchObject({
      "SN 1.1": { openedAtMs: 1500, openCount: 5, readAtMs: 3000 },
      "MN 10.1": { openedAtMs: 2500, readAtMs: 2600 },
    });
    expect(mod.getReadSuttaIds(mod.readReadingProgress())).toEqual(["MN 10.1", "SN 1.1"]);
    expect(mod.countReadByNikaya(["AN 1.1", "SN 1.1", "MN 10.1", "DN 2.1", "KN 3.1"])).toEqual({
      AN: 1,
      SN: 1,
      DN: 1,
      MN: 1,
      KN: 1,
    });

    mod.clearSuttasRead(["SN 1.1", "MN 10.1"]);
    expect(mod.getReadSuttaIds(mod.readReadingProgress())).toEqual([]);
    expect(seen.length).toBeGreaterThan(0);
    unsubscribe();
  });

  it("handles corrupt storage and reset", async () => {
    const mod = await import("../readingProgress");

    localStorage.setItem(mod.READING_PROGRESS_STORAGE_KEY, "{not json");
    expect(mod.readReadingProgress()).toEqual(mod.INITIAL_READING_PROGRESS_SNAPSHOT);

    localStorage.setItem(
      mod.READING_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        "AN 1.1": { openedAtMs: "100", openCount: "2.8", readAtMs: "bad" },
      }),
    );
    expect(mod.readReadingProgress()).toEqual({
      "AN 1.1": { openedAtMs: 100, openCount: 2, readAtMs: undefined },
    });

    mod.resetReadingProgress();
    expect(mod.readReadingProgress()).toEqual({});
  });
});
