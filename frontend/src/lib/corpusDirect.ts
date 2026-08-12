/**
 * Read Aṅguttara sutta JSON from GCS via /__dama_corpus__/ (see vite-plugin-dama-corpus-fs.ts).
 * No FastAPI needed for sutta list, reader, or MP3 in dev/preview.
 */

import type { ItemDetail, ItemSummary } from "./damaApi";
import { passesCorpusGate, rawJsonToItemDetail, stripAnPrefix } from "./corpusJsonMap";

/** Set `VITE_DAMA_API_URL` to a deployed dama5 origin — then the app uses `/api` instead of local JSON. */
export function useRemoteDamaApi(): boolean {
  const raw = import.meta.env.VITE_DAMA_API_URL as string | undefined;
  return !!(raw && raw.trim());
}

/**
 * Default: **local JSON + audio**. Use `VITE_DAMA_CORPUS_MODE=api` to force FastAPI `/api` instead.
 */
export function useDirectCorpusFs(): boolean {
  if (useRemoteDamaApi()) return false;
  const mode = (import.meta.env.VITE_DAMA_CORPUS_MODE as string | undefined)?.trim().toLowerCase();
  if (mode === "api") return false;
  return true;
}

/**
 * Resolve filesystem path under corpus root for `GET /__dama_corpus__/…`.
 * `AN 5.3.30` / `5.3.30` → `an/an5/5.3.30.json` (fallback to legacy `an5/suttas/5.3.30.json`);
 * `SN 1.2` → `sn/sn1/suttas/1.2.json` (same pattern as DN/MN/KN).
 */
export function relativeJsonPathForSuttaId(suttaid: string): string | null {
  const t = suttaid.trim();
  if (!t) return null;
  const od = /^(SN|DN|MN|KN)\s+(\d+)\.([\w.-]+)$/i.exec(t);
  if (od) {
    const nk = od[1].toLowerCase() as "sn" | "dn" | "mn" | "kn";
    const bookSeg = od[2];
    const tail = `${od[2]}.${od[3]}`;
    return `${nk}/${nk}${bookSeg}/suttas/${tail}.json`;
  }
  const core = stripAnPrefix(t);
  if (!core) return null;
  const head = (core.split(".")[0] ?? "").trim();
  const book = parseInt(head, 10);
  if (!Number.isFinite(book) || book < 1 || book > 11) return null;
  return `an/an${book}/${core}.json`;
}

export async function fetchItemFromCorpusFs(suttaid: string, lang = "en", signal?: AbortSignal): Promise<ItemDetail> {
  const rel = relativeJsonPathForSuttaId(suttaid);
  if (!rel) throw new Error(`Cannot resolve corpus path for: ${suttaid}`);

  const pathPrefix = lang === "ja" ? "jp/" : "";

  const gcsBase = import.meta.env.VITE_DAMA_CORPUS_GCS_BASE as string | undefined;
  if (gcsBase) {
    const gcsUrl = `${gcsBase.replace(/\/$/, "")}/nikaya/${pathPrefix}${encodeURI(rel)}`;
    const attempt = await fetch(gcsUrl, { signal, credentials: "omit" });
    if (attempt.ok) {
      const raw = (await attempt.json()) as Record<string, unknown>;
      return rawJsonToItemDetail(raw);
    }
  }

  const candidates = [rel];
  const core = stripAnPrefix(suttaid.trim());
  if (core) {
    const head = (core.split(".")[0] ?? "").trim();
    const book = parseInt(head, 10);
    if (Number.isFinite(book) && book >= 1 && book <= 11) {
      candidates.push(`an${book}/suttas/${core}.json`);
    }
  }
  let r: Response | null = null;
  for (const cand of candidates) {
    const url = `/__dama_corpus__/${pathPrefix}${encodeURI(cand)}`;
    const attempt = await fetch(url, { signal, credentials: "omit" });
    if (attempt.ok) {
      r = attempt;
      break;
    }
    r = attempt;
  }
  if (!r || !r.ok) {
    const t = await r?.text().catch(() => "");
    throw new Error(t || `Corpus file not found (${r?.status ?? 404})`);
  }
  const raw = (await r.json()) as Record<string, unknown>;
  const it = rawJsonToItemDetail(raw);
  if (!passesCorpusGate(it)) {
    throw new Error("This sutta is not in the corpus (valid=false or missing audio).");
  }
  return it;
}

type IndexPayload = {
  items: ItemSummary[];
  searchRows: { suttaid: string; blob: string }[];
};

export async function fetchItemsFromCorpusFs(
  params: { q?: string } | undefined,
  signal?: AbortSignal,
): Promise<{ items: ItemSummary[] }> {
  const gcsBase = import.meta.env.VITE_DAMA_CORPUS_GCS_BASE as string | undefined;

  let data: IndexPayload | null = null;

  // Try local first (Vite middleware)
  try {
    const r = await fetch("/__dama_corpus__/index.json", { signal, credentials: "omit" });
    if (r.ok) {
      data = (await r.json()) as IndexPayload;
    }
  } catch (e) {
    // Local fetch failed, likely no local files
  }

  // If local failed or empty, and GCS base is set, try GCS
  if ((!data || !data.items?.length) && gcsBase) {
    try {
      const gcsUrl = `${gcsBase.replace(/\/$/, "")}/nikaya/index.json`;
      const r = await fetch(gcsUrl, { signal, credentials: "omit", cache: "no-store" });
      if (r.ok) {
        data = (await r.json()) as IndexPayload;
      }
    } catch (e) {
      // GCS fetch failed
    }
  }

  if (!data) {
    throw new Error("Corpus index could not be loaded from local or GCS.");
  }

  const qn = (params?.q ?? "").trim().toLowerCase();
  let items = data.items ?? [];
  if (qn && data.searchRows?.length) {
    const keep = new Set<string>();
    for (const row of data.searchRows) {
      if (row.blob.includes(qn)) keep.add(row.suttaid);
    }
    for (const it of items) {
      if ((it.title ?? "").toLowerCase().includes(qn)) keep.add(it.suttaid);
    }
    items = items.filter((it) => keep.has(it.suttaid));
  }
  return { items };
}
