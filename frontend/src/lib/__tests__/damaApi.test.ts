import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemSummary } from "../damaApi";

describe("damaApi pure helpers", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("extracts AN and other nikaya book numbers", async () => {
    const mod = await import("../damaApi");
    expect(mod.DEFAULT_AN_BOOK).toBe("1");
    expect(mod.DEFAULT_SUTTA_ID).toBe("AN 1.18.13");
    expect(mod.anBookFromSuttaId("AN 11.16")).toBe(11);
    expect(mod.anBookFromSuttaId("12.1")).toBeNull();
    expect(mod.otherNikayaBookFromSuttaId("SN 2.5")).toBe(2);
    expect(mod.otherNikayaBookFromSuttaId("AN 2.5")).toBeNull();
  });

  it("infers and filters nikayas and books", async () => {
    const mod = await import("../damaApi");
    const items: ItemSummary[] = [
      { suttaid: "1.1" },
      { suttaid: "2.1" },
      { suttaid: "SN 1.1" },
      { suttaid: "DN 2.1" },
      { suttaid: "whatever", nikaya: "MN" },
    ];

    expect(mod.inferNikayaFromSuttaId("DN1")).toBe("DN");
    expect(mod.inferNikayaFromSuttaId("MN 10.1")).toBe("MN");
    expect(mod.inferNikayaFromSuttaId("KN 3.1")).toBe("KN");
    expect(mod.filterItemsByNikaya(items, "AN").map((x) => x.suttaid)).toEqual(["1.1", "2.1"]);
    expect(mod.filterItemsByNipata(items, "1").map((x) => x.suttaid)).toEqual(["1.1"]);
    expect(mod.filterItemsByNipata(items, "bad").map((x) => x.suttaid)).toEqual(items.map((x) => x.suttaid));
    expect(mod.filterItemsByNikayaBook(items, "DN", "2").map((x) => x.suttaid)).toEqual(["DN 2.1"]);
    expect(mod.filterItemsByNikayaBook(items, "SN", "bad").map((x) => x.suttaid)).toEqual(["SN 1.1"]);
  });

  it("builds API and audio URLs from environment", async () => {
    vi.stubEnv("VITE_DAMA_API_URL", "https://api.example.test/");
    vi.stubEnv("VITE_DAMA_AUD_PUBLIC_BASE", "https://aud.example.test/");
    const mod = await import("../damaApi");

    expect(mod.getDamaApiBase()).toBe("https://api.example.test");
    expect(mod.getDamaAudPublicBase()).toBe("https://aud.example.test");
    expect(mod.getPublicAudUrl("a b.mp3")).toBe("/aud/a%20b.mp3");
    expect(mod.getPublicAudUrl("")).toBe("/aud/");
    expect(mod.getDamaAudUrl("a b.mp3")).toBe("https://api.example.test/aud/a%20b.mp3");
    expect(mod.getCorpusAudSrc("clip.mp3")).toBe("https://aud.example.test/clip.mp3");
    expect(mod.getCorpusAudSrc("clip.webm")).toBe("");
  });

  it("formats subtitles, transcript noise, headings, and AN 11.16 checks", async () => {
    const mod = await import("../damaApi");

    expect(mod.canonIndexSubtitle("11.16")).toBe("Aṅguttara Nikāya · Book of Elevens · 11.16");
    expect(mod.canonIndexSubtitle("SN 1.1")).toBe("Saṁyutta Nikāya · Book 1 · SN 1.1");
    expect(mod.canonIndexSubtitle("unknown")).toBe("Aṅguttara Nikāya · unknown");
    expect(mod.stripTranscriptNoise("Hello [Music]  there [Applause]")).toBe("Hello there");
    expect(mod.itemDisplayHeading({ suttaid: "1.1", sutta_name_en: "shopkeeper", sutta: "body" })).toBe("Shopkeeper sutta");
    expect(mod.itemDisplayHeading({ suttaid: "1.1", title: "Title", sutta: "body" })).toBe("Title");
    expect(mod.itemDisplayHeading({ suttaid: "1.1", sutta: "a".repeat(100) })).toBe(`${"a".repeat(88)}…`);
    expect(mod.itemDisplayHeading({ suttaid: "1.1", sutta: "" })).toBe("1.1");
    expect(mod.isAn1116Sutta("AN 11.16")).toBe(true);
    expect(mod.isAn1116Sutta("11.16.1")).toBe(true);
    expect(mod.isAn1116Sutta("11.15")).toBe(false);
  });

  it("posts Dama queries and surfaces HTTP errors", async () => {
    vi.stubEnv("VITE_DAMA_API_URL", "https://api.example.test");
    vi.stubEnv("VITE_DAMA_USE_LLM", "false");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ chunks: [], answer: "ok", used_llm: false }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "bad",
      });
    vi.stubGlobal("fetch", fetchMock);
    const mod = await import("../damaApi");

    await expect(mod.postDamaQuery("  hi  ")).resolves.toMatchObject({ answer: "ok" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/query",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ question: "hi", book: "all", k: 6, use_llm: false }),
      }),
    );
    await expect(mod.postDamaQuery("hi")).rejects.toThrow("bad");
  });

  it("fetches remote items and item details", async () => {
    vi.stubEnv("VITE_DAMA_API_URL", "https://api.example.test");
    vi.stubEnv("VITE_DAMA_CORPUS_MODE", "api");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ suttaid: "1.1" }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ suttaid: "1.1", sutta: "body", valid: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ suttaid: "1.2", sutta: "body", valid: false }) });
    vi.stubGlobal("fetch", fetchMock);
    const mod = await import("../damaApi");

    await expect(mod.getItems({ q: "metta", book: "all" })).resolves.toEqual({ items: [{ suttaid: "1.1" }] });
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/api/items?q=metta&book=all", expect.any(Object));
    await expect(mod.getItem("1.1", { book: "all" })).resolves.toMatchObject({ suttaid: "1.1" });
    await expect(mod.getItem("1.2")).rejects.toThrow("valid=false");
  });
});
