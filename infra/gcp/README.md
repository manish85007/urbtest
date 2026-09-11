# Urb TecTrack UAT on Google Cloud

Dev-sized stack for tester sign-off. Region: **asia-south1** (Mumbai).  
Public URL: **https://uat.urbeno.in** (HTTPS load balancer in front of Cloud Run).

| Service | Why | UAT size |
|---|---|---|
| Cloud Run | API + SPA | 1 vCPU / 1 GiB, min 1 instance |
| Cloud SQL PostgreSQL 16 | Matches Prisma | `db-f1-micro`, 10 GB, zonal |
| Cloud Storage | Weighment photos, certificates, serial CSVs | Private, uniform access |
| Secret Manager | DB password + session secret | 2 secrets |
| External HTTPS LB | Custom domain `uat.urbeno.in`; blanks GFE `Server` header | Global EXTERNAL_MANAGED |

**Estimated monthly cost (24/7, asia-south1):** about **$55–90**

- Cloud SQL db-f1-micro + 10 GB SSD ~$10–15
- Cloud Run 1 vCPU / 1 GiB, min instances 1 ~$40–55
- Global HTTPS LB + forwarding rule ~$18+ (plus traffic)
- Storage + secrets + Artifact Registry ~$2–5

Stop the stack when testers are done (`./infra/gcp/destroy.sh`).

## Deploy

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
./infra/gcp/deploy.sh
```

Billing must be enabled on the project. Demo logins (password `demo`): `admin@urbeno.in`, `kgf@urbeno.in`, `ramesh@techcorp.in`.

## Custom domain (`uat.urbeno.in`)

Cloud Run’s Google Front End injects `Server: Google Frontend`. Put the global HTTPS load balancer in front and blank it:

```bash
GCP_LB_DOMAIN=uat.urbeno.in ./infra/gcp/setup-lb.sh
```

DNS (at the `urbeno.in` registrar):

1. Remove any **CNAME** for `uat` that points at the AWS ALB.
2. Create an **A** record: `uat.urbeno.in` → the LB IP printed by `setup-lb.sh` (currently **`8.233.150.171`**).

When the Google-managed cert is `ACTIVE`, the script (or a manual update) sets:

```bash
gcloud run services update tectrack-uat --region=asia-south1 \
  --update-env-vars=PORTAL_URL=https://uat.urbeno.in,CORS_ORIGIN=https://uat.urbeno.in
```

Verify:

```bash
curl -sS https://uat.urbeno.in/health
curl -sSI https://uat.urbeno.in/ | grep -i ^server || echo '(no Server header)'
```

Optionally lock Cloud Run to LB-only ingress:

```bash
gcloud run services update tectrack-uat --region=asia-south1 \
  --ingress=internal-and-cloud-load-balancing
```

## Production (tectrack.urbeno.in)

Separate stack from UAT. Full steps: **[docs/PRODUCTION-GCP.md](../../docs/PRODUCTION-GCP.md)**.

```bash
./infra/gcp/deploy-prod.sh
GCP_RUN_SERVICE=tectrack-prod GCP_LB_DOMAIN=tectrack.urbeno.in GCP_LB_PREFIX=tectrack-prod \
  ./infra/gcp/setup-lb.sh
# DNS A: tectrack.urbeno.in → LB IP
```

Super Admin: `manish@urbeno.in` (password in `tectrack-prod-admin-password`). Factory: **Urbeno - Aerospace Park - Unit 1** at **3060 TPA**.
