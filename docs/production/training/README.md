# Urb TecTrack — Production training manuals (Version 1)

Role-wise end-user training for the **production** portal, covering the **complete pickup lifecycle**.

| Manual | Audience | File |
|--------|----------|------|
| Client User | Waste generator / requestor | [01-Client-User-Training-Manual-v1.md](./01-Client-User-Training-Manual-v1.md) |
| Factory Manager | Facility MRN / Form 6 | [02-Factory-Manager-Training-Manual-v1.md](./02-Factory-Manager-Training-Manual-v1.md) |
| Operations Manager | Acknowledge, vehicles, weighment, reports | [03-Operations-Manager-Training-Manual-v1.md](./03-Operations-Manager-Training-Manual-v1.md) |
| Super Admin | Full lifecycle, Masters, Audit, Compliance, historical backdating | [04-Super-Admin-Training-Manual-v1.md](./04-Super-Admin-Training-Manual-v1.md) |

**Portal:** https://tectrack.urbeno.in  
**Support:** info@urbeno.in  

Related: [Client welcome email template](../CLIENT-WELCOME-EMAIL.md)

## Complete lifecycle (all roles)

| Stage | Primary actor | Notes |
|-------|---------------|-------|
| 1 Request | Client User (or Super Admin on behalf) | Super Admin may backdate from 2026-04-01 |
| 2 Acknowledge | Operations / Super Admin | |
| 3 Assign vehicle | Operations / Super Admin | Super Admin may backdate expected pickup |
| 4 Weighment | Operations / Super Admin | Super Admin may backdate weighment date |
| 5 Invoice | Super Admin | Historical invoice / e-way / payment dates |
| 6 MRN | Factory | Historical receiving date for Super Admin |
| 7 Form 6 | Factory (+ admin review) | Historical processing date for Super Admin |
| 8 CoD | Super Admin | Historical certificate date |
| 9 Close | Client User | After CoD + payment |

## Screenshot PDFs (Version 1 — detailed)

Step-by-step screenshot packs live under **`docs/uat/training/`**. Each step has how-to text + a full-page screenshot. Prefer the **complete lifecycle** Super Admin PDF for classroom demos of every form.

| Pack | PDF | Typical steps |
|------|-----|---------------|
| Client User | `docs/uat/training/client/Urb-TecTrack-Client-User-Training-Guide-v1.pdf` | ~14 |
| Factory Manager | `docs/uat/training/factory/Urb-TecTrack-Factory-Manager-Training-Guide-v1.pdf` | ~11 |
| Operations Manager | `docs/uat/training/operations/Urb-TecTrack-Operations-Manager-Training-Guide-v1.pdf` | ~14 |
| Super Admin (day-to-day) | `docs/uat/training/admin/Urb-TecTrack-Admin-Training-Guide-v1.pdf` | ~20 |
| Super Admin (complete lifecycle) | `docs/uat/training/lifecycle-admin/Urb-TecTrack-Super-Admin-Lifecycle-Training-Guide-v1.pdf` | **~29** |

Rebuild:

```bash
export BASE_URL=http://localhost:8080   # or https://tectrack.urbeno.in after MFA/demo OTP is available
export PLAYWRIGHT_CHANNEL=chrome
node docs/uat/training/capture-client.mjs
node docs/uat/training/capture-factory.mjs
node docs/uat/training/capture-operations.mjs
node docs/uat/training/capture-admin.mjs
node docs/uat/training/capture-lifecycle-admin.mjs   # full Super Admin lifecycle walkthrough
.venv-pdf/bin/python docs/uat/training/build-training-pdfs.py
```

Capture scripts solve the login math captcha automatically. Staff MFA enrolment on aged UAT accounts needs an on-screen demo OTP (`E2E_TEST=true` / `ALLOW_DEMO_OTP=true` on the API) or a fresh MFA grace window.

## Document control

**Version 1** | Urb TecTrack | https://tectrack.urbeno.in
