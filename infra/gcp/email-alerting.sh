#!/usr/bin/env bash
# Cloud Monitoring alert for outgoing-mail outages (e.g. revoked Gmail app password).
# Alerts are sent by Google Cloud, so they still arrive when our own SMTP is down.
# Idempotent: re-running reuses the channel and updates the policy.
set -euo pipefail

PROJECT="${GCP_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
ALERT_EMAIL="${ALERT_EMAIL:-manish@urbeno.in}"
POLICY_NAME="Urb TecTrack - outgoing email failing"
CHANNEL_NAME="Urb TecTrack email alerts (${ALERT_EMAIL})"
API="https://monitoring.googleapis.com/v3/projects/${PROJECT}"

need() { command -v "$1" >/dev/null || { echo "Missing $1" >&2; exit 1; }; }
need gcloud
need curl
need python3

gcloud services enable monitoring.googleapis.com logging.googleapis.com --project "${PROJECT}"
TOKEN="$(gcloud auth print-access-token)"

call() {
  local method="$1" url="$2" body="${3:-}"
  local out
  out="$(curl -sS -X "${method}" "${url}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    ${body:+--data "${body}"})"
  if echo "${out}" | python3 -c 'import json,sys; sys.exit(0 if "error" in json.load(sys.stdin) else 1)' 2>/dev/null; then
    echo "Monitoring API error (${method} ${url}): ${out}" >&2
    exit 1
  fi
  printf '%s' "${out}"
}

find_name() {
  # stdin: list response; $1: collection key; $2: displayName
  python3 -c '
import json, sys
key, name = sys.argv[1], sys.argv[2]
for item in json.load(sys.stdin).get(key, []):
    if item.get("displayName") == name:
        print(item["name"]); break
' "$1" "$2"
}

CHANNEL="$(call GET "${API}/notificationChannels" | find_name notificationChannels "${CHANNEL_NAME}")"
if [[ -z "${CHANNEL}" ]]; then
  BODY="$(CHANNEL_NAME="${CHANNEL_NAME}" ALERT_EMAIL="${ALERT_EMAIL}" python3 -c '
import json, os
print(json.dumps({"type": "email", "displayName": os.environ["CHANNEL_NAME"],
                  "labels": {"email_address": os.environ["ALERT_EMAIL"]}}))')"
  CHANNEL="$(call POST "${API}/notificationChannels" "${BODY}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["name"])')"
  echo "Created notification channel ${CHANNEL} -> ${ALERT_EMAIL}"
fi

POLICY="$(CHANNEL="${CHANNEL}" POLICY_NAME="${POLICY_NAME}" python3 - <<'PY'
import json, os
print(json.dumps({
    "displayName": os.environ["POLICY_NAME"],
    "combiner": "OR",
    "notificationChannels": [os.environ["CHANNEL"]],
    "alertStrategy": {
        "notificationRateLimit": {"period": "3600s"},
        "autoClose": "86400s",
    },
    "conditions": [{
        "displayName": "SMTP login or delivery failing (tectrack-uat / tectrack-prod)",
        "conditionMatchedLog": {
            "filter": (
                'resource.type="cloud_run_revision" '
                'AND resource.labels.service_name=("tectrack-uat" OR "tectrack-prod") '
                'AND jsonPayload.alert="smtp_down"'
            ),
            "labelExtractors": {"service": "EXTRACT(resource.labels.service_name)"},
        },
    }],
    "documentation": {
        "mimeType": "text/markdown",
        "content": (
            "Urb TecTrack cannot send email: sign-in codes, password resets and notifications are not delivered.\n\n"
            "**If the error mentions 535 / BadCredentials** (Gmail app password revoked):\n"
            "1. Sign in as noreply@urbeno.in, ensure 2-Step Verification is on, create a new App Password.\n"
            "2. `printf '%s' 'NEW_APP_PASSWORD' | gcloud secrets versions add tectrack-smtp-pass --data-file=-`\n"
            "3. `gcloud run services update tectrack-uat --region asia-south1 --update-secrets SMTP_PASS=tectrack-smtp-pass:latest`\n"
            "4. `gcloud run services update tectrack-prod --region asia-south1 --update-secrets SMTP_PASS=tectrack-smtp-pass:latest`\n"
            "5. Super Admin -> Masters -> Email & Templates -> Outgoing mail -> Check now.\n"
        ),
    },
}))
PY
)"

EXISTING="$(call GET "${API}/alertPolicies" | find_name alertPolicies "${POLICY_NAME}")"
if [[ -n "${EXISTING}" ]]; then
  call PATCH "https://monitoring.googleapis.com/v3/${EXISTING}" "${POLICY}" >/dev/null
  echo "Updated alert policy ${EXISTING}"
else
  call POST "${API}/alertPolicies" "${POLICY}" >/dev/null
  echo "Created alert policy \"${POLICY_NAME}\" -> ${ALERT_EMAIL}"
fi
