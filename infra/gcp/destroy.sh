#!/usr/bin/env bash
set -euo pipefail

REGION="${GCP_REGION:-asia-south1}"
INSTANCE="${GCP_SQL_INSTANCE:-tectrack-uat}"
SERVICE="${GCP_RUN_SERVICE:-tectrack-uat}"
REPO="${GCP_AR_REPO:-tectrack}"
SA_NAME="${GCP_SA_NAME:-tectrack-uat}"
SECRET_DB="${GCP_SECRET_DB:-tectrack-db-password}"
SECRET_SESSION="${GCP_SECRET_SESSION:-tectrack-session-secret}"
PROJECT="${GCP_PROJECT:-$(gcloud config get-value project 2>/dev/null || true)}"

if [[ -z "${PROJECT}" || "${PROJECT}" == "(unset)" ]]; then
  echo "No GCP project set." >&2
  exit 1
fi

BUCKET="${GCP_BUCKET:-${PROJECT}-tectrack-uat-uploads}"
SA_EMAIL="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"

gcloud run services delete "${SERVICE}" --region="${REGION}" --project="${PROJECT}" --quiet || true
gcloud sql instances delete "${INSTANCE}" --project="${PROJECT}" --quiet || true
gcloud storage rm -r "gs://${BUCKET}" || true
gcloud secrets delete "${SECRET_DB}" --project="${PROJECT}" --quiet || true
gcloud secrets delete "${SECRET_SESSION}" --project="${PROJECT}" --quiet || true
gcloud artifacts repositories delete "${REPO}" --location="${REGION}" --project="${PROJECT}" --quiet || true
gcloud iam service-accounts delete "${SA_EMAIL}" --project="${PROJECT}" --quiet || true

echo "Destroyed Urb TecTrack GCP UAT resources in ${PROJECT}."
