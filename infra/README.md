# Urb TecTrack UAT on AWS

Dev-sized stack for tester sign-off. Region: **ap-south-1** (Mumbai).

| Service | Why | UAT size |
|---|---|---|
| ECS Fargate + ALB | Node API + React SPA in one origin (session cookies work) | 0.5 vCPU / 1 GB, 1 task |
| RDS PostgreSQL | Matches Prisma; Aurora VPC clusters are blocked on AWS Free Plan | db.t4g.micro, 20 GB |
| S3 | Weighment photos, certificates, serial CSVs | Private, SSE-S3 |
| Secrets Manager | Generated DB password | 1 secret |
| NAT Gateway | Private Fargate + Aurora, no public IPs on compute | 1 AZ |

**Estimated monthly cost (24/7, ap-south-1):** about **$80–110**

- NAT Gateway ~$32
- RDS db.t4g.micro ~$12–18
- Fargate ~$18
- ALB ~$16–20
- S3 + Secrets + logs ~$5–10

Assumes idle-to-light UAT traffic. Stop the stack when testers are done (`pnpm --filter @urb-tectrack/infra destroy`).

## Deploy

```bash
cd infra
npx cdk bootstrap aws://$ACCOUNT/ap-south-1
npx cdk deploy UrbTecTrackUat
```

Demo logins (password `demo`): `admin@urbeno.in`, `kgf@urbeno.in`, `ramesh@techcorp.in`.
