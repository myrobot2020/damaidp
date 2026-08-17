# ==============================================================================
# Terraform Input Variables Definition
# ==============================================================================

variable "gcp_project_id" {
  type        = string
  description = "The GCP Project ID where resources will be provisioned."
}

variable "gcp_region" {
  type        = string
  description = "Target GCP Region."
  default     = "us-central1"
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)."
  default     = "prod"
}

variable "artifacts_bucket_name" {
  type        = string
  description = "Base name for the GCS bucket storing downloads and matrix artifacts."
  default     = "buddha3-data-artifacts"
}
