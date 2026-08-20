#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://localhost:8080}"
JAR="/tmp/tt-cookies-$$.txt"
trap 'rm -f "$JAR"' EXIT

post_json() {
  curl -s -c "$JAR" -b "$JAR" -X POST "$BASE$1" -H 'Content-Type: application/json' -d "$2"
}
get_json() {
  curl -s -b "$JAR" "$BASE$1"
}

latest_email() {
  local key=$1
  post_json /auth/login '{"email":"admin@urbeno.in","password":"demo"}' >/dev/null
  get_json '/emails/outbox?limit=30' | node -e "
    const rows = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    const r = rows.find((x) => x.templateKey === process.argv[1]);
    if (!r) { console.log('MISSING:' + process.argv[1]); process.exit(1); }
    console.log(process.argv[1] + ' -> ' + r.to.join(', '));
  " "$key"
}

echo "Login admin"
post_json /auth/login '{"email":"admin@urbeno.in","password":"demo"}' >/dev/null

SITE_ID=$(get_json '/clients/TCPL/sites' | node -e "const s=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(s[0].id)")
TODAY=$(date +%Y-%m-%d)

echo "Create on-behalf request"
CREATE=$(post_json /submissions "{
  \"clientId\":\"TCPL\",
  \"siteId\":\"$SITE_ID\",
  \"requestDate\":\"$TODAY\",
  \"location\":\"Email test bay\",
  \"approxQty\":10,
  \"approxWeight\":50,
  \"items\":[{\"name\":\"Mixed e-waste\",\"qty\":10,\"weightKg\":50}],
  \"onBehalfOf\":\"ramesh@techcorp.in\"
}")
SUB_ID=$(echo "$CREATE" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).id)")
echo "Submission: $SUB_ID"

latest_email request_new_client
latest_email request_new_admin

echo "Acknowledge"
post_json "/submissions/$SUB_ID/acknowledge" '{}' >/dev/null
latest_email request_ack | grep -q 'ramesh@techcorp.in'

echo "Login ops + assign vehicle"
post_json /auth/login '{"email":"ops@urbeno.in","password":"demo"}' >/dev/null
UNIQ=$(date +%s | tail -c 6)
post_json "/submissions/$SUB_ID/vehicles" "{
  \"registration\":\"KA99T${UNIQ}\",
  \"vehicleType\":\"VT01\",
  \"driverName\":\"Test Driver\",
  \"driverPhone\":\"9900112233\",
  \"team\":[]
}" >/dev/null
latest_email vehicle_assigned | grep -q 'ramesh@techcorp.in'

echo "Loading complete without weighment should fail"
MSG=$(post_json "/submissions/$SUB_ID/loading-complete" '{}' | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).message||'OK')")
echo "  -> $MSG"
[[ "$MSG" == *"weighment"* ]] || { echo "Expected weighment error"; exit 1; }

echo "All email routing checks passed for $SUB_ID"
