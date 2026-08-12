import { describe, expect, it } from "vitest";
import { candidateTitle, compressSuttaText, extractExactSuttaText, safeSelectionId, selectionStatus } from "../imageSelection";

describe("imageSelection", () => {
  it("builds filesystem-safe selection ids from sutta ids", () => {
    expect(safeSelectionId("AN 2.1.2")).toBe("AN_2.1.2");
    expect(safeSelectionId("SN 12/38")).toBe("SN_12_38");
  });

  it("turns panel filenames into readable titles", () => {
    expect(candidateTitle("buddha-scene-01.png")).toBe("Buddha Scene 01");
  });

  it("reports whether an image has been selected", () => {
    expect(selectionStatus(null).text).toBe("-");
    expect(
      selectionStatus({
        sutta_id: "AN 1.1",
        panel_id: "buddha-scene-01",
        image_url: "/panels/buddha-scene-01.png",
        status: "selected",
        selection_word: "struggle rebirth",
        selection_reason: "",
        selected_by: "pipeline-ui",
        created_at: "2026-05-01T00:00:00.000Z",
      }).text,
    ).toBe("SELECTED");
  });

  it("extracts sutta text after intro commentary", () => {
    expect(
      extractExactSuttaText({
        segments: [
          { text: "now we come to the chapter of the twos", kind: "commentary" },
          { text: "the buddha said monks these two struggles are hard", kind: "commentary" },
          { text: "to undergo in the world", kind: "commentary" },
        ],
      }),
    ).toBe("the buddha said monks these two struggles are hard to undergo in the world");
  });

  it("compresses sutta text into image-selection words", () => {
    expect(compressSuttaText("the buddha said monks these two struggles include rebirth and renouncing rebirth")).toBe(
      "rebirth buddha include",
    );
  });
});
