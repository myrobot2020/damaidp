/**
 * Serve sutta JSON from a corpus root (`/__dama_corpus__/…`) and teacher MP3s at `/dama-aud/`.
 * JSON lives under `<corpusRoot>/anN/suttas/`; audio can use a separate `audRoot` (see vite.config).
 * Works in `vite dev` and `vite preview` — no FastAPI required for corpus + MP3.
 */
import type { Plugin } from "vite";
import { corpusFsMiddleware } from "./corpus-fs-serve";

export function damaCorpusFsPlugin(dama5Root: string, audRoot: string): Plugin {
  const mw = corpusFsMiddleware(dama5Root, audRoot);
  return {
    name: "dama-corpus-fs",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use(mw);
    },
    configurePreviewServer(server) {
      server.middlewares.use(mw);
    },
  };
}
