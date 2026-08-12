/**
 * English sutta line titles: title case name (each word: capital start, rest lower) + " sutta".
 * Strips a trailing "sutta" (any case) before formatting the name.
 */
function toTitleCaseWords(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (!word.length) return word;
      const first = word[0]!;
      const rest = word.slice(1);
      return first.toLocaleUpperCase("en") + rest.toLocaleLowerCase("en");
    })
    .join(" ");
}

export function ensureEnglishSuttaSuffix(name: string): string {
  const s = (name ?? "").trim();
  if (!s) return s;
  const base = s.replace(/\s*sutta\s*$/i, "").trim();
  const namePart = base || s;
  return `${toTitleCaseWords(namePart)} sutta`;
}
