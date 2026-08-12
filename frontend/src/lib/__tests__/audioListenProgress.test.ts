import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("audioListenProgress", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("stores the maximum fraction reached per sutta", async () => {
    const mod = await import("../audioListenProgress");
    mod.recordAudioListenProgress("7.4.38", 0.5);
    mod.recordAudioListenProgress("7.4.38", 0.3);
    expect(mod.readAudioListenProgress()["7.4.38"]).toBe(0.5);
    mod.recordAudioListenProgress("7.4.38", 0.9);
    expect(mod.readAudioListenProgress()["7.4.38"]).toBe(0.9);
  });

  it("lists sutta ids that meet the completion threshold", async () => {
    const mod = await import("../audioListenProgress");
    mod.recordAudioListenProgress("a", 0.74);
    mod.recordAudioListenProgress("b", 0.75);
    mod.recordAudioListenProgress("c", 1);
    const ids = mod.getSuttaIdsHeardAtLeast(mod.readAudioListenProgress());
    expect(ids).toEqual(["b", "c"]);
  });

  it("returns the same snapshot reference until localStorage changes (useSyncExternalStore)", async () => {
    const mod = await import("../audioListenProgress");
    const a = mod.readAudioListenProgress();
    const b = mod.readAudioListenProgress();
    expect(a).toBe(b);
    mod.recordAudioListenProgress("1.1.1", 0.8);
    const c = mod.readAudioListenProgress();
    expect(c).not.toBe(a);
    const d = mod.readAudioListenProgress();
    expect(d).toBe(c);
  });

  it("counts heard suttas by inferred nikāya", async () => {
    const mod = await import("../audioListenProgress");
    mod.recordAudioListenProgress("11.16", 1);
    mod.recordAudioListenProgress("SN 1.1", 1);
    const map = mod.readAudioListenProgress();
    const ids = mod.getSuttaIdsHeardAtLeast(map);
    const by = mod.countHeardByNikaya(ids);
    expect(by.AN).toBe(1);
    expect(by.SN).toBe(1);
    expect(by.DN + by.MN + by.KN).toBe(0);
  });

  it("parses stored progress defensively and clamps values", async () => {
    localStorage.setItem(
      "dama:audioListenProgress",
      JSON.stringify({ high: 5, low: -1, stringy: "0.5", nope: "x" }),
    );
    const mod = await import("../audioListenProgress");

    expect(mod.readAudioListenProgress()).toEqual({
      high: 1,
      low: 0,
      stringy: 0.5,
    });

    localStorage.setItem("dama:audioListenProgress", "{bad json");
    expect(mod.readAudioListenProgress()).toEqual({});

    localStorage.setItem("dama:audioListenProgress", JSON.stringify(null));
    expect(mod.readAudioListenProgress()).toEqual({});
  });

  it("notifies subscribers for record, merge, reset, and storage events", async () => {
    const mod = await import("../audioListenProgress");
    const listener = vi.fn();
    const unsubscribe = mod.subscribeAudioListenProgress(listener);

    mod.recordAudioListenProgress(" 1.1 ", 0.25);
    mod.mergeAudioListenProgress({ "1.1": 0.9, "2.1": 2, " ": 1, bad: Number.NaN });
    mod.resetAudioListenProgress();
    window.dispatchEvent(new StorageEvent("storage", { key: "dama:audioListenProgress" }));

    expect(listener).toHaveBeenCalledTimes(4);
    unsubscribe();
    mod.recordAudioListenProgress("3.1", 0.8);
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it("skips no-op audio progress writes", async () => {
    const mod = await import("../audioListenProgress");
    const listener = vi.fn();
    mod.subscribeAudioListenProgress(listener);

    mod.recordAudioListenProgress("", 1);
    mod.recordAudioListenProgress("1.1", 0.5);
    mod.recordAudioListenProgress("1.1", 0.2);
    mod.mergeAudioListenProgress({ "1.1": 0.1, bad: Number.NaN });

    expect(mod.readAudioListenProgress()).toEqual({ "1.1": 0.5 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("returns the empty progress map when no browser window is available", async () => {
    vi.stubGlobal("window", undefined);
    const mod = await import("../audioListenProgress");

    expect(mod.readAudioListenProgress()).toBe(mod.EMPTY_AUDIO_PROGRESS_MAP);
    expect(() => mod.recordAudioListenProgress("1.1", 1)).not.toThrow();
    expect(() => mod.mergeAudioListenProgress({ "1.1": 1 })).not.toThrow();
    expect(() => mod.resetAudioListenProgress()).not.toThrow();
  });
});
