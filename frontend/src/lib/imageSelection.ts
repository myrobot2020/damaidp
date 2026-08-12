export type ImageCandidate = {
  panelId: string;
  imageUrl: string;
  localPath: string;
  title: string;
};

export type ImageSelection = {
  sutta_id: string;
  panel_id: string;
  image_url: string;
  status: "selected";
  selection_word: string;
  selection_reason: string;
  exact_sutta_text?: string;
  selected_by: string;
  created_at: string;
};

type SegmentLike = {
  segment_id?: string;
  id?: string | number;
  text?: string;
  kind?: string;
};

export function safeSelectionId(suttaId: string): string {
  return suttaId.trim().replace(/\s+/g, "_").replace(/[^\w.-]/g, "_");
}

export function candidateTitle(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function selectionStatus(selection: ImageSelection | null | undefined): { text: string; color: string } {
  return selection ? { text: "SELECTED", color: "#0f766e" } : { text: "-", color: "#94a3b8" };
}

export function extractExactSuttaText(document: { sutta?: string; text?: string; segments?: SegmentLike[] }): string {
  if (typeof document.sutta === "string" && document.sutta.trim()) return cleanText(document.sutta);

  const segments = Array.isArray(document.segments) ? document.segments : [];
  if (segments.length > 0) {
    const nonCommentary = segments.filter((segment) => segment.kind && segment.kind !== "commentary" && segment.text);
    const source = nonCommentary.length > 0 ? nonCommentary : segments.slice(findSuttaStartIndex(segments));
    return cleanText(source.map((segment) => segment.text || "").join(" "));
  }

  return cleanText(document.text || "");
}

export function compressSuttaText(text: string): string {
  const stopWords = new Set([
    "and",
    "are",
    "for",
    "from",
    "have",
    "how",
    "into",
    "must",
    "not",
    "that",
    "the",
    "their",
    "then",
    "these",
    "this",
    "those",
    "thus",
    "unto",
    "what",
    "when",
    "will",
    "with",
    "you",
    "your",
  ]);
  const counts = new Map<string, number>();
  for (const word of text.toLowerCase().match(/[a-z]{4,}/g) || []) {
    if (stopWords.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([word]) => word)
    .join(" ");
}

function findSuttaStartIndex(segments: SegmentLike[]): number {
  const startPattern = /\b(the buddha said|buddha said|the blessed one|blessed one|thus have i heard|monks|bhikkhus)\b/i;
  const index = segments.findIndex((segment) => startPattern.test(segment.text || ""));
  return index >= 0 ? index : 0;
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
