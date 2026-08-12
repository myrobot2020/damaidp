/**
 * Smoke check: Supabase env vars exist locally so /login can load the form.
 * Does not call the network. Usage: node scripts/smoke-auth.mjs
 * Optional: SKIP_SMOKE_AUTH=1 to exit 0 (e.g. CI without secrets).
 */
if (process.env.SKIP_SMOKE_AUTH === "1") {
  console.log("Smoke auth: skipped (SKIP_SMOKE_AUTH=1).");
  process.exit(0);
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
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

const localPath = path.join(root, ".env.local");
const envPath = path.join(root, ".env");
const fromLocal = parseEnvFile(localPath);
const fromEnv = parseEnvFile(envPath);
const merged = { ...fromEnv, ...fromLocal };

const url = merged.VITE_SUPABASE_URL?.trim();
const anon =
  merged.VITE_SUPABASE_ANON_KEY?.trim() || merged.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

const placeholder =
  url &&
  !url.includes("YOUR_PROJECT") &&
  anon &&
  !anon.includes("your_anon");

if (!url || !anon || !placeholder) {
  console.error("");
  console.error("Smoke auth: missing or placeholder Supabase env vars.");
  console.error("");
  console.error("  Create or edit:", localPath);
  console.error("  (optional fallback:", envPath + ")");
  console.error("");
  console.error("  Required:");
  console.error("    VITE_SUPABASE_URL=https://<ref>.supabase.co");
  console.error("    VITE_SUPABASE_ANON_KEY=<anon or publishable key from Supabase → Project Settings → API>");
  console.error("");
  console.error("  Then restart: npm run dev");
  console.error("");
  process.exit(1);
}

console.log("Smoke auth: VITE_SUPABASE_URL and anon/publishable key look set.");
console.log("           Open /login after npm run dev (e.g. http://localhost:8080/login).");
process.exit(0);
