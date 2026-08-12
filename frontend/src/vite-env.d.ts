/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Optional: publishable key if your project uses it instead of anon */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Optional: FastAPI/dama5 origin */
  readonly VITE_DAMA_API_URL?: string;
  /** Optional: public HTTPS base for teacher MP3s (e.g. `https://storage.googleapis.com/BUCKET`) */
  readonly VITE_DAMA_AUD_PUBLIC_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
