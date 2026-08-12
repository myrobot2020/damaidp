# dama-mob

Mobile-focused web app + corpus data pipeline for the Pāḷi Canon.

## Quick Start

```bash
npm install
python -m uv sync
npm run dev
```

App runs at `http://localhost:8080` (Vite/TanStack setup).

## Supabase (Auth + Progress Sync)

The app supports email/password auth, username onboarding, and syncing progress to Supabase.

1. Create a Supabase project and enable Email auth.
2. Add to `.env.local` (see `.env.example`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. In Supabase, add these redirect URLs:
   - `http://localhost:8080/auth/callback`
   - `http://localhost:8080/update-password`
4. Apply `docs/supabase-schema.sql` (profiles + reading + audio + optional UX events).

## Main Commands

```bash
npm run build
npm run test
npm run verify
```

`npm run verify` runs:

1. frontend build
2. pipeline tally check (`scripts2/pipeline.py --from-stage tally --to-stage tally`)

## Pipeline (scripts2)

The pipeline manages data validation and syncing to GCS for the Nikāya corpus (**AN, SN, DN, MN, KN**).

- **GCS Buckets:** 
      - JSON: `gs://damalight-dama-json` (CORS: `*`)
  - Audio: `gs://damalight-dama-aud`
- **Validation**: `scripts2/12_validate.py` (promotes suttas to `valid: true`).
- **Sync**: `scripts2/sync_gcs.py` (uploads `data/validated-json` to `gs://damalight-dama-json/nikaya/`).
- **Index Generation**: `scripts2/generate_index.py` (crawls GCS to create the global `index.json`).
- **Tally Check**: `npm run pipe2:tally` (verifies files on GCS).

Run full pipeline (local):

```bash
npm run pipe2
```

## Corpus Data Fetching

The app fetches JSON data and audio directly from Google Cloud Storage.

- **JSON Base**: `VITE_DAMA_CORPUS_GCS_BASE` (e.g., `https://storage.googleapis.com/damalight-dama-json`)
- **Audio Base**: `VITE_DAMA_AUD_PUBLIC_BASE` (e.g., `https://storage.googleapis.com/damalight-dama-aud`)
- **Path Convention**: `/nikaya/{nikaya}/{nikaya}{book}/suttas/{id}.json`

## Deploy

Deployed to **Google Cloud Run** via **Cloud Build** (CI/CD triggered on push to `main`).

- **Service Name**: `dama-mob`
- **Region**: `asia-south1`
- **Configs**: `deploy/cloudbuild.yaml`, `deploy/Dockerfile`

## Production Link

**[https://dama-mob-394934218986.asia-south1.run.app](https://dama-mob-394934218986.asia-south1.run.app)**

## Tree + MCQ (Leaf System)

This repo now includes a lightweight “leaf” progress loop:

- `Sutta page` → tap the Tree icon (top right) → `Tree page`
- `Tree page` → tap a **grey** leaf → full-screen `Quiz`
- First quiz submit always creates a **green** leaf (no right/wrong).
- After time, green leaves decay to **yellow** (review).
- In yellow review mode, choosing the teacher-aligned option turns the leaf **gold** (fixed).

Progress is stored in localStorage under `dama:leaves`.

### Rehosting notes

- Corpus JSON must include the quiz sutta(s) under `data/validated-json/` (or be available via `VITE_DAMA_CORPUS_GCS_BASE`).
- Teacher audio must be accessible either:
  - locally via `/dama-aud/*` (see `vite.config.ts` `audRoot` resolution), or
  - publicly via `VITE_DAMA_AUD_PUBLIC_BASE` (GCS bucket base URL).
- When deploying with GCS corpus: after adding/validating new JSON, run `scripts2/sync_gcs.py` and regenerate the global `index.json` (see `scripts2/generate_index.py`).
