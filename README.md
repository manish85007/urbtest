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

# 4. Migrate and seed
pnpm db:generate
pnpm db:migrate
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

This scaffold covers **Phase 1 (Foundation)** and starts **Phase 2–3**:

- ✅ Postgres schema with money-as-paise and weight decimals
- ✅ Derived stage logic in `@urb-tectrack/shared` (never stored as source of truth)
- ✅ Atomic MRN counter service (transaction + upsert)
- ✅ Session auth with bcrypt (replacing prototype SHA-256)
- ✅ 252 category master rows seeded from prototype
- ✅ Audit log append-only service
- 🔲 Full 9-stage lifecycle endpoints (Phase 3 — next)
- 🔲 Prototype UI screen migration (Phase 6)
- 🔲 S3 file storage, email queue, scheduled jobs (Phases 4–7)

## Critical rule from the build plan

> **Do not rewrite the business rules. Port them.**

Every validation message, stage rule, and reconciliation check in the prototype maps to a service method. See `// MIGRATION:` comments in the reference prototype.

## Tests

```bash
pnpm test
```

Shared package includes tests for fiscal year boundaries (31 Mar / 1 Apr), stage derivation, money paise, and category weight balance.

## License

Proprietary — Urbeno Private Limited
