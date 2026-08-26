# Urb TecTrack UAT on AWS

Dev-sized stack for tester sign-off. Region: **ap-south-1** (Mumbai).

| Service | Why | UAT size |
|---|---|---|
| ECS Fargate + ALB | Node API + React SPA (HTTPS on `uat.urbeno.in`) | 0.5 vCPU / 1 GB, 1 task |
| RDS PostgreSQL | Matches Prisma; Aurora VPC clusters are blocked on AWS Free Plan | db.t4g.micro, 20 GB |
| S3 | Weighment photos, certificates, serial CSVs | Private, SSE-S3 |
| Secrets Manager | DB password, session secret, SMTP app password | 3 secrets |
| NAT Gateway | Private Fargate, no public IPs on compute | 1 AZ |
| ACM | TLS for `uat.urbeno.in` | Existing issued cert |

**Estimated monthly cost (24/7, ap-south-1):** about **$80–110**

- NAT Gateway ~$32
- RDS db.t4g.micro ~$12–18
- Fargate ~$18
- ALB ~$16–20
- S3 + Secrets + logs ~$5–10

Assumes idle-to-light UAT traffic. Stop the stack when testers are done (`pnpm --filter @urb-tectrack/infra destroy`).

## HTTPS

Public URL: **https://uat.urbeno.in** (DNS must already point at the ALB).  
HTTP `:80` redirects to HTTPS. Cookies use `COOKIE_SECURE=true`.

## SMTP (noreply@urbeno.in)

Create the app-password secret **before** deploy (never commit the password):

```bash
# App password with spaces removed
aws secretsmanager create-secret \
  --name UrbTecTrackUat/SmtpPass \
  --secret-string 'YOUR_GMAIL_APP_PASSWORD' \
  --region ap-south-1

# Or update an existing secret:
aws secretsmanager put-secret-value \
  --secret-id UrbTecTrackUat/SmtpPass \
  --secret-string 'YOUR_GMAIL_APP_PASSWORD' \
  --region ap-south-1
```

Mail is sent via Gmail SMTP as **noreply@urbeno.in** to **real recipient addresses** (no UAT redirect funnel).  
The app password lives only in Secrets Manager (`SMTP_PASS`); Masters never persists it.

## Deploy

```bash
cd infra
npx cdk bootstrap aws://$ACCOUNT/ap-south-1
npx cdk deploy UrbTecTrackUat
```

If a **manual** HTTPS listener already exists on the ALB (outside CloudFormation), delete it before deploy so CDK can own `:443`:

```bash
aws elbv2 delete-listener --listener-arn <manual-443-arn> --region ap-south-1
```

Demo logins (password `demo`): `admin@urbeno.in`, `kgf@urbeno.in`, `ramesh@techcorp.in`.
