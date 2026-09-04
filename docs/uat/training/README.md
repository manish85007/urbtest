# Urb TecTrack — Role-wise end-user training guides

Visual training packs with **elaborated steps**, **tips**, and a **screenshot for every step**.  
**No usernames or passwords** are printed — credentials are issued separately by the system.

**Document control:** Version 1 · Production portal **https://tectrack.urbeno.in**  
Guides are intentionally long (multi-page) so classroom and self-paced training can follow the **complete lifecycle**.

| Guide | Audience | Steps (approx.) | PDF |
|-------|----------|-----------------|-----|
| Client User | Waste generator / requestor | ~14 | [Urb-TecTrack-Client-User-Training-Guide-v1.pdf](./client/Urb-TecTrack-Client-User-Training-Guide-v1.pdf) |
| Factory Manager | Facility MRN / Form 6 | ~11 | [Urb-TecTrack-Factory-Manager-Training-Guide-v1.pdf](./factory/Urb-TecTrack-Factory-Manager-Training-Guide-v1.pdf) |
| Operations Manager | Acknowledge / vehicles / weighment | ~14 | [Urb-TecTrack-Operations-Manager-Training-Guide-v1.pdf](./operations/Urb-TecTrack-Operations-Manager-Training-Guide-v1.pdf) |
| Super Admin (day-to-day) | Masters, Audit, Compliance + lifecycle controls | ~20 | [Urb-TecTrack-Admin-Training-Guide-v1.pdf](./admin/Urb-TecTrack-Admin-Training-Guide-v1.pdf) |
| **Super Admin — complete lifecycle** | End-to-end mock walkthrough (every form) | **~29** | [Urb-TecTrack-Super-Admin-Lifecycle-Training-Guide-v1.pdf](./lifecycle-admin/Urb-TecTrack-Super-Admin-Lifecycle-Training-Guide-v1.pdf) |

### What the lifecycle guide covers (screenshot per step)

Staff new request (historical backdate) → Stage 1 detail → Acknowledge → Assign Vehicle (backdate) → vehicle listed → Weighment form → Loading complete → Raise Invoice → invoice panel → Create MRN → Form 6 → Approve Form 6 → Upload CoD → Record Payment → client Review & Close → Requests / Capacity / Heroes / Sustainability / Reports / Masters / Users / Audit / Compliance / Profile / Sign out.

Markdown manuals: [`docs/production/training/`](../../production/training/).

Support: **info@urbeno.in**

## Recapture screenshots

Requires local Docker UAT (`E2E_TEST=true` recommended so MFA enrol does not block automation).

```bash
export BASE_URL=http://localhost:8080
export PLAYWRIGHT_CHANNEL=chrome

node docs/uat/training/capture-lifecycle-admin.mjs   # creates a fresh mock REQ and walks stages 1–9
node docs/uat/training/capture-admin.mjs
node docs/uat/training/capture-operations.mjs
node docs/uat/training/capture-factory.mjs
node docs/uat/training/capture-client.mjs
.venv-pdf/bin/python docs/uat/training/build-training-pdfs.py
```

Shared helpers: `_capture-lib.mjs`. Fixtures: `apps/web/e2e/fixtures/sample.jpg` and `sample.pdf`.
