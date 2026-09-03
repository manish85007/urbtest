#!/usr/bin/env bash
# Place a Global External Application Load Balancer in front of Cloud Run UAT
# and blank the GFE-injected Server header via a custom response header policy.
#
# Usage:
#   gcloud auth login
#   gcloud config set project YOUR_PROJECT_ID
#   ./infra/gcp/setup-lb.sh
#
# Requires a DNS A record for GCP_LB_DOMAIN → the reserved LB IP (printed at end).
# Google-managed cert becomes ACTIVE only after DNS propagates.
set -euo pipefail

REGION="${GCP_REGION:-asia-south1}"
SERVICE="${GCP_RUN_SERVICE:-tectrack-uat}"
DOMAIN="${GCP_LB_DOMAIN:-tectrack-uat.urbeno.in}"
PREFIX="${GCP_LB_PREFIX:-tectrack-uat}"

NEG="${PREFIX}-neg"
BACKEND="${PREFIX}-backend"
URLMAP="${PREFIX}-urlmap"
HTTP_REDIRECT="${PREFIX}-http-redirect"
CERT="${PREFIX}-cert"
HTTPS_PROXY="${PREFIX}-https-proxy"
HTTP_PROXY="${PREFIX}-http-proxy"
IP_NAME="${PREFIX}-ip"
HTTPS_FW="${PREFIX}-https-fw"
HTTP_FW="${PREFIX}-http-fw"

need() { command -v "$1" >/dev/null || { echo "Missing $1" >&2; exit 1; }; }
need gcloud

ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -1 || true)"
if [[ -z "${ACCOUNT}" ]]; then
  echo "Not signed in. Run: gcloud auth login" >&2
  exit 1
fi

PROJECT="${GCP_PROJECT:-$(gcloud config get-value project 2>/dev/null || true)}"
if [[ -z "${PROJECT}" || "${PROJECT}" == "(unset)" ]]; then
  echo "No GCP project set. Run: gcloud config set project YOUR_PROJECT_ID" >&2
  exit 1
fi

gcloud config set project "${PROJECT}" >/dev/null

echo "Project  ${PROJECT}"
echo "Service  ${SERVICE} (${REGION})"
echo "Domain   ${DOMAIN}"
echo

echo "Enabling compute + certificatemanager APIs…"
gcloud services enable \
  compute.googleapis.com \
  certificatemanager.googleapis.com \
  --project "${PROJECT}"

# --- Static IP ----------------------------------------------------------------
if ! gcloud compute addresses describe "${IP_NAME}" --global --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Reserving global IP ${IP_NAME}…"
  gcloud compute addresses create "${IP_NAME}" \
    --network-tier=PREMIUM \
    --ip-version=IPV4 \
    --global \
    --project="${PROJECT}"
fi
LB_IP="$(gcloud compute addresses describe "${IP_NAME}" --global --project="${PROJECT}" --format='value(address)')"
echo "LB IP    ${LB_IP}"

# --- Managed SSL cert ---------------------------------------------------------
if ! gcloud compute ssl-certificates describe "${CERT}" --global --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Creating Google-managed cert ${CERT} for ${DOMAIN}…"
  gcloud compute ssl-certificates create "${CERT}" \
    --domains="${DOMAIN}" \
    --global \
    --project="${PROJECT}"
fi

# --- Serverless NEG -----------------------------------------------------------
if ! gcloud compute network-endpoint-groups describe "${NEG}" --region="${REGION}" --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Creating serverless NEG ${NEG}…"
  gcloud compute network-endpoint-groups create "${NEG}" \
    --region="${REGION}" \
    --network-endpoint-type=serverless \
    --cloud-run-service="${SERVICE}" \
    --project="${PROJECT}"
fi

# --- Backend service (blank Server header) ------------------------------------
if ! gcloud compute backend-services describe "${BACKEND}" --global --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Creating backend service ${BACKEND}…"
  gcloud compute backend-services create "${BACKEND}" \
    --load-balancing-scheme=EXTERNAL_MANAGED \
    --global \
    --project="${PROJECT}" \
    --custom-response-header='Server:'
else
  echo "Updating backend service custom response header (blank Server)…"
  gcloud compute backend-services update "${BACKEND}" \
    --global \
    --project="${PROJECT}" \
    --custom-response-header='Server:'
fi

# Attach NEG if not already present
EXISTING_BACKENDS="$(gcloud compute backend-services describe "${BACKEND}" --global --project="${PROJECT}" --format='value(backends[].group)' 2>/dev/null || true)"
if [[ "${EXISTING_BACKENDS}" != *"/networkEndpointGroups/${NEG}"* ]]; then
  echo "Attaching NEG to backend…"
  gcloud compute backend-services add-backend "${BACKEND}" \
    --global \
    --network-endpoint-group="${NEG}" \
    --network-endpoint-group-region="${REGION}" \
    --project="${PROJECT}"
fi

# --- URL maps + proxies + forwarding rules ------------------------------------
if ! gcloud compute url-maps describe "${URLMAP}" --global --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Creating URL map ${URLMAP}…"
  gcloud compute url-maps create "${URLMAP}" \
    --default-service="${BACKEND}" \
    --global \
    --project="${PROJECT}"
fi

if ! gcloud compute target-https-proxies describe "${HTTPS_PROXY}" --global --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Creating HTTPS proxy…"
  gcloud compute target-https-proxies create "${HTTPS_PROXY}" \
    --ssl-certificates="${CERT}" \
    --url-map="${URLMAP}" \
    --global \
    --project="${PROJECT}"
fi

if ! gcloud compute forwarding-rules describe "${HTTPS_FW}" --global --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Creating HTTPS forwarding rule…"
  gcloud compute forwarding-rules create "${HTTPS_FW}" \
    --load-balancing-scheme=EXTERNAL_MANAGED \
    --network-tier=PREMIUM \
    --address="${IP_NAME}" \
    --target-https-proxy="${HTTPS_PROXY}" \
    --global \
    --ports=443 \
    --project="${PROJECT}"
fi

# HTTP → HTTPS redirect
if ! gcloud compute url-maps describe "${HTTP_REDIRECT}" --global --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Creating HTTP→HTTPS redirect map…"
  gcloud compute url-maps import "${HTTP_REDIRECT}" \
    --global \
    --project="${PROJECT}" \
    --source=/dev/stdin <<EOF
name: ${HTTP_REDIRECT}
defaultUrlRedirect:
  httpsRedirect: true
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
EOF
fi

if ! gcloud compute target-http-proxies describe "${HTTP_PROXY}" --global --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Creating HTTP proxy…"
  gcloud compute target-http-proxies create "${HTTP_PROXY}" \
    --url-map="${HTTP_REDIRECT}" \
    --global \
    --project="${PROJECT}"
fi

if ! gcloud compute forwarding-rules describe "${HTTP_FW}" --global --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Creating HTTP forwarding rule…"
  gcloud compute forwarding-rules create "${HTTP_FW}" \
    --load-balancing-scheme=EXTERNAL_MANAGED \
    --network-tier=PREMIUM \
    --address="${IP_NAME}" \
    --target-http-proxy="${HTTP_PROXY}" \
    --global \
    --ports=80 \
    --project="${PROJECT}"
fi

CERT_STATUS="$(gcloud compute ssl-certificates describe "${CERT}" --global --project="${PROJECT}" --format='value(managed.status)' 2>/dev/null || echo UNKNOWN)"

echo
echo "────────────────────────────────────────────────────────────"
echo "Load balancer provisioned."
echo
echo "  IP       ${LB_IP}"
echo "  Domain   ${DOMAIN}"
echo "  Cert     ${CERT_STATUS}"
echo "  Header   Server:  (blanked via backend custom response header)"
echo
echo "DNS required (one-time):"
echo "  Create an A record:  ${DOMAIN}  →  ${LB_IP}"
echo
if [[ "${CERT_STATUS}" != "ACTIVE" ]]; then
  echo "Cert is not ACTIVE yet. After DNS propagates, wait a few minutes, then:"
  echo "  gcloud compute ssl-certificates describe ${CERT} --global --format='value(managed.status)'"
  echo
  echo "When ACTIVE, point the app at the LB hostname:"
  echo "  gcloud run services update ${SERVICE} --region=${REGION} \\"
  echo "    --update-env-vars=PORTAL_URL=https://${DOMAIN},CORS_ORIGIN=https://${DOMAIN}"
  echo
  echo "Optional — block direct *.run.app access (forces traffic via LB):"
  echo "  gcloud run services update ${SERVICE} --region=${REGION} \\"
  echo "    --ingress=internal-and-cloud-load-balancing"
else
  echo "Cert ACTIVE — updating Cloud Run PORTAL_URL / CORS_ORIGIN…"
  gcloud run services update "${SERVICE}" \
    --region="${REGION}" \
    --project="${PROJECT}" \
    --update-env-vars="PORTAL_URL=https://${DOMAIN},CORS_ORIGIN=https://${DOMAIN}" \
    --quiet
  echo
  echo "UAT URL  https://${DOMAIN}"
  echo
  echo "Verify Server header is gone:"
  echo "  curl -sSI https://${DOMAIN}/ | grep -i ^server || echo '(no Server header)'"
fi
echo "────────────────────────────────────────────────────────────"
