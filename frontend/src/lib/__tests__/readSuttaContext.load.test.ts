import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../damaApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../damaApi")>();
  return {
    ...actual,
    getItem: vi.fn(),
  };
});

import { getItem } from "../damaApi";
import { loadReadSuttaContexts } from "../readSuttaContext";

const getItemMock = vi.mocked(getItem);

describe("read sutta context loading", () => {
  beforeEach(() => {
    getItemMock.mockReset();
  });

  it("loads unique marked-read suttas and includes commentary context", async () => {
    getItemMock.mockResolvedValue({
      suttaid: "AN 1.18.13",
      sutta_name_en: "Dung",
      sutta: "The Buddha said [Music] this is a short teaching.",
      commentary: "Teacher commentary about clinging.",
    });

    const contexts = await loadReadSuttaContexts(
      [" AN 1.18.13 ", "AN 1.18.13", ""],
      "clinging teaching",
    );

    expect(getItemMock).toHaveBeenCalledTimes(1);
    expect(contexts).toEqual([
      expect.objectContaining({
        suttaid: "AN 1.18.13",
        title: "Dung sutta",
        text: expect.stringContaining("Commentary:"),
      }),
    ]);
    expect(contexts[0].text).not.toContain("[Music]");
  });

  it("drops suttas that fail to load", async () => {
    getItemMock
      .mockResolvedValueOnce({
        suttaid: "AN 1.18.13",
        sutta_name_en: "Dung",
        sutta: "A loaded teaching.",
      })
      .mockRejectedValueOnce(new Error("missing"));

    const contexts = await loadReadSuttaContexts(["AN 1.18.13", "AN 1.18.14"], "loaded");

    expect(contexts).toHaveLength(1);
    expect(contexts[0].suttaid).toBe("AN 1.18.13");
  });
});
