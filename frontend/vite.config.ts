import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv, mergeConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";
import { damaCorpusFsPlugin } from "./config/vite/vite-plugin-dama-corpus-fs";
import { openaiReflectionDevMiddleware } from "./config/vite/vite-plugin-openai-reflection";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname);
/** When set (e.g. Cloud Build), skip Cloudflare adapter and emit a Node server via Nitro for Cloud Run. */
const ciGcp = process.env.CI_GCP === "1";
const validatedJsonDir = path.join(projectRoot, "data", "validated-json");
const legacyValidJsonDir = path.join(projectRoot, "valid json");
const parentDir = path.join(projectRoot, "..");
const hasParentNikaya = fs.existsSync(path.join(parentDir, "Anguttara Nikaya by Bhante Hye Dhammavuddho Mahathera"));

/** Corpus JSON root: env override, else parent folder if raw Nikayas present, else `data/validated-json/`, etc. */
const corpusRoot = process.env.VITE_DAMA5_ROOT
  ? path.resolve(process.env.VITE_DAMA5_ROOT)
  : hasParentNikaya
    ? parentDir
    : fs.existsSync(validatedJsonDir) && fs.statSync(validatedJsonDir).isDirectory()
      ? validatedJsonDir
      : fs.existsSync(legacyValidJsonDir) && fs.statSync(legacyValidJsonDir).isDirectory()
        ? legacyValidJsonDir
      : projectRoot;
/**
 * Teacher MP3 directory for `/dama-aud/*`. Override with `VITE_DAMA_AUD_ROOT`.
 * If `<corpusRoot>/aud` exists it wins; otherwise defaults to `<project>/aud` so JSON-only corpus folders still find audio.
 */
function resolveAudRoot(): string {
  const raw = process.env.VITE_DAMA_AUD_ROOT?.trim();
  if (raw) return path.resolve(raw);
  const underCorpus = path.join(corpusRoot, "aud");
  if (fs.existsSync(underCorpus) && fs.statSync(underCorpus).isDirectory()) {
    return underCorpus;
  }
  const projectAud = path.join(projectRoot, "aud");
  if (fs.existsSync(projectAud) && fs.statSync(projectAud).isDirectory()) {
    return projectAud;
  }
  const rawAnAudio = path.join(projectRoot, "data", "raw", "an", "audio");
  if (fs.existsSync(rawAnAudio) && fs.statSync(rawAnAudio).isDirectory()) {
    return rawAnAudio;
  }
  return projectAud;
}
const audRoot = resolveAudRoot();
const damaFs =
  fs.existsSync(corpusRoot) && fs.statSync(corpusRoot).isDirectory()
    ? damaCorpusFsPlugin(corpusRoot, audRoot)
    : null;

const fsAllowDirs = [projectRoot, corpusRoot];
if (!fsAllowDirs.some((p) => path.resolve(p) === path.resolve(audRoot))) {
  fsAllowDirs.push(audRoot);
}

function pipelineWorkApiPlugin() {
  const workRoot = path.join(projectRoot, "data", "work");

  const handleWorkApiRequest = (req: any, res: any) => {
    try {
      const url = new URL(req.url || "", "http://localhost");
      const rawPath = url.searchParams.get("p") || "";
      const normalizedPath = rawPath.replace(/\\/g, "/");
      const filePath = path.resolve(workRoot, normalizedPath);

      if (!filePath.startsWith(workRoot + path.sep)) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid proof path", p: rawPath }));
        return;
      }

      if (req.method === "PUT") {
        let body = "";
        req.setEncoding("utf8");
        req.on("data", (chunk: any) => {
          body += chunk;
        });
        req.on("end", () => {
          try {
            JSON.parse(body);
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, `${body.trim()}\n`, "utf8");
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, p: normalizedPath }));
          } catch (error) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
          }
        });
        return;
      }

      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Proof file not found", p: rawPath }));
        return;
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  };

  return {
    name: "dama-pipeline-work-api",
    configureServer(server: any) {
      server.middlewares.use("/work-api", handleWorkApiRequest);
    },
    configurePreviewServer(server: any) {
      server.middlewares.use("/work-api", handleWorkApiRequest);
    },
  };
}

function pipelineStatusApiPlugin() {
  const handleStatusRequest = (_req: any, res: any) => {
    try {
      const uvCommand = process.platform === "win32" ? "uv.exe" : "uv";
      const result = spawnSync(
        uvCommand,
        ["run", "python", "-m", "scripts2.streaming.status", "snapshot"],
        { cwd: projectRoot, encoding: "utf8", timeout: 5000 },
      );
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(result.stderr || result.stdout || "status snapshot failed");
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(result.stdout);
    } catch (error) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  };

  return {
    name: "dama-pipeline-status-api",
    configureServer(server: any) {
      server.middlewares.use("/pipeline-status-api", handleStatusRequest);
    },
    configurePreviewServer(server: any) {
      server.middlewares.use("/pipeline-status-api", handleStatusRequest);
    },
  };
}

function imageSelectorApiPlugin() {
  const panelsRoot = path.join(projectRoot, "public", "panels");
  const selectionsRoot = path.join(projectRoot, "data", "work", "streaming", "image_selections");

  const safeSelectionId = (suttaId: string) => suttaId.trim().replace(/\s+/g, "_").replace(/[^\w.-]/g, "_");
  const candidateTitle = (fileName: string) =>
    fileName
      .replace(/\.[^.]+$/, "")
      .split(/[-_]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const readJsonFile = (filePath: string) => {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  };

  const readSelections = () => {
    if (!fs.existsSync(selectionsRoot)) return {};
    const selections: Record<string, unknown> = {};
    for (const file of fs.readdirSync(selectionsRoot)) {
      if (!file.endsWith(".json")) continue;
      const selection = readJsonFile(path.join(selectionsRoot, file));
      if (selection?.sutta_id) selections[selection.sutta_id] = selection;
    }
    return selections;
  };

  const handleImageSelectorRequest = (req: any, res: any) => {
    try {
      if (req.method === "GET") {
        const candidates = fs.existsSync(panelsRoot)
          ? fs
              .readdirSync(panelsRoot)
              .filter((file) => /\.(png|jpe?g|webp)$/i.test(file))
              .sort()
              .map((file) => ({
                panelId: file.replace(/\.[^.]+$/, ""),
                imageUrl: `/panels/${file}`,
                localPath: `public/panels/${file}`,
                title: candidateTitle(file),
              }))
          : [];

        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ candidates, selections: readSelections() }));
        return;
      }

      if (req.method === "PUT") {
        let body = "";
        req.setEncoding("utf8");
        req.on("data", (chunk: any) => {
          body += chunk;
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            const suttaId = String(payload.sutta_id || "").trim();
            const panelId = String(payload.panel_id || "").trim();
            const imageUrl = String(payload.image_url || "").trim();
            if (!suttaId || !panelId || !imageUrl) {
              throw new Error("sutta_id, panel_id, and image_url are required");
            }

            fs.mkdirSync(selectionsRoot, { recursive: true });
            const selection = {
              sutta_id: suttaId,
              panel_id: panelId,
              image_url: imageUrl,
              status: "selected",
              selection_word: String(payload.selection_word || ""),
              selection_reason: String(payload.selection_reason || ""),
              exact_sutta_text: String(payload.exact_sutta_text || ""),
              selected_by: "pipeline-ui",
              created_at: new Date().toISOString(),
            };
            fs.writeFileSync(
              path.join(selectionsRoot, `${safeSelectionId(suttaId)}.json`),
              `${JSON.stringify(selection, null, 2)}\n`,
              "utf8",
            );

            const approval = spawnSync(
              process.platform === "win32" ? "python.exe" : "python",
              ["-m", "scripts2.streaming.approve_image_selection", "--sutta-id", suttaId],
              { cwd: projectRoot, encoding: "utf8" },
            );
            if (approval.status !== 0) {
              throw new Error((approval.stderr || approval.stdout || "image selection approval failed").trim());
            }

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, selection }));
          } catch (error) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
          }
        });
        return;
      }

      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Method not allowed" }));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  };

  return {
    name: "dama-image-selector-api",
    configureServer(server: any) {
      server.middlewares.use("/image-selector-api", handleImageSelectorRequest);
    },
    configurePreviewServer(server: any) {
      server.middlewares.use("/image-selector-api", handleImageSelectorRequest);
    },
  };
}

// Proxy /api to a local FastAPI backend (optional). Start it on port 8000 when using chat/reflect.
const damaProxy = {
  "/api": {
    target: "http://127.0.0.1:8000",
    changeOrigin: true,
  },
  // Fallback when middleware does not serve a file (optional FastAPI same paths).
  "/dama-aud": {
    target: "http://127.0.0.1:8000",
    changeOrigin: true,
    rewrite: (pathStr: string) => pathStr.replace(/^\/dama-aud/, "/aud"),
  },
} as const;

export default defineConfig(async (env) => {
  const { command, mode } = env;

  const envDefine: Record<string, string> = {};
  const loadedEnv = loadEnv(mode, process.cwd(), "VITE_");
  for (const [key, value] of Object.entries(loadedEnv)) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  const plugins = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    ...(command === "build" && !ciGcp
      ? await (async () => {
          try {
            const { cloudflare } = await import("@cloudflare/vite-plugin");
            return [
              cloudflare({
                viteEnvironment: { name: "ssr" },
              }),
            ];
          } catch {
            return [];
          }
        })()
      : []),
    tanstackStart({ srcDirectory: "src" }),
    viteReact(),
    pipelineStatusApiPlugin(),
    pipelineWorkApiPlugin(),
    imageSelectorApiPlugin(),
    openaiReflectionDevMiddleware(),
    ...(ciGcp
      ? [
          nitro({
            preset: "node-server",
            serverDir: path.resolve(__dirname, "server"),
          }),
        ]
      : []),
    ...(damaFs ? [damaFs] : []),
  ];

  const base = mergeConfig(
    {
      define: envDefine,
      resolve: {
        alias: {
          "@": path.join(process.cwd(), "src"),
        },
        dedupe: [
          "react",
          "react-dom",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
          "@tanstack/react-query",
          "@tanstack/query-core",
        ],
      },
      plugins,
      server: {
        host: "0.0.0.0",
        port: 8080,
        fs: {
          allow: fsAllowDirs,
        },
        proxy: { ...damaProxy },
      },
      preview: {
        fs: {
          allow: fsAllowDirs,
        },
        proxy: { ...damaProxy },
      },
    },
    {},
  );

  return mergeConfig(base, {
    server: {
      watch: {
        awaitWriteFinish: {
          stabilityThreshold: 1000,
          pollInterval: 100,
        },
      },
    },
  });
});
