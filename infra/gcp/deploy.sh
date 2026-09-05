#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REGION="${GCP_REGION:-asia-south1}"
INSTANCE="${GCP_SQL_INSTANCE:-tectrack-uat}"
SERVICE="${GCP_RUN_SERVICE:-tectrack-uat}"
REPO="${GCP_AR_REPO:-tectrack}"
SA_NAME="${GCP_SA_NAME:-tectrack-uat}"
DB_NAME="${GCP_DB_NAME:-tectrack}"
DB_USER="${GCP_DB_USER:-postgres}"
SECRET_DB="${GCP_SECRET_DB:-tectrack-db-password}"
SECRET_SESSION="${GCP_SECRET_SESSION:-tectrack-session-secret}"
SECRET_SMTP="${GCP_SECRET_SMTP:-tectrack-smtp-pass}"
SECRET_JOBS="${GCP_SECRET_JOBS:-tectrack-jobs-secret}"

need() { command -v "$1" >/dev/null || { echo "Missing $1" >&2; exit 1; }; }
need gcloud
need openssl

ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -1 || true)"
if [[ -z "${ACCOUNT}" ]]; then
  echo "Not signed in. Run: gcloud auth login" >&2
  exit 1
fi

PROJECT="${GCP_PROJECT:-$(gcloud config get-value project 2>/dev/null || true)}"
if [[ -z "${PROJECT}" || "${PROJECT}" == "(unset)" ]]; then
  echo "No GCP project set. Run: gcloud config set project YOUR_PROJECT_ID" >&2
  echo "Existing projects:" >&2
  gcloud projects list --format='table(projectId,name)' >&2 || true
  exit 1
fi

gcloud config set project "${PROJECT}" >/dev/null
BUCKET="${GCP_BUCKET:-${PROJECT}-tectrack-uat-uploads}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/app:uat"
SQL_CONN="${PROJECT}:${REGION}:${INSTANCE}"
SA_EMAIL="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"

echo "Project  ${PROJECT}"
echo "Account  ${ACCOUNT}"
echo "Region   ${REGION}"
echo "Image    ${IMAGE}"

echo "Enabling APIs…"
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  storage.googleapis.com \
  cloudbuild.googleapis.com \
  iam.googleapis.com \
  cloudscheduler.googleapis.com \
  --project "${PROJECT}"

if ! gcloud artifacts repositories describe "${REPO}" --location="${REGION}" --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Creating Artifact Registry ${REPO}…"
  gcloud artifacts repositories create "${REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Urb TecTrack UAT" \
    --project="${PROJECT}"
fi

if ! gcloud sql instances describe "${INSTANCE}" --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Creating Cloud SQL ${INSTANCE} (several minutes)…"
  gcloud sql instances create "${INSTANCE}" \
    --database-version=POSTGRES_16 \
    --edition=enterprise \
    --tier=db-f1-micro \
    --region="${REGION}" \
    --storage-size=10 \
    --storage-type=SSD \
    --availability-type=ZONAL \
    --no-backup \
    --project="${PROJECT}"
fi

if ! gcloud sql databases describe "${DB_NAME}" --instance="${INSTANCE}" --project="${PROJECT}" >/dev/null 2>&1; then
  gcloud sql databases create "${DB_NAME}" --instance="${INSTANCE}" --project="${PROJECT}"
fi

ensure_secret() {
  local name="$1"
  if gcloud secrets describe "${name}" --project="${PROJECT}" >/dev/null 2>&1; then
    gcloud secrets versions access latest --secret="${name}" --project="${PROJECT}"
    return
  fi
  local value
  value="$(openssl rand -base64 32 | tr -d '\n')"
  printf '%s' "${value}" | gcloud secrets create "${name}" --data-file=- --project="${PROJECT}" >/dev/null
  printf '%s' "${value}"
}

DB_PASSWORD="$(ensure_secret "${SECRET_DB}")"
SESSION_SECRET="$(ensure_secret "${SECRET_SESSION}")"
JOBS_SECRET="$(ensure_secret "${SECRET_JOBS}")"

# SMTP app password must already exist (do not auto-generate).
if ! gcloud secrets describe "${SECRET_SMTP}" --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Missing Secret Manager secret ${SECRET_SMTP}." >&2
  echo "Create it with the noreply@urbeno.in Gmail app password:" >&2
  echo "  printf '%s' 'YOUR_APP_PASSWORD' | gcloud secrets create ${SECRET_SMTP} --data-file=- --project=${PROJECT}" >&2
  exit 1
fi

gcloud sql users set-password "${DB_USER}" \
  --instance="${INSTANCE}" \
  --password="${DB_PASSWORD}" \
  --project="${PROJECT}"

if ! gcloud storage buckets describe "gs://${BUCKET}" >/dev/null 2>&1; then
  echo "Creating bucket gs://${BUCKET}…"
  gcloud storage buckets create "gs://${BUCKET}" \
    --location="${REGION}" \
    --uniform-bucket-level-access \
    --public-access-prevention \
    --project="${PROJECT}"
fi

if ! gcloud iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${SA_NAME}" \
    --display-name="Urb TecTrack UAT" \
    --project="${PROJECT}"
fi

gcloud projects add-iam-policy-binding "${PROJECT}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.client" \
  --condition=None >/dev/null
gcloud projects add-iam-policy-binding "${PROJECT}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None >/dev/null
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin" >/dev/null

echo "Building and pushing image with Docker…"
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
docker build -t "${IMAGE}" "${ROOT}"
docker push "${IMAGE}"

echo "Deploying Cloud Run ${SERVICE}…"
gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --project "${PROJECT}" \
  --platform managed \
  --allow-unauthenticated \
  --service-account "${SA_EMAIL}" \
  --add-cloudsql-instances "${SQL_CONN}" \
  --port 8080 \
  --cpu 1 \
  --memory 1Gi \
  --timeout 300 \
  --min-instances 1 \
  --max-instances 2 \
  --cpu-boost \
  --set-secrets "DATABASE_PASSWORD=${SECRET_DB}:latest,SESSION_SECRET=${SECRET_SESSION}:latest,SMTP_PASS=${SECRET_SMTP}:latest,JOBS_SECRET=${SECRET_JOBS}:latest" \
  --set-env-vars "NODE_ENV=uat,UAT_SEED=true,API_HOST=0.0.0.0,WEB_DIST=/app/apps/web/dist,COOKIE_SECURE=true,ENABLE_JOBS=true,EMAIL_PROVIDER=smtp,SMTP_HOST=smtp.gmail.com,SMTP_PORT=587,SMTP_SECURE=false,SMTP_USER=noreply@urbeno.in,SMTP_FROM_NAME=Urb TecTrack,SMTP_FROM_EMAIL=noreply@urbeno.in,URBENO_EMAIL=info@urbeno.in,DATABASE_USER=${DB_USER},DATABASE_NAME=${DB_NAME},CLOUD_SQL_CONNECTION_NAME=${SQL_CONN},GCS_BUCKET=${BUCKET}" \
  --quiet

URL="$(gcloud run services describe "${SERVICE}" --region="${REGION}" --project="${PROJECT}" --format='value(status.url)')"
gcloud run services update "${SERVICE}" \
  --region "${REGION}" \
  --project "${PROJECT}" \
  --update-env-vars "PORTAL_URL=${URL},CORS_ORIGIN=${URL}" \
  --quiet

echo
echo "UAT URL  ${URL}"
echo "Login    admin@urbeno.in / demo"
