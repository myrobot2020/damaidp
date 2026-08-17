# ==============================================================================
# Terraform Main Infrastructure Definition for GCP
# Infrastructure Components:
# 1. GCS Bucket (Data downloads and matrix artifacts storage)
# 2. Secret Manager Secret (Gemini API Key management)
# 3. IAM Service Account & Role Bindings
# ==============================================================================

# 1. Google Cloud Storage Bucket for pipeline artifacts & downloads
resource "google_storage_bucket" "artifacts_bucket" {
  name                        = "${var.gcp_project_id}-${var.artifacts_bucket_name}-${var.environment}"
  location                    = var.gcp_region
  force_destroy               = false
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }
}

# 2. Secret Manager Secret for Gemini API Key
resource "google_secret_manager_secret" "gemini_api_key" {
  secret_id = "gemini-api-key"

  replication {
    auto {}
  }
}

# 3. Service Account for Cloud Run Pipeline Deployment
resource "google_service_account" "pipeline_sa" {
  account_id   = "frontendopt-pipeline-sa"
  display_name = "Frontend Optimised Pipeline Service Account"
}

# IAM Role: Secret Access for Service Account
resource "google_secret_manager_secret_iam_member" "secret_access" {
  secret_id = google_secret_manager_secret.gemini_api_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.pipeline_sa.email}"
}

# IAM Role: GCS Storage Admin for Service Account
resource "google_storage_bucket_iam_member" "storage_access" {
  bucket = google_storage_bucket.artifacts_bucket.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.pipeline_sa.email}"
}
