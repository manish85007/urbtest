# Urb TecTrack — Role-wise end-user training guides

Visual training packs with **elaborated steps**, **tips**, and **full-page screenshots** for each signed-in role.  
**No usernames or passwords** are printed — credentials are issued separately by the system.

**Document control:** Version 1 · Production portal **https://tectrack.urbeno.in**

| Guide | Audience | Capture script | PDF |
|-------|----------|----------------|-----|
| Client User | Waste generator / requestor | `capture-client.mjs` | [Urb-TecTrack-Client-User-Training-Guide-v1.pdf](./client/Urb-TecTrack-Client-User-Training-Guide-v1.pdf) |
| Factory Manager | Facility MRN / Form 6 | `capture-factory.mjs` | [Urb-TecTrack-Factory-Manager-Training-Guide-v1.pdf](./factory/Urb-TecTrack-Factory-Manager-Training-Guide-v1.pdf) |
| Operations Manager | Acknowledge / vehicles / weighment / reports | `capture-operations.mjs` | [Urb-TecTrack-Operations-Manager-Training-Guide-v1.pdf](./operations/Urb-TecTrack-Operations-Manager-Training-Guide-v1.pdf) |
| Super Admin | Full lifecycle, Masters, Audit, Compliance | `capture-admin.mjs` | [Urb-TecTrack-Admin-Training-Guide-v1.pdf](./admin/Urb-TecTrack-Admin-Training-Guide-v1.pdf) |
| Super Admin — complete lifecycle | Classroom walkthrough (ack → vehicle backdate → invoice → Form 6 → CoD → Masters) | `capture-lifecycle-admin.mjs` | [Urb-TecTrack-Super-Admin-Lifecycle-Training-Guide-v1.pdf](./lifecycle-admin/Urb-TecTrack-Super-Admin-Lifecycle-Training-Guide-v1.pdf) |

**Lifecycle pack** covers acknowledge → Assign Vehicle (with Super Admin historical backdate from **2026-04-01**) → weighment context → invoice → MRN hand-off → Form 6 → CoD → client close hand-off → reports → Masters (including **client_readonly** / **auditor**) → profile. The four day-to-day role PDFs remain the primary guides.

Detailed markdown manuals (Version 1) also live under [`docs/production/training/`](../../production/training/).

Support: **info@urbeno.in**

## Recapture screenshots

Requires a running portal (local Docker UAT recommended; `E2E_TEST=true` skips forced MFA enrol so captures can proceed). Credentials via env only — never commit them.

```bash
export BASE_URL=http://localhost:8080   # or https://tectrack.urbeno.in
# optional overrides: TEST_EMAIL / TEST_PASSWORD (issued separately)

node docs/uat/training/capture-client.mjs
node docs/uat/training/capture-factory.mjs
node docs/uat/training/capture-operations.mjs
node docs/uat/training/capture-admin.mjs
node docs/uat/training/capture-lifecycle-admin.mjs
```

## Rebuild PDFs

```bash
export BASE_URL=https://tectrack.urbeno.in   # or local Docker
# optional: re-capture screenshots with capture-*.mjs first
.venv-pdf/bin/python docs/uat/training/build-training-pdfs.py
# or one role: .venv-pdf/bin/python docs/uat/training/build-training-pdfs.py client
```

Shared Playwright helpers live in `_capture-lib.mjs`. Manifests use portal **https://tectrack.urbeno.in**, version **1**, and must not contain passwords.
