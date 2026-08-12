/**
 * Shared Connect middleware: serves `GET /__dama_corpus__/…` (JSON), `/panels/*` (illustrations), and `/dama-aud/*` (teacher audio)
 * directly from the raw project root directory mapping, bypassing any local copies.
 */
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import {
  itemSummaryFromDetail,
  passesCorpusGate,
  rawJsonToItemDetail,
} from "../../src/lib/corpusJsonMap";

const NIKAYA_DIR_MAP: Record<string, string> = {
  AN: "Anguttara Nikaya by Bhante Hye Dhammavuddho Mahathera",
  DN: "Digha Nikaya by Bhante Hye Dhammavuddho Mahathera",
  KN: "Khuddaka Nikaya by Bhante Dhammavuddho Hye Mahathera",
  MN: "Majjhima Nikaya by Bhante Hye Dhammavuddho Mahathera",
  SN: "Samyutta Nikaya by Bhante Hye Dhammavuddho Mahathera"
};

function resolveRawPath(dama5Root: string, rel: string): string | null {
  const cleanRel = rel.replace(/\\/g, "/");
  
  let lang = "en";
  let pathAfterLang = cleanRel;
  const langMatch = /^(jp|hi|hin)\/(.*)$/i.exec(cleanRel);
  if (langMatch) {
    lang = langMatch[1].toLowerCase();
    pathAfterLang = langMatch[2];
  }
  
  let prefix = "";
  let suttaId = "";
  
  const anMatch = /^an\/an\d+\/([\w.-]+)\.json$/i.exec(pathAfterLang) || /^an\d+\/suttas\/([\w.-]+)\.json$/i.exec(pathAfterLang);
  if (anMatch) {
    prefix = "AN";
    suttaId = anMatch[1];
  } else {
    const otherMatch = /^(sn|dn|mn|kn)\/(?:sn|dn|mn|kn)\d+\/([\w.-]+)\.json$/i.exec(pathAfterLang);
    if (otherMatch) {
      prefix = otherMatch[1].toUpperCase();
      suttaId = otherMatch[2];
    }
  }
  
  if (!prefix || !suttaId) {
    return null;
  }
  
  const folderName = suttaId.replace(/\./g, "_");
  const nikayaDir = NIKAYA_DIR_MAP[prefix];
  if (!nikayaDir) return null;
  
  let targetPath = "";
  if (lang === "en") {
    targetPath = path.join(dama5Root, nikayaDir, folderName, `${folderName}.json`);
  } else {
    const langFolder = lang === "jp" ? "jp" : lang;
    targetPath = path.join(dama5Root, nikayaDir, folderName, langFolder, `${folderName}.json`);
  }
  
  if (fs.existsSync(targetPath)) {
    return targetPath;
  }
  return null;
}

function findAudioFile(dama5Root: string, filename: string): string | null {
  for (const dirName of Object.values(NIKAYA_DIR_MAP)) {
    const fullDir = path.join(dama5Root, dirName);
    if (!fs.existsSync(fullDir)) continue;
    
    // Check if filename is already a relative path
    const directPath = path.join(fullDir, filename);
    if (fs.existsSync(directPath)) return directPath;

    for (const ent of fs.readdirSync(fullDir, { withFileTypes: true })) {
      if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
      
      const suttaDir = path.join(fullDir, ent.name);
      
      // Check Sutta Folder (English)
      const p1 = path.join(suttaDir, filename);
      if (fs.existsSync(p1)) return p1;
      
      // Check jp/ subfolder
      const p2 = path.join(suttaDir, "jp", filename);
      if (fs.existsSync(p2)) return p2;
      
      // Check hi/ subfolder
      const p3 = path.join(suttaDir, "hi", filename);
      if (fs.existsSync(p3)) return p3;
    }
  }
  return null;
}

function resolveRawPanelPath(dama5Root: string, filename: string): string | null {
  const match = /^(an|sn|dn|kn|mn)(\d+_\d+[\w_]*)\.(png|jpg|jpeg|mp4|webp|gif)$/i.exec(filename);
  if (!match) return null;
  
  const prefix = match[1].toUpperCase();
  const folderName = match[2];
  const ext = match[3].toLowerCase();
  const nikayaDir = NIKAYA_DIR_MAP[prefix];
  if (!nikayaDir) return null;
  
  const suttaDir = path.join(dama5Root, nikayaDir, folderName);
  if (!fs.existsSync(suttaDir)) return null;
  
  // Try exact match first
  const exact = path.join(suttaDir, filename);
  if (fs.existsSync(exact)) return exact;

  for (const name of fs.readdirSync(suttaDir)) {
    const nl = name.toLowerCase();
    if (nl.endsWith("." + ext) && !nl.includes("_graph")) {
      return path.join(suttaDir, name);
    }
  }
  return null;
}

export function corpusFsMiddleware(dama5Root: string, audRoot: string) {
  return (
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void,
  ) => {
    const raw = req.url?.split("?")[0] ?? "";

    if (raw === "/__dama_corpus__/index.json") {
      try {
        const items: ReturnType<typeof itemSummaryFromDetail>[] = [];
        const searchRows: { suttaid: string; blob: string }[] = [];
        
        for (const [prefix, dirName] of Object.entries(NIKAYA_DIR_MAP)) {
          const fullDir = path.join(dama5Root, dirName);
          if (!fs.existsSync(fullDir)) continue;
          
          for (const ent of fs.readdirSync(fullDir, { withFileTypes: true })) {
            if (!ent.isDirectory() || ent.name.startsWith(".") || ent.name.startsWith("Book")) continue;
            
            const jsonPath = path.join(fullDir, ent.name, `${ent.name}.json`);
            if (!fs.existsSync(jsonPath)) continue;
            
            let obj: Record<string, unknown>;
            try {
              obj = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as Record<string, unknown>;
            } catch {
              continue;
            }
            
            const it = rawJsonToItemDetail(obj);
            if (!passesCorpusGate(it)) continue;
            const sum = itemSummaryFromDetail(it);
            
            items.push(sum);
            searchRows.push({
              suttaid: it.suttaid,
              blob: `${it.suttaid}\n${it.sutta}\n${it.commentary ?? ""}`.toLowerCase(),
            });
          }
        }
        
        items.sort((a, b) =>
          a.suttaid.localeCompare(b.suttaid, undefined, { numeric: true }),
        );
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ items, searchRows }));
      } catch {
        res.statusCode = 500;
        res.end();
      }
      return;
    }

    if (raw.startsWith("/__dama_corpus__/")) {
      const rel = decodeURIComponent(raw.slice("/__dama_corpus__/".length));
      const fp = resolveRawPath(dama5Root, rel);
      
      if (!fp) {
        res.statusCode = 404;
        res.end("Corpus file not found in raw folders");
        return;
      }
      
      fs.readFile(fp, (err, buf) => {
        if (err) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(buf);
      });
      return;
    }

    if (raw.startsWith("/dama-aud/")) {
      const name = decodeURIComponent(
        raw.slice("/dama-aud/".length).split("/")[0] ?? "",
      );
      if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
        next();
        return;
      }
      
      const fp = findAudioFile(dama5Root, name);
      if (!fp) {
        next();
        return;
      }
      
      const lower = name.toLowerCase();
      let mime = "audio/mpeg";
      if (lower.endsWith(".webm") || lower.endsWith(".weba")) mime = "audio/webm";
      else if (lower.endsWith(".mp4") || lower.endsWith(".m4a") || lower.endsWith(".aac")) mime = "video/mp4";
      else if (lower.endsWith(".opus")) mime = "audio/opus";
      else if (lower.endsWith(".png")) mime = "image/png";
      else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) mime = "image/jpeg";
      else if (lower.endsWith(".webp")) mime = "image/webp";
      else if (lower.endsWith(".gif")) mime = "image/gif";
            
      fs.stat(fp, (e, st) => {
        if (e || !st.isFile()) {
          next();
          return;
        }

        const range = req.headers.range;
        if (range) {
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : st.size - 1;
          const chunksize = (end - start) + 1;
          const file = fs.createReadStream(fp, {start, end});
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${st.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': mime,
          });
          file.pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Length': st.size,
            'Content-Type': mime,
          });
          fs.createReadStream(fp).pipe(res);
        }
      });
      return;
    }

    if (raw.startsWith("/panels/")) {
      const name = decodeURIComponent(
        raw.slice("/panels/".length).split("/")[0] ?? "",
      );
      if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
        next();
        return;
      }
      
      const fp = resolveRawPanelPath(dama5Root, name);
      if (!fp) {
        next();
        return;
      }
      
      const lower = name.toLowerCase();
      let mime = "image/jpeg";
      if (lower.endsWith(".png")) mime = "image/png";
      else if (lower.endsWith(".webp")) mime = "image/webp";
      else if (lower.endsWith(".gif")) mime = "image/gif";
      else if (lower.endsWith(".mp4")) mime = "video/mp4";
      
      fs.stat(fp, (e, st) => {
        if (e || !st.isFile()) {
          next();
          return;
        }
        res.setHeader("Content-Type", mime);
        res.setHeader("Content-Length", st.size);
        fs.createReadStream(fp).pipe(res);
      });
      return;
    }

    next();
  };
}
