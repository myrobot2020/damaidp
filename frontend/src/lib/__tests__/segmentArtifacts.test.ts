import { describe, expect, it } from "vitest";
import { getSegmentsWorkPath, normalizeWorkPath, updateSegmentSuttaId } from "../segmentArtifacts";

describe("segmentArtifacts", () => {
  it("normalizes data/work artifact paths for the work API", () => {
    expect(normalizeWorkPath("data\\work\\streaming\\segments\\AN_1.1.json")).toBe("streaming/segments/AN_1.1.json");
  });

  it("finds the segments artifact path", () => {
    expect(
      getSegmentsWorkPath([
        { type: "transcript", uri: "data/work/streaming/transcripts/AN_1.1.json" },
        { type: "segments", uri: "data/work/streaming/segments/AN_1.1.json" },
      ]),
    ).toBe("streaming/segments/AN_1.1.json");
  });

  it("updates only the sutta id", () => {
    expect(updateSegmentSuttaId({ sutta_id: "AN 1.1", segments: [{ id: 1 }] }, " SN 1.1 ")).toEqual({
      sutta_id: "SN 1.1",
      segments: [{ id: 1 }],
    });
  });
});
