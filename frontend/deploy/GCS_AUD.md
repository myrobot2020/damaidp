# Teacher audio on Google Cloud Storage

Corpus JSON references MP3s by filename (`aud_file`). Vite exposes **`VITE_DAMA_AUD_PUBLIC_BASE`** to the client at **dev and build** time. When set, the app requests:

`{VITE_DAMA_AUD_PUBLIC_BASE}/{encodeURIComponent(filename)}`

Example: `https://storage.googleapis.com/damalight-dama-aud/097_Anguttara%20Nikaya%20Book%2011%20116%20-%201116%20by%20Bhante%20Hye%20Dhammavuddho%20Mahathera.mp3`

Cloud Build sets this via substitution **`_VITE_DAMA_AUD_PUBLIC_BASE`** in `cloudbuild.yaml` (default: `https://storage.googleapis.com/damalight-dama-aud`).

## Test GCS from the local app (fewer deploy iterations)

1. Copy **`.env.example`** → **`.env.local`** (gitignored).
2. Add **`VITE_DAMA_AUD_PUBLIC_BASE=https://storage.googleapis.com/damalight-dama-aud`** (uncomment / paste).
3. Restart **`npm run dev`** — teacher audio loads from the bucket in the browser, same URLs as production after upload (`gcloud storage rsync` / `cp`).
4. Comment out that line and restart dev to switch back to **`/dama-aud/`** + local **`aud/`**.

No Cloud Build needed to verify object names, `NoSuchKey`, or playback against public GCS.

From repo root:

```bash
npm run verify:gcs-audio
```

Reads **`VITE_DAMA_AUD_PUBLIC_BASE`** from **`.env.local`** and **`HEAD`**-checks two sample MP3s (`097_…`, `005_…`).

## One-time: bucket + public read

Project **`damalight`**, location **`asia-south1`** (same region family as Cloud Run):

```bash
gcloud config set project damalight

gcloud storage buckets create gs://damalight-dama-aud \
  --location=asia-south1 \
  --uniform-bucket-level-access

gcloud storage buckets add-iam-policy-binding gs://damalight-dama-aud \
  --member=allUsers \
  --role=roles/storage.objectViewer
```

If the bucket already exists, skip `buckets create`. Public read lets the browser load `<audio src="https://storage.googleapis.com/...">` without signing URLs.

## Upload files

Object names must match **`aud_file`** in each sutta JSON (spaces and punctuation included).

From the machine that has your `aud/` folder:

```bash
gcloud storage cp -r "aud/*.mp3" gs://damalight-dama-aud/
```

Or sync (adds/updates; does not delete remote objects you removed locally unless you use rsync with delete):

```bash
gcloud storage rsync "c:/Users/ADMIN/Desktop/mob app/aud" gs://damalight-dama-aud --recursive
```

PowerShell:

```powershell
gcloud storage rsync "C:\Users\ADMIN\Desktop\mob app\aud" gs://damalight-dama-aud --recursive
```

## Disable GCS for a build

In the Cloud Build trigger, override substitution **`_VITE_DAMA_AUD_PUBLIC_BASE`** to empty so the app falls back to **`/dama-aud/`** on the Cloud Run container (only if those files exist in the image).

## CORS

Usually not required for `<audio>` playback from `storage.googleapis.com`. If a browser blocks Range requests, add a CORS JSON and apply with `gcloud storage buckets update gs://damalight-dama-aud --cors-file=cors.json`.
