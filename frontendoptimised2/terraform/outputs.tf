# ==============================================================================
# Terraform Outputs Definition
# ==============================================================================

output "gcs_artifacts_bucket_url" {
  description = "Google Cloud Storage bucket URL for pipeline artifacts."
  value       = google_storage_bucket.artifacts_bucket.url
}

output "secret_manager_gemini_key_id" {
  description = "GCP Secret Manager secret ID for Gemini API Key."
  value       = google_secret_manager_secret.gemini_api_key.secret_id
}

output "service_account_email" {
  description = "Dedicated Service Account email for pipeline automation."
  value       = google_service_account.pipeline_sa.email
}
