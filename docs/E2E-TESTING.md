# End-to-end testing — Urb TecTrack

This guide covers manual UAT and automated Playwright tests for the full 9-stage pickup lifecycle.

## Prerequisites

1. **PostgreSQL** — start the dev database:

   ```bash
   docker compose up -d
   ```

2. **Environment** — from repo root:

   ```bash
   cp .env.example .env
   cp .env apps/api/.env
   pnpm install
   pnpm db:generate && pnpm db:migrate:deploy && pnpm db:seed
   ```

3. **Demo accounts** (password `demo` for all):

   | Email | Role |
   |-------|------|
   | `admin@urbeno.in` | Admin |
   | `blr@urbeno.in` | Factory (Bengaluru) |
   | `ramesh@techcorp.in` | Client (TechCorp) |

## Run the app

```bash
pnpm dev
```

- Web: http://localhost:5173  
- API: http://localhost:3001  

Both must be running. The web app proxies `/api` to the API for same-origin cookies.

## Automated tests (Playwright)

Install browsers once:

```bash
pnpm --filter @urb-tectrack/web exec playwright install chromium
```

Run E2E (starts API + web if not already running):

```bash
pnpm e2e
```

Interactive UI:

```bash
pnpm e2e:ui
```

### What the suite covers

| Spec | Scenarios |
|------|-----------|
| `e2e/smoke.spec.ts` | Login as admin, client, factory; basic navigation |
| `e2e/lifecycle.spec.ts` | Full stages 1–9; reject → client edit → resubmit |

## Manual UAT walkthrough

### 1. Client — raise request (Stage 1)

1. Sign in as `ramesh@techcorp.in` / `demo`
2. **New request** → fill site, location, weight → **Submit request**
3. Note the request ID (e.g. `REQ-00049`)

### 2. Admin — acknowledge or reject (Stage 2)

1. Sign in as `admin@urbeno.in`
2. Open the request → **Acknowledge**, or **Request changes** with a reason
3. If rejected, sign back in as client → edit details → **Save and resubmit**

### 3. Admin — vehicle & weighment (Stages 3–4)

1. **Assign vehicle** (registration, type, driver)
2. Upload weighment slip + pickup photos, enter gross/tare/slip no. → **Record weighment**

### 4. Admin — invoice (Stage 5)

1. **Raise invoice** — invoice no., taxable amount, e-way bill → **Create invoice**

### 5. Factory — MRN & recycling (Stages 5–6)

1. Sign in as `blr@urbeno.in`
2. Open request → **Record goods receipt (MRN)**
3. Select category → **Record recycling**

### 6. Admin — certificate, payment, close (Stages 7–9)

1. Sign in as `admin@urbeno.in`
2. Upload certificate PDF/image → **Upload & email certificate**
3. **Record payment** (UTR, amount, mode)
4. **Close invoice** with rating

### Admin-only surfaces

- **Masters** — add clients, sites, users; manage lookup values; flush email queue
- **Audit** — filter logs, export CSV
- **Heroes** — record tree plantings (admin)
- **Profile** — change password

### Seeded demo data

| Request | Stage | Use for |
|---------|-------|---------|
| `REQ-00046` | 1 — awaiting ack | Quick acknowledge test |
| `REQ-00047` | 3 — vehicle assigned | Weighment test |
| `REQ-00048` | 5 — invoiced | MRN / payment test |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Login fails | Ensure Postgres is up, `.env` exists, `pnpm db:seed` ran |
| API unreachable | Confirm `pnpm dev:api` on port 3001 |
| Cookie/session lost | Use `VITE_API_URL=/api` (Vite proxy), not bare `localhost:3001` |
| Weighment blocked | Upload at least one slip and one pickup photo |
| Emails stay queued | **Masters → Email queue → Process queue** (admin) |
