# Urb TecTrack — Role-wise end-user training guides

Visual training packs with **elaborated steps**, **tips**, and **full-page screenshots** for each signed-in role.  
**No usernames or passwords** are printed — credentials are issued separately by the system.

**Document control:** Version 1 · Production portal **https://tectrack.urbeno.in**

| Guide | Audience | PDF |
|-------|----------|-----|
| Client User | Waste generator / requestor | [Urb-TecTrack-Client-User-Training-Guide-v1.pdf](./client/Urb-TecTrack-Client-User-Training-Guide-v1.pdf) |
| Factory Manager | Facility MRN / Form 6 | [Urb-TecTrack-Factory-Manager-Training-Guide-v1.pdf](./factory/Urb-TecTrack-Factory-Manager-Training-Guide-v1.pdf) |
| Operations Manager | Acknowledge / vehicles / weighment / reports | [Urb-TecTrack-Operations-Manager-Training-Guide-v1.pdf](./operations/Urb-TecTrack-Operations-Manager-Training-Guide-v1.pdf) |
| Super Admin | Full lifecycle, Masters, Audit, Compliance | [Urb-TecTrack-Admin-Training-Guide-v1.pdf](./admin/Urb-TecTrack-Admin-Training-Guide-v1.pdf) |

Detailed markdown manuals (Version 1) also live under [`docs/production/training/`](../../production/training/).

Support: **info@urbeno.in**

## Regenerate PDFs

```bash
export BASE_URL=https://tectrack.urbeno.in   # or local Docker
# optional: re-capture screenshots with capture-*.mjs
.venv-pdf/bin/python docs/uat/training/build-training-pdfs.py
```
