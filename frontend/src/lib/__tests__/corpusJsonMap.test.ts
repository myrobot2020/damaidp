import { describe, expect, it } from "vitest";
import {
  itemSummaryFromDetail,
  passesCorpusGate,
  rawJsonToItemDetail,
  stripAnPrefix,
  titleFromCorpusItem,
} from "../corpusJsonMap";

describe("corpusJsonMap", () => {
  it("strips AN prefixes case-insensitively", () => {
    expect(stripAnPrefix("AN 1.48")).toBe("1.48");
    expect(stripAnPrefix(" an 11.16 ")).toBe("11.16");
    expect(stripAnPrefix("SN 1.1")).toBe("SN 1.1");
  });

  it("maps raw AN JSON into item detail with normalized ids and commentary id", () => {
    const detail = rawJsonToItemDetail({
      sutta_id: "1.48",
      sutta: " Body text ",
      commentary: " Notes ",
      valid: "yes",
      sutta_name_en: "shopkeeper",
      aud_file: "a.mp3",
      aud_start_s: "3",
      aud_end_s: "8",
      chain: { count: 2 },
      mcq: {
        suttaId: "AN 1.48",
        quote: "Mind changes quickly.",
        options: [
          { id: "a", title: "A", body: "A body" },
          { id: "b", title: "B", body: "B body" },
          { id: "c", title: "C", body: "C body" },
          { id: "d", title: "D", body: "D body" },
        ],
        goldOptionId: "a",
        teacherSummary: "Teacher explanation.",
      },
    });

    expect(detail).toMatchObject({
      suttaid: "AN 1.48",
      sutta: "Body text",
      commentary: "Notes",
      commentary_id: "cAN 1.48",
      valid: true,
      sutta_name_en: "shopkeeper",
      aud_file: "a.mp3",
      aud_start_s: 3,
      aud_end_s: 8,
      chain: { count: 2 },
      mcq: {
        suttaId: "AN 1.48",
        quote: "Mind changes quickly.",
        goldOptionId: "a",
        teacherSummary: "Teacher explanation.",
      },
    });
    expect(detail.mcq?.options).toHaveLength(4);
  });

  it("maps non-AN commentary ids and valid false values", () => {
    const detail = rawJsonToItemDetail({
      suttaid: "sn 1.1",
      sutta: "Text",
      valid: "off",
    });

    expect(detail.suttaid).toBe("SN 1.1");
    expect(detail.commentary_id).toBe("cSN 1.1");
    expect(detail.valid).toBe(false);
  });

  it("checks corpus gate requirements", () => {
    expect(passesCorpusGate(rawJsonToItemDetail({ sutta_id: "1.1", sutta: "x", aud_file: "x.mp3", valid: true }))).toBe(true);
    expect(passesCorpusGate(rawJsonToItemDetail({ sutta_id: "1.1", sutta: "", aud_file: "x.mp3", valid: true }))).toBe(false);
    expect(passesCorpusGate(rawJsonToItemDetail({ sutta_id: "1.1", sutta: "x", aud_file: "", valid: true }))).toBe(false);
    expect(passesCorpusGate(rawJsonToItemDetail({ sutta_id: "1.1", sutta: "x", aud_file: "x.mp3", valid: false }))).toBe(false);
  });

  it("builds titles and summaries from item details", () => {
    const detail = rawJsonToItemDetail({
      sutta_id: "SN 1.1",
      sutta_name_en: "shopkeeper",
      sutta: "Long body",
      commentary: "Notes",
      valid: true,
      aud_file: "x.mp3",
    });

    expect(titleFromCorpusItem(detail)).toBe("Shopkeeper sutta");
    expect(itemSummaryFromDetail(detail)).toEqual({
      suttaid: "SN 1.1",
      title: "Shopkeeper sutta",
      has_commentary: true,
      nikaya: "SN",
    });
  });

  it("uses truncated body text when no English name exists", () => {
    const detail = rawJsonToItemDetail({
      sutta_id: "1.1",
      sutta: "a".repeat(80),
    });

    expect(titleFromCorpusItem(detail)).toBe(`${"a".repeat(72)}…`);
  });
});
