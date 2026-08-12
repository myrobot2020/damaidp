# Run AFTER GitHub OAuth + Cloud Build GitHub App install for connection `dama-github`.
# Regional GitHub triggers require an explicit service account (org policy / default SA).
$ErrorActionPreference = "Stop"

gcloud config set project damalight | Out-Null
gcloud config set builds/region us-central1 | Out-Null

$projNum = gcloud projects describe damalight --format="value(projectNumber)"
# User-managed SA required for regional triggers + manual runs (Cloud Build SA alone is rejected).
$cbSa = "projects/damalight/serviceAccounts/${projNum}-compute@developer.gserviceaccount.com"
$triggerName = "main-push"

$stage = gcloud builds connections describe dama-github --region=us-central1 `
  --format="value(installationState.stage)" 2>$null

if (-not $stage -or $stage -ne "COMPLETE") {
  Write-Host "GitHub connection is not COMPLETE yet (stage: $stage)."
  Write-Host "1) OAuth: open the URL from:"
  Write-Host '   gcloud builds connections describe dama-github --region=us-central1 --format="yaml(installationState)"'
  Write-Host "2) Install the Google Cloud Build GitHub App on repo myrobot2020/dama-mob when prompted."
  exit 1
}

$name = "dama-mob"
$uri = "https://github.com/myrobot2020/dama-mob.git"

$supabaseUrl = $env:VITE_SUPABASE_URL
$supabaseAnonKey = $env:VITE_SUPABASE_ANON_KEY
if ((-not $supabaseUrl -or -not $supabaseAnonKey) -and (Test-Path ".env.local")) {
  foreach ($line in Get-Content ".env.local") {
    $trim = $line.Trim()
    if (-not $trim -or $trim.StartsWith("#")) { continue }
    $idx = $trim.IndexOf("=")
    if ($idx -lt 1) { continue }
    $key = $trim.Substring(0, $idx).Trim()
    $value = $trim.Substring($idx + 1).Trim()
    if ($key -eq "VITE_SUPABASE_URL" -and -not $supabaseUrl) { $supabaseUrl = $value }
    if ($key -eq "VITE_SUPABASE_ANON_KEY" -and -not $supabaseAnonKey) { $supabaseAnonKey = $value }
  }
}

$repoExists = $false
$null = gcloud builds repositories describe $name --connection=dama-github --region=us-central1 --format="value(name)" 2>$null
if ($LASTEXITCODE -eq 0) { $repoExists = $true }
if (-not $repoExists) {
  gcloud builds repositories create $name --connection=dama-github --region=us-central1 `
    --remote-uri=$uri --quiet
}

$repoResource = "projects/damalight/locations/us-central1/connections/dama-github/repositories/$name"

$null = gcloud builds triggers describe $triggerName --region=us-central1 2>$null
if ($LASTEXITCODE -ne 0) {
  $createArgs = @(
    "builds", "triggers", "create", "github",
    "--name=$triggerName",
    "--repository=$repoResource",
    "--branch-pattern=^main$",
    "--build-config=deploy/cloudbuild.yaml",
    "--region=us-central1",
    "--service-account=$cbSa",
    "--quiet"
  )
  if ($supabaseUrl -and $supabaseAnonKey) {
    $createArgs += "--substitutions=_VITE_SUPABASE_URL=$supabaseUrl,_VITE_SUPABASE_ANON_KEY=$supabaseAnonKey"
  }
  gcloud @createArgs
} else {
  $trigger = gcloud builds triggers describe $triggerName --region=us-central1 --format="json" | ConvertFrom-Json
  $triggerId = $trigger.id
  $currentConfig = $trigger.filename
  $currentSupabaseUrl = $trigger.substitutions._VITE_SUPABASE_URL
  $currentSupabaseAnonKey = $trigger.substitutions._VITE_SUPABASE_ANON_KEY
  $needsUpdate =
    $currentConfig -ne "deploy/cloudbuild.yaml" -or
    ($supabaseUrl -and $currentSupabaseUrl -ne $supabaseUrl) -or
    ($supabaseAnonKey -and $currentSupabaseAnonKey -ne $supabaseAnonKey)

  if ($needsUpdate) {
    $cfg = @{
      name = $triggerName
      filename = "deploy/cloudbuild.yaml"
      repositoryEventConfig = @{
        repository = $repoResource
        repositoryType = "GITHUB"
        push = @{ branch = "^main$" }
      }
      serviceAccount = $cbSa
    }
    if ($supabaseUrl -and $supabaseAnonKey) {
      $cfg.substitutions = @{
        _VITE_SUPABASE_URL = $supabaseUrl
        _VITE_SUPABASE_ANON_KEY = $supabaseAnonKey
      }
    }

    $tmp = New-TemporaryFile
    try {
      $cfg | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $tmp.FullName

      gcloud builds triggers update github $triggerId `
        --trigger-config=$tmp.FullName `
        --region=us-central1 `
        --quiet
    } finally {
      Remove-Item -LiteralPath $tmp.FullName -Force -ErrorAction SilentlyContinue
    }
  }
}

Write-Host "Done. Trigger:"
gcloud builds triggers describe $triggerName --region=us-central1 --format="yaml(name,repositoryEventConfig,filename,substitutions)"
