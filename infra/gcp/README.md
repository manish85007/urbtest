# Urb TecTrack UAT on Google Cloud

Dev-sized stack for tester sign-off. Region: **asia-south1** (Mumbai).

| Service | Why | UAT size |
|---|---|---|
| Cloud Run | Same Docker image as AWS (API + SPA, HTTPS) | 1 vCPU / 1 GiB, min 1 instance |
| Cloud SQL PostgreSQL 16 | Matches Prisma | `db-f1-micro`, 10 GB, zonal |
| Cloud Storage | Weighment photos, certificates, serial CSVs | Private, uniform access |
| Secret Manager | DB password + session secret | 2 secrets |

**Estimated monthly cost (24/7, asia-south1):** about **$55–80**

- Cloud SQL db-f1-micro + 10 GB SSD ~$10–15
- Cloud Run 1 vCPU / 1 GiB, min instances 1 ~$40–55
- Storage + secrets + Artifact Registry ~$2–5

Stop the stack when testers are done (`./infra/gcp/destroy.sh`).

## Deploy

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
./infra/gcp/deploy.sh
```

Billing must be enabled on the project. Demo logins (password `demo`): `admin@urbeno.in`, `kgf@urbeno.in`, `ramesh@techcorp.in`.
