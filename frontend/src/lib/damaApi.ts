import { ensureEnglishSuttaSuffix } from "./suttaTitle";
import { rawJsonToItemDetail } from "./corpusJsonMap";

export { ensureEnglishSuttaSuffix };

export type NikayaId = "AN" | "SN" | "DN" | "MN" | "KN";

export type ItemSummary = {
  suttaid: string;
  title?: string;
  nikaya: NikayaId | string;
  book: string;
  has_commentary?: boolean;
  has_audio?: boolean;
  has_graph?: boolean;
  has_practice?: boolean;
  languages?: string[];
};

export const NIKAYA_OPTIONS: { value: NikayaId; label: string; title: string }[] = [
  { value: "AN", label: "Aṅguttara", title: "Aṅguttara Nikāya" },
  { value: "SN", label: "Saṁyutta", title: "Saṁyutta Nikāya" },
  { value: "DN", label: "Dīgha", title: "Dīgha Nikāya" },
  { value: "MN", label: "Majjhima", title: "Majjhima Nikāya" },
  { value: "KN", label: "Khuddaka", title: "Khuddaka Nikāya" },
];

export const AN_BOOK_TITLES: Record<number, string> = {
  1: "Book of Ones", 2: "Book of Twos", 3: "Book of Threes", 4: "Book of Fours",
  5: "Book of Fives", 6: "Book of Sixes", 7: "Book of Sevens", 8: "Book of Eights",
  9: "Book of Nines", 10: "Book of Tens", 11: "Book of Elevens",
};

export const AN_NIPATA_OPTIONS = Object.entries(AN_BOOK_TITLES).map(([value, label]) => ({
  value,
  label,
}));

export const REFLECTION_QUERY_STORAGE_KEY = "dama_reflection_query";
export const DEFAULT_SUTTA_ID = "AN 5.4.40";
export const DEFAULT_AN_BOOK = "5";

export type ItemDetail = {
  suttaid: string;
  title?: string;
  sutta_name_en?: string;
  sutta_name_pali?: string;
  sutta: string;
  commentary?: string;
  commentary_id?: string;
  sc_id?: string;
  sc_url?: string;
  sc_sutta?: string;
  aud_file?: string;
  aud_start_s?: number;
  aud_end_s?: number;
  image_url?: string;
  knowledge_graph?: any;
  graph?: any;
  mcq?: any;
  quiz?: any;
  valid?: boolean;
  youtube_url?: string;
  youtube_video_id?: string;
  chain?: any;
  transcript?: string;
  languages?: string[];
  current_lang?: string;
};

export type DamaChunk = {
  source?: string;
  suttaid?: string;
  text?: string;
  book?: string;
};

export type DamaQueryResponse = {
  chunks: DamaChunk[];
  answer: string;
  used_llm: boolean;
  timings_ms?: Record<string, unknown> | null;
};

export function getDamaApiBase(): string {
  const raw = import.meta.env.VITE_DAMA_API_URL as string | undefined;
  if (raw && raw.trim()) return raw.replace(/\/$/, "");
  return "";
}

export function getDamaAudPublicBase(): string {
  const raw = import.meta.env.VITE_DAMA_AUD_PUBLIC_BASE as string | undefined;
  if (raw && raw.trim()) return raw.replace(/\/$/, "");
  return "/dama-aud";
}

export function getPublicAudUrl(filename: string): string {
  const name = (filename || "").trim();
  if (!name) return "/aud/";
  return `/aud/${encodeURIComponent(name)}`;
}

export function getDamaAudUrl(filename: string): string {
  const base = getDamaApiBase();
  const name = (filename || "").trim();
  if (!name) return `${base}/aud/`;
  return `${base}/aud/${encodeURIComponent(name)}`;
}

export function getBaseDir(): string {
  return "/__dama_corpus__";
}

function llmEnabledFromEnv(): boolean {
  const v = (import.meta.env.VITE_DAMA_USE_LLM as string | undefined)?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  return true;
}

export async function postDamaQuery(
  question: string,
  signal?: AbortSignal,
): Promise<DamaQueryResponse> {
  const base = getDamaApiBase();
  const url = `${base}/api/query`;
  const body = {
    question: question.trim(),
    book: "all",
    k: 6,
    use_llm: llmEnabledFromEnv(),
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
    credentials: "omit",
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(text || `Request failed (${r.status})`);
  }
  return r.json() as Promise<DamaQueryResponse>;
}

export async function getItems(
  params?: { q?: string; book?: string },
  signal?: AbortSignal,
): Promise<{ items: ItemSummary[] }> {
  const apiBase = getDamaApiBase();
  if (apiBase) {
    const usp = new URLSearchParams();
    if (params?.q) usp.set("q", params.q);
    if (params?.book) usp.set("book", params.book);
    const qs = usp.toString();
    const url = `${apiBase}/api/items${qs ? `?${qs}` : ""}`;
    const r = await fetch(url, { method: "GET", signal, credentials: "omit" });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      throw new Error(text || `Request failed (${r.status})`);
    }
    return r.json();
  }

  const r = await fetch(`${getBaseDir()}/index.json`, { signal });
  if (!r.ok) throw new Error("Could not load corpus index");
  const data = await r.json();
  let items: ItemSummary[] = data.items || [];

  if (params?.book && params.book !== "all") {
    items = items.filter(it => it.book === params.book);
  }
  if (params?.q) {
    const q = params.q.toLowerCase();
    items = items.filter(it => it.suttaid.toLowerCase().includes(q) || it.title?.toLowerCase().includes(q));
  }
  return { items };
}

export async function getItem(
  suttaid: string,
  lang = "en",
  signal?: AbortSignal,
): Promise<ItemDetail> {
  const apiBase = getDamaApiBase();
  if (apiBase) {
    const url = `${apiBase}/api/item/${encodeURIComponent(suttaid)}?lang=${lang}`;
    const r = await fetch(url, { method: "GET", signal, credentials: "omit" });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      throw new Error(text || `Request failed (${r.status})`);
    }
    const data = (await r.json()) as any;
    const detail = rawJsonToItemDetail(data);
    if (detail.valid === false) {
      throw new Error("This sutta is not in the corpus (valid=false).");
    }
    return detail;
  }

  const coreId = suttaid.replace(/^[A-Z]+\s+/, "");
  const nikaya = suttaid.split(" ")[0].toLowerCase();
  const book = coreId.split(".")[0];

  const langPrefix = lang === "ja" ? "jp/" : lang === "en" ? "" : `${lang}/`;
  const path = `${getBaseDir()}/${langPrefix}${nikaya}/${nikaya}${book}/${coreId}.json`;

  const r = await fetch(path, { signal });
  if (!r.ok) throw new Error(`Sutta ${suttaid} not found`);
  const data = await r.json();
  const detail = rawJsonToItemDetail(data);
  if (detail.valid === false) {
    throw new Error("This sutta is not in the corpus (valid=false).");
  }
  return detail;
}

export async function getRandomSutta(signal?: AbortSignal): Promise<ItemSummary | null> {
  try {
    const { items } = await getItems({ book: "all" }, signal);
    if (!items.length) return null;
    return items[Math.floor(Math.random() * items.length)];
  } catch {
    return null;
  }
}

export function canonIndexSubtitle(suttaid: string): string {
  const ref = suttaid.trim();
  const nk = inferNikayaFromSuttaId(suttaid);
  if (nk !== "AN") {
    const nt = NIKAYA_OPTIONS.find((o) => o.value === nk)?.title ?? nk;
    const ob = otherNikayaBookFromSuttaId(suttaid);
    if (ob != null && ref) return `${nt} · Book ${ob} · ${ref}`;
    return ref ? `${nt} · ${ref}` : nt;
  }
  const b = anBookFromSuttaId(suttaid);
  if (b == null) return ref ? `Aṅguttara Nikāya · ${ref}` : "Aṅguttara Nikāya";
  return `Aṅguttara Nikāya · ${AN_BOOK_TITLES[b]} · ${ref}`;
}

export function stripTranscriptNoise(text: string): string {
  let s = text ?? "";
  s = s.replace(
    /\s*\[(?:Music|music|MUSIC|Laughter|laughter|LAUGHTER|Applause|applause|Noise|noise|Silence|silence)\]\s*/g,
    " ",
  );
  s = s.replace(/\s{2,}/g, " ");
  return s.trim();
}

export function itemDisplayHeading(item: ItemDetail): string {
  const en = item.sutta_name_en?.trim();
  if (en) return ensureEnglishSuttaSuffix(en);
  const t = item.title?.trim();
  if (t) return t;
  const s = stripTranscriptNoise(item.sutta).replace(/\s+/g, " ").trim();
  if (!s) return item.suttaid;
  const one = s.slice(0, 88);
  return one + (s.length > 88 ? "…" : "");
}

export function getCorpusAudSrc(filename: string): string {
  const name = (filename || "").trim();
  if (!name) return "";
  if (/\.webm$/i.test(name) || /\.weba$/i.test(name)) return "";

  const publicBase = getDamaAudPublicBase();
  if (publicBase) {
    return `${publicBase}/${encodeURIComponent(name)}`;
  }

  const base = getDamaApiBase();
  if (base) return `${base}/aud/${encodeURIComponent(name)}`;

  return `${getBaseDir()}/aud/${filename}`;
}

export function isAn1116Sutta(suttaid: string | undefined | null): boolean {
  const x = (suttaid ?? "").trim().replace(/^AN\s+/i, "").trim();
  if (x === "11.16") return true;
  const head = (x.split(".")[0] ?? "").trim();
  const rest = (x.split(".")[1] ?? "").trim();
  return head === "11" && rest === "16";
}

export function anBookFromSuttaId(suttaid: string | undefined | null): number | null {
  const t = (suttaid ?? "")
    .trim()
    .replace(/^AN\s+/i, "")
    .trim();
  const head = (t.split(".")[0] ?? "").trim();
  const n = parseInt(head, 10);
  if (!Number.isFinite(n) || n < 1 || n > 11) return null;
  return n;
}

export function otherNikayaBookFromSuttaId(suttaid: string | undefined | null): number | null {
  const t = (suttaid ?? "").trim();
  const m = /^(SN|DN|MN|KN)\s+(\d+)(\.|$)/i.exec(t);
  if (!m) return null;
  const n = parseInt(m[2], 10);
  return Number.isFinite(n) ? n : null;
}

export function filterItemsByNipata(items: ItemSummary[], nipata: string): ItemSummary[] {
  if (nipata === "all") return items;
  const want = parseInt(nipata, 10);
  if (!Number.isFinite(want)) return items;
  return items.filter((it) => anBookFromSuttaId(it.suttaid) === want);
}

export function filterItemsByNikayaBook(
  items: ItemSummary[],
  nik: NikayaId,
  book: string,
): ItemSummary[] {
  const inNik = filterItemsByNikaya(items, nik);
  if (book === "all") return inNik;
  if (nik === "AN") return filterItemsByNipata(inNik, book);
  const want = parseInt(book, 10);
  if (!Number.isFinite(want)) return inNik;
  return inNik.filter((it) => otherNikayaBookFromSuttaId(it.suttaid) === want);
}

function _normNikaya(s: string | undefined): NikayaId | null {
  const u = (s || "").trim().toUpperCase();
  if (u === "AN" || u === "SN" || u === "DN" || u === "MN" || u === "KN") return u;
  return null;
}

export function inferNikayaFromSuttaId(suttaid: string): NikayaId {
  const raw = (suttaid || "").trim();
  if (!raw) return "AN";
  const up = raw.toUpperCase();
  if (/^\s*SN[\s.]/i.test(raw) || /^\s*SN$/i.test(raw)) return "SN";
  if (/^\s*DN[\s.]/i.test(raw) || /^DN\d/i.test(up)) return "DN";
  if (/^\s*MN[\s.]/i.test(raw) || /^MN\d/i.test(up)) return "MN";
  if (/^\s*KN\b/i.test(raw)) return "KN";
  if (anBookFromSuttaId(raw) != null) return "AN";
  return "AN";
}

export function inferNikayaFromItem(it: ItemSummary): NikayaId {
  const fromApi = _normNikaya(it.nikaya as string | undefined);
  if (fromApi) return fromApi;
  return inferNikayaFromSuttaId(it.suttaid);
}

export function filterItemsByNikaya(items: ItemSummary[], nik: NikayaId): ItemSummary[] {
  return items.filter((it) => inferNikayaFromItem(it) === nik);
}
