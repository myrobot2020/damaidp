# GCP: GitHub → Cloud Build → Cloud Run



Repo files: `deploy/Dockerfile`, `deploy/cloudbuild.yaml`. Builds use **`CI_GCP=1`** so Vite skips Cloudflare and emits Nitro **node-server** output under `.output/` (not committed).



Project: **`damalight`**. GitHub connection **`dama-github`** stays in **`us-central1`** (where triggers run). Artifact Registry **`dama-mob`** and **Cloud Run** **`dama-mob`** use **`asia-south1`** (Mumbai, South Asia).



## One-time (already done via CLI where possible)



- APIs enabled for Cloud Build, Run, Artifact Registry, Secret Manager.

- Cloud Build P4SA granted Secret Manager access; default Cloud Build SA granted **Run Admin**, **Artifact Registry Writer**, **Service Account User** so `deploy/cloudbuild.yaml` can push images and deploy Cloud Run.



## Finish GitHub link (you must do this in a browser)



The connection **`dama-github`** is waiting on **OAuth**:



```bash

gcloud config set project damalight

gcloud builds connections describe dama-github --region=us-central1 --format="yaml(installationState)"

```



Open **`installationState.actionUri`** in your browser. Sign in to GitHub as needed and authorize. When asked, **install the Google Cloud Build GitHub App** on **`myrobot2020/dama-mob`** (all repos or only that repo). Wait until **`installationState.stage`** is **`COMPLETE`** (check with the same `describe` command).



## Register the repo + trigger (after OAuth is COMPLETE)



From repo root:



```powershell

powershell -ExecutionPolicy Bypass -File deploy/complete-github-trigger.ps1

```



Or manually:



```bash

gcloud builds repositories create dama-mob \

  --connection=dama-github --region=us-central1 \

  --remote-uri=https://github.com/myrobot2020/dama-mob.git



gcloud builds triggers create github \

  --name=main-push \

  --repository="projects/damalight/locations/us-central1/connections/dama-github/repositories/dama-mob" \

  --branch-pattern="^main$" \

  --build-config="deploy/cloudbuild.yaml" \

  --region=us-central1 \

  --service-account="projects/damalight/serviceAccounts/PROJECT_NUMBER-compute@developer.gserviceaccount.com"

```

(`PROJECT_NUMBER`: `gcloud projects describe damalight --format='value(projectNumber)'`. Use the **Compute default** service account so manual runs and deploy steps are accepted.)



## Teacher MP3s (GCS)

See **`deploy/GCS_AUD.md`**: bucket **`gs://damalight-dama-aud`**, public URLs under **`VITE_DAMA_AUD_PUBLIC_BASE`**, synced from local **`aud/`**.

## Runtime + build-time config

Cloud Build injects browser-public Vite values during `npm run build`:

- `VITE_DAMA_AUD_PUBLIC_BASE`
- `VITE_DAMA_CORPUS_GCS_BASE`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The OpenAI key is not committed or passed as a build arg. It lives in Secret Manager as
`dama-openai-api-key` and is mounted on Cloud Run as `OPENAI_API_KEY`; `OPENAI_REFLECTION_MODEL`
is a normal runtime env var.

Run `deploy/complete-github-trigger.ps1` after changing trigger setup. It repairs the trigger path
to `deploy/cloudbuild.yaml` and syncs Supabase substitutions from environment variables or
`.env.local`.

## After push to `main`

Pushes to **`main`** on **`myrobot2020/dama-mob`** run **`deploy/cloudbuild.yaml`**: install → tests → **`CI_GCP=1` build** with GCS + Supabase public config → Docker → Artifact Registry → **`gcloud run deploy`** service **`dama-mob`** in **`asia-south1`** with the OpenAI runtime secret.


