# Urb TecTrack — GCP production

**Public URL:** https://tectrack.urbeno.in  
**Region:** asia-south1  
**Factory:** Urbeno - Aerospace Park - Unit 1 (`URB-ASP1`) · **3060 TPA** (same authorised category mix as UAT Bengaluru)  
**Super Admin:** manish@urbeno.in  

UAT (`tectrack-uat` / `tectrack-uat` SQL) is **not** reused. Production uses a separate Cloud SQL instance, bucket, secrets, and Cloud Run service.

---

## What you will create

| Resource | Name |
|---|---|
| Cloud SQL Postgres 16 | `tectrack-prod` (`db-g1-small`, 20 GB, nightly backups) |
| Cloud Run | `tectrack-prod` |
| Storage | `gs://<project>-tectrack-prod-uploads` |
| Secrets | `tectrack-prod-db-password`, `tectrack-prod-session-secret`, `tectrack-prod-admin-password` |
| SMTP | reuse `tectrack-smtp-pass` |
| HTTPS LB | `tectrack-prod-*` (blanks `Server` header) |
| DNS | A record `tectrack.urbeno.in` → LB IP |

---

## Steps

### 1. Prerequisites

- Billing enabled on the GCP project (same as UAT is fine).
- `gcloud` signed in: `gcloud auth login` and `gcloud config set project YOUR_PROJECT_ID`
- Docker running locally (image build).
- Secret `tectrack-smtp-pass` already exists (same as UAT).
- You can create a DNS **A** record on `urbeno.in` (GoDaddy / Cloudflare / whatever hosts the zone).

### 2. Deploy app + database

From the repo root:

```bash
./infra/gcp/deploy-prod.sh
```

This builds `:prod`, creates SQL/Run/bucket if missing, runs Prisma migrations, and production seed (factory + categories + admin only — **no demo clients or demo password**).

Retrieve the one-time admin bootstrap password (must change on first login):

```bash
gcloud secrets versions access latest --secret=tectrack-prod-admin-password
```

Staff MFA is mandatory for admin / operations / factory within **15 days** of account creation; after that the portal blocks until enrolment.

Sign in as **manish@urbeno.in** and **change the password** immediately (Profile → Change password). Use Forgot password if you prefer email reset.

### 3. HTTPS load balancer + certificate

```bash
GCP_RUN_SERVICE=tectrack-prod \
GCP_LB_DOMAIN=tectrack.urbeno.in \
GCP_LB_PREFIX=tectrack-prod \
  ./infra/gcp/setup-lb.sh
```

Note the printed **LB IP**.

### 4. DNS (you / domain admin)

Create:

```
A    tectrack.urbeno.in    →    <LB IP>
```

Wait until the managed cert is ACTIVE:

```bash
gcloud compute ssl-certificates describe tectrack-prod-cert --global --format='value(managed.status)'
```

Then:

```bash
curl -sSI https://tectrack.urbeno.in/health
```

Expect `{"ok":true,...}`. HTML should use `Cache-Control: no-cache, no-store, must-revalidate`. `Server` should be blank at the LB.

### 5. Optional — stop direct `*.run.app` access

```bash
gcloud run services update tectrack-prod --region=asia-south1 \
  --ingress=internal-and-cloud-load-balancing
```

Do this **only after** the LB URL works.

### 6. First login checklist (Super Admin)

1. Open https://tectrack.urbeno.in  
2. Sign in as manish@urbeno.in  
3. Accept Terms / Privacy if prompted  
4. Change password  
5. **Masters → Company & Letterhead** — confirm GST, CIN, address, logo  
6. **Masters → Factory Sites** — confirm **Urbeno - Aerospace Park - Unit 1** and **3060 TPA** on Category Master  
7. Add **clients, sites, and named client users** (from the list you requested from customers)  
8. Add factory / operations users only when needed  

Do **not** run UAT seed (`UAT_SEED=true`) on this service — the app refuses it when `NODE_ENV=production`.

### 7. Later deploys (code only)

Re-run `./infra/gcp/deploy-prod.sh`. Seed is idempotent and **does not reset** the admin password after the user exists. You can later set `PRODUCTION_SEED=false` on Cloud Run if you want to skip seed on every start.

---

## Cost note (asia-south1, 24/7)

Roughly Cloud SQL `db-g1-small` + Cloud Run min 1 + global HTTPS LB: **higher than UAT** (SQL is no longer `f1-micro`). Review the GCP billing console after week one.
