# Urb TecTrack — UAT pack (production sign-off)

This pack is the **user-acceptance test** for going live. Automated Playwright tests (`pnpm e2e`) prove the happy path in CI. These documents prove that **real people in each role** can operate the live process, that refusals match the business rules, and that Urbeno is willing to sign the system into production.

| Document | Who executes it | Purpose |
|----------|-----------------|---------|
| [CLIENT-UAT-PACK.md](./CLIENT-UAT-PACK.md) | **Client testers (share this)** | Standalone checklist + findings log + sign-off for UAT |
| [CLIENT-UAT-EMAIL.md](./CLIENT-UAT-EMAIL.md) | Urbeno (send to clients) | Formal invitation email template |
| [Urb-TecTrack-Client-UAT-Results.xlsx](./Urb-TecTrack-Client-UAT-Results.xlsx) | **Client testers (share this)** | Excel results workbook — no usernames/passwords |
| [client-guide/Urb-TecTrack-Client-Access-Visual-Guide.pdf](./client-guide/Urb-TecTrack-Client-Access-Visual-Guide.pdf) | Client testers | Step-by-step screen walkthrough (PDF) |
| [training/](./training/README.md) | **Trainers / end users** | Role-wise training PDFs (Client, Factory, Admin) with screenshots |
| [UAT-CLIENT.md](./UAT-CLIENT.md) | Client user (requestor) | Detailed internal client script (same scope) |
| [UAT-FACTORY.md](./UAT-FACTORY.md) | Factory manager | MRN, Form 6, capacity; no client or compliance access |
| [UAT-OPERATIONS.md](./UAT-OPERATIONS.md) | Urbeno Operations Manager | Ack / vehicles / weighment / reports; **no** invoice, CoD certify, Masters, Compliance |
| [UAT-ADMIN.md](./UAT-ADMIN.md) | Urbeno Super Admin | Invoice, CoD certify, Masters, Audit, Compliance |
| [UAT-CROSS-ROLE-LIFECYCLE.md](./UAT-CROSS-ROLE-LIFECYCLE.md) | Client + Ops/Super Admin + Factory | One request through stages 1–9 |
| [UAT-PRODUCTION-SIGNOFF.md](./UAT-PRODUCTION-SIGNOFF.md) | Product owner + testers | Go / no-go certificate |

Print or copy each script. Mark every case **Pass / Fail / N/A / Blocked**. Attach screenshots for Fail and Blocked.

Related: [E2E-TESTING.md](../E2E-TESTING.md) (how to run the app and Playwright), [kit-BUSINESS-RULES.md](../kit-BUSINESS-RULES.md) (rules the UAT is checking).

---

## Roles under test

The product has **signed-in roles** under test. Use the matching script for each persona.

| Role | What they are | Seeded UAT accounts (password `demo`) |
|------|----------------|----------------------------------------|
| **Client** | The waste generator. Raises pickups, sees own organisation only, closes after certificate + payment. | `ramesh@techcorp.in` (TechCorp), `priya@techcorp.in` (TechCorp), `meera@infosoft.in` (Infosoft), `anand@bharatretail.in` (Bharat Retail) |
| **Client Read Only** | Same tenant visibility as client; cannot raise or close. | `viewer@techcorp.in` (seeded when present) |
| **Factory** | Facility manager. Records goods receipt (MRN) and recycling (Form 6). Sees capacity. Never sees Compliance. | `blr@urbeno.in` (Bengaluru `URB-BLR`), `kgf@urbeno.in` (Kolar `URB-KGF`) |
| **Operations** | Urbeno field ops. Acknowledges, vehicles, weighment, reports. **Cannot** raise invoices or certify CoD. | `ops@urbeno.in` (Deepa Rao) |
| **Super Admin** | Full Urbeno control. Invoices, certificates, certify publish, Masters, Audit, Compliance. | `admin@urbeno.in` (Manish Jain) |

Do **not** change the shared `demo` password until the last session of the day, or create a dedicated throwaway user in Masters for password / lockout tests.

---

## Environment

Record this on every script header before starting.

| Field | Write the value |
|-------|-----------------|
| Environment | UAT / Production-candidate (never mix) |
| Web URL | **UAT:** `https://uat.urbeno.in` · **Prod:** `https://tectrack.urbeno.in` · Local: `http://localhost:5173` |
| Hosting | **GCP only** — Cloud Run + Cloud SQL + Cloud Storage (AWS UAT stack removed) |
| API health | `GET /health` returns `{ "ok": true }` |
| Git / build | Branch + short SHA, or release tag |
| Date / time | ISO date, IST |
| Browser | Chrome / Edge / Safari + version |

### Local UAT (developer laptop)

```bash
pnpm install
pnpm db:generate && pnpm db:migrate:deploy && pnpm db:seed
pnpm dev
```

- Web: http://localhost:5173  
- API: http://localhost:3001  
- First sign-in may show **Accept policies to continue** (DPDPA). Accept before testing.

### Seeded requests (optional shortcuts)

Use these only for **role-specific** cases. The **cross-role lifecycle** must create a **new** request so stage 9 is earned, not inherited.

| Request | Starting stage | Useful for |
|---------|----------------|------------|
| `REQ-00046` | 1 — awaiting acknowledgement | Admin acknowledge / request changes |
| `REQ-00047` | 3 — vehicle assigned | Admin weighment |
| `REQ-00048` | 5 — invoiced | Factory MRN / Form 6 |
| `REQ-00043` | 1 — Infosoft | Client tenancy (TechCorp must **not** open this) |

---

## How to mark results

| Result | Meaning |
|--------|---------|
| **Pass** | Observed behaviour matches **Expected**. |
| **Fail** | Behaviour is wrong, missing, or the refusal message does not match the kit. |
| **N/A** | Case cannot run in this environment (say why). |
| **Blocked** | A prior Fail or environment issue prevents the step. |

### Defect severity (log every Fail)

| Severity | Definition | Go-live effect |
|----------|------------|----------------|
| **Blocker** | Cannot complete a required stage, data loss, wrong tenant data, security hole | **No-go** until fixed |
| **Major** | Workaround exists but a business rule is broken (weight, tax, MRN, certificate, consent) | **No-go** unless waived in writing |
| **Minor** | Awkward UI, missing hint, non-blocking copy | May go live with a dated fix |
| **Cosmetic** | Alignment, spelling that does not change meaning | Does not block |

Log defects in the table on [UAT-PRODUCTION-SIGNOFF.md](./UAT-PRODUCTION-SIGNOFF.md). Quote the **exact on-screen message** — kit wording is part of the specification.

---

## Execution order (recommended)

1. Each role runs **Access & navigation** on a fresh browser session (or Incognito).
2. Run **[UAT-CROSS-ROLE-LIFECYCLE.md](./UAT-CROSS-ROLE-LIFECYCLE.md)** with Client, Super Admin (or Ops for early stages + Super Admin for invoice/certify), and Factory available the same day. Write the new `REQ-…` id at the top of every script.
3. Finish remaining cases on each role script (Operations boundaries, Masters, Compliance, negative tests).
4. Super Admin runs password-policy and lockout on a **dedicated** user, not the shared demo accounts.
5. Complete [UAT-PRODUCTION-SIGNOFF.md](./UAT-PRODUCTION-SIGNOFF.md).

Typical calendar: **one working day** for the role scripts plus lifecycle; **half a day** for Compliance and Masters; sign-off the following morning after defect triage.

---

## Production go-live gates

All of the following must be true, or the sign-off is **No-go**:

1. Cross-role lifecycle (stages 1–9) **Pass**, including client closure.
2. Client tenancy: TechCorp cannot open Infosoft `REQ-00043` (message: `You don't have access to this request`).
3. Clients never see an MRN number or MRN register.
4. Weighment refuses without slip photo **and** pickup photo (weighbridge path).
5. Invoice tax and total are calculated, not typed; e-way bill is required.
6. Category split on Form 6 equals invoice billing weight exactly.
7. Factory and client cannot open **Compliance** (nav hidden; direct `/compliance` redirects or 403).
8. Zero open **Blocker** defects; zero open **Major** defects unless waived on the sign-off form with owner and date.
9. Privacy / terms accepted on the UAT environment; audit chain on Compliance → Control status is not “Not operating” for the hash chain.

---

## Defect log (copy into the sign-off form)

| ID | Script / case | Severity | Summary | Screenshot | Owner | Status |
|----|---------------|----------|---------|------------|-------|--------|
| UAT-001 | | | | | | Open / Fixed / Waived |
