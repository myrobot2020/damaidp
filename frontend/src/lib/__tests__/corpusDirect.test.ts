import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { relativeJsonPathForSuttaId } from "../corpusDirect";

describe("corpusDirect", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("resolves AN ids with and without prefix", () => {
    expect(relativeJsonPathForSuttaId("AN 11.16")).toBe("an/an11/11.16.json");
    expect(relativeJsonPathForSuttaId("11.16")).toBe("an/an11/11.16.json");
  });

  it("resolves non-AN nikaya ids into suttas folders", () => {
    expect(relativeJsonPathForSuttaId("SN 1.2")).toBe("sn/sn1/suttas/1.2.json");
    expect(relativeJsonPathForSuttaId("DN 2.5")).toBe("dn/dn2/suttas/2.5.json");
    expect(relativeJsonPathForSuttaId("MN 10.1")).toBe("mn/mn10/suttas/10.1.json");
    expect(relativeJsonPathForSuttaId("KN 3.4")).toBe("kn/kn3/suttas/3.4.json");
  });

  it("rejects ids outside the supported corpus path shapes", () => {
    expect(relativeJsonPathForSuttaId("")).toBeNull();
    expect(relativeJsonPathForSuttaId("AN 12.1")).toBeNull();
    expect(relativeJsonPathForSuttaId("nonsense")).toBeNull();
  });

  it("uses direct corpus mode unless a remote API or api mode is configured", async () => {
    const mod = await import("../corpusDirect");

    expect(mod.useRemoteDamaApi()).toBe(false);
    expect(mod.useDirectCorpusFs()).toBe(true);

    vi.stubEnv("VITE_DAMA_CORPUS_MODE", "api");
    expect(mod.useDirectCorpusFs()).toBe(false);

    vi.stubEnv("VITE_DAMA_CORPUS_MODE", "");
    vi.stubEnv("VITE_DAMA_API_URL", "https://api.example.test");
    expect(mod.useRemoteDamaApi()).toBe(true);
    expect(mod.useDirectCorpusFs()).toBe(false);
  });

  it("loads item details from GCS before trying the local middleware", async () => {
    vi.stubEnv("VITE_DAMA_CORPUS_GCS_BASE", "https://storage.example.test/");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sutta_id: "1.1",
        sutta: "body",
        valid: true,
        aud_file: "clip.mp3",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const mod = await import("../corpusDirect");

    await expect(mod.fetchItemFromCorpusFs("AN 1.1")).resolves.toMatchObject({
      suttaid: "AN 1.1",
      sutta: "body",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://storage.example.test/nikaya/an/an1/1.1.json",
      expect.objectContaining({ credentials: "omit" }),
    );
  });

  it("falls back to the legacy local AN path and enforces the corpus gate", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => "missing" })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sutta_id: "2.1",
          sutta: "body",
          valid: true,
          aud_file: "clip.mp3",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sutta_id: "2.2",
          sutta: "body",
          valid: false,
          aud_file: "clip.mp3",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const mod = await import("../corpusDirect");

    await expect(mod.fetchItemFromCorpusFs("2.1")).resolves.toMatchObject({ suttaid: "AN 2.1" });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/__dama_corpus__/an2/suttas/2.1.json",
      expect.objectContaining({ credentials: "omit" }),
    );
    await expect(mod.fetchItemFromCorpusFs("2.2")).rejects.toThrow("valid=false");
  });

  it("reports unresolved and missing corpus files clearly", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
    const mod = await import("../corpusDirect");

    await expect(mod.fetchItemFromCorpusFs("nonsense")).rejects.toThrow("Cannot resolve corpus path");
    await expect(mod.fetchItemFromCorpusFs("SN 1.1")).rejects.toThrow("Corpus file not found (404)");
  });

  it("loads and filters the local corpus index", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          { suttaid: "1.1", title: "Greed" },
          { suttaid: "1.2", title: "Metta" },
          { suttaid: "2.1", title: "Other" },
        ],
        searchRows: [
          { suttaid: "1.1", blob: "anger greed" },
          { suttaid: "2.1", blob: "quiet" },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const mod = await import("../corpusDirect");

    await expect(mod.fetchItemsFromCorpusFs({ q: "metta" })).resolves.toEqual({
      items: [{ suttaid: "1.2", title: "Metta" }],
    });
    await expect(mod.fetchItemsFromCorpusFs({ q: "anger" })).resolves.toEqual({
      items: [{ suttaid: "1.1", title: "Greed" }],
    });
  });

  it("falls back to the GCS index when local loading fails", async () => {
    vi.stubEnv("VITE_DAMA_CORPUS_GCS_BASE", "https://storage.example.test/");
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ suttaid: "1.1", title: "Remote" }],
          searchRows: [],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const mod = await import("../corpusDirect");

    await expect(mod.fetchItemsFromCorpusFs(undefined)).resolves.toEqual({
      items: [{ suttaid: "1.1", title: "Remote" }],
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "https://storage.example.test/nikaya/index.json",
      expect.objectContaining({ credentials: "omit" }),
    );
  });

  it("throws when neither local nor GCS index data can be loaded", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);
    const mod = await import("../corpusDirect");

    await expect(mod.fetchItemsFromCorpusFs(undefined)).rejects.toThrow("Corpus index could not be loaded");
  });
});
