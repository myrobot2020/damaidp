import type { ItemDetail } from "./damaApi";
import { getBookOnePractice, getFallbackPractice, type SuttaPractice } from "@/data/bookOnePractices";
import { stripTranscriptNoise } from "./damaApi";

/**
 * Returns the best practice for a given sutta.
 * Prioritizes JSON-embedded quizzes over hardcoded practices.
 */
export function getPracticeForItem(
  id: string,
  item: ItemDetail | null,
): SuttaPractice {
  if (item?.mcq) {
    return {
      suttaId: item.suttaid,
      vow: "",
      mcq: item.mcq as any,
      technique: { title: "", steps: [] },
    };
  }

  const fallbackQuote = item
    ? stripTranscriptNoise(item.sutta).replace(/\s+/g, " ").slice(0, 180)
    : id;

  return getBookOnePractice(id) ?? getFallbackPractice(id, fallbackQuote);
}

export type PracticeMode = "vow" | "mcq" | "technique" | "none";

export function getPracticeMode(
  id: string,
  item: ItemDetail | null,
): PracticeMode {
  if (item?.mcq) return "mcq";

  const lastNumber = id
    .replace(/^AN\s+/i, "")
    .split(".")
    .map((part) => parseInt(part, 10))
    .filter(Number.isFinite)
    .at(-1);

  return (["vow", "mcq", "technique"] as const)[
    (lastNumber ?? id.length) % 3
  ];
}
