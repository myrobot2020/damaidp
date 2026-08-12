/**
 * Checks .env.local (or env) for VITE_DAMA_AUD_PUBLIC_BASE and HEAD-requests sample MP3 URLs.
 * Run: npm run verify:gcs-audio
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnvLocal() {
  const p = path.join(root, ".env.local");
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const envLocal = loadDotEnvLocal();
const base =
  (process.env.VITE_DAMA_AUD_PUBLIC_BASE || envLocal.VITE_DAMA_AUD_PUBLIC_BASE || "")
    .trim()
    .replace(/\/$/, "");

if (!base) {
  console.error("Missing VITE_DAMA_AUD_PUBLIC_BASE — set in .env.local or environment.");
  process.exit(1);
}

/** Same filenames as corpus JSON aud_file examples */
const samples = [
  "097_Anguttara Nikaya Book 11 116 - 1116 by Bhante Hye Dhammavuddho Mahathera.mp3",
  "005_Anguttara Nikaya Book 1D 1184 - 12148 by Bhante Hye Dhammavuddho Mahathera.mp3",
];

console.log("Base:", base);
let ok = true;
for (const name of samples) {
  const url = `${base}/${encodeURIComponent(name)}`;
  const res = await fetch(url, { method: "HEAD" });
  const ct = res.headers.get("content-type") || "";
  const okOne = res.ok && ct.includes("audio");
  console.log(okOne ? "OK" : "FAIL", res.status, ct.slice(0, 24), name.slice(0, 52) + "…");
  if (!okOne) ok = false;
}

process.exit(ok ? 0 : 1);
