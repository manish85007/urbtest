# Urb TecTrack UAT on AWS (removed)

> **Live UAT is on GCP only:** **https://uat.urbeno.in**  
> See [`infra/gcp/README.md`](./gcp/README.md).  
> The `UrbTecTrackUat` CloudFormation stack was **destroyed** (ECS, ALB, NAT, RDS, S3, VPC).  
> Recreate later with `npx cdk deploy UrbTecTrackUat` from this folder if needed.

## Recreate (optional)

```bash
# App password secret (if missing):
aws secretsmanager create-secret \
  --name UrbTecTrackUat/SmtpPass \
  --secret-string 'YOUR_GMAIL_APP_PASSWORD' \
  --region ap-south-1

cd infra
npx cdk deploy UrbTecTrackUat
```

Do **not** point `uat.urbeno.in` at AWS again unless intentionally moving off GCP.
