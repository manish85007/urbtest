# Urb TecTrack™

Production codebase for **Urbeno's E-Waste Management Platform**, ported from the working prototype (`urb-tectrack-v6.3-complete.html`) per the [Production Build Plan](docs/Production-Build-Plan.md).

## Stack

| Layer | Choice |
|-------|--------|
| API | Node.js 20, Fastify, TypeScript |
| Database | PostgreSQL 16, Prisma ORM |
| Frontend | React 19, Vite, TypeScript |
| Shared domain | `@urb-tectrack/shared` — stage derivation, fiscal year, money, recovery |

## Monorepo layout

```
apps/
  api/          REST API + Prisma schema + seed
  web/          React frontend (Phase 6 migration target)
packages/
  shared/       Business rules ported from prototype (no rewrite)
docs/
  ADR-001.md    Architecture decision record
  prototype/    Reference HTML prototype copy
```

## Quick start

```bash
# 1. Install dependencies
pnpm install

# 2. Start Postgres
docker compose up -d

# 3. Configure environment
cp .env.example .env
cp .env apps/api/.env

# 4. Migrate and seed
pnpm db:generate
pnpm db:migrate        # dev: creates/applies migrations interactively
pnpm db:seed

# 5. Run API + web
pnpm dev
```

- API: http://localhost:3001
- Web: http://localhost:5173

### Demo accounts (password: `demo`)

| Email | Role |
|-------|------|
| admin@urbeno.in | Admin |
| blr@urbeno.in | Factory (Bengaluru) |
| ramesh@techcorp.in | Client (TechCorp) |

## Build plan alignment

Phases **1–9** of the production build plan are implemented in this branch:

- ✅ Foundation, auth, Prisma schema, shared domain logic
- ✅ Nine-stage lifecycle API (ported prototype business rules)
- ✅ React frontend with full lifecycle UI
- ✅ File upload storage (local dev; S3-ready)
- ✅ Email queue + scheduled payment/SLA reminders
- ✅ Reporting dashboard + sustainability metrics
- ✅ DPDPA legal consent, audit log, security headers
- ✅ v6.4 compliance controls: hash-chained audit, security log, MFA, password policy, access review, incidents, DSR, retention

## Critical rule from the build plan

> **Do not rewrite the business rules. Port them.**

Every validation message, stage rule, and reconciliation check in the prototype maps to a service method. See `// MIGRATION:` comments in the reference prototype.

## Tests

```bash
pnpm test
```

Shared and API unit tests cover fiscal year boundaries, stage derivation, money/payments, file limits, and legal compliance. Set `DATABASE_URL` to run the full lifecycle integration test.

### End-to-end (Playwright)

```bash
pnpm exec playwright install chromium --filter @urb-tectrack/web
pnpm e2e
```

See [docs/E2E-TESTING.md](docs/E2E-TESTING.md) for Playwright setup, and [docs/uat/README.md](docs/uat/README.md) for the production UAT pack (client, factory, admin scripts and sign-off).

For CI, staging, and production, apply migrations non-interactively:

```bash
pnpm db:migrate:deploy
```

## License

Proprietary — Urbeno Private Limited
