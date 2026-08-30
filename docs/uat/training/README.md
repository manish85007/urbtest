# Urb TecTrack — Role-wise end-user training guides

Visual training packs with **elaborated steps**, **tips**, and **full-page screenshots** for each signed-in role.  
**No usernames or passwords** are printed — credentials are issued separately by the system.

| Guide | Audience | Steps | PDF |
|-------|----------|-------|-----|
| Client User | Waste generator / requestor | 11 | [Urb-TecTrack-Client-User-Training-Guide.pdf](./client/Urb-TecTrack-Client-User-Training-Guide.pdf) |
| Factory Manager | Facility MRN / Form 6 | 8 | [Urb-TecTrack-Factory-Manager-Training-Guide.pdf](./factory/Urb-TecTrack-Factory-Manager-Training-Guide.pdf) |
| Super Admin | Urbeno operations | 13 | [Urb-TecTrack-Admin-Training-Guide.pdf](./admin/Urb-TecTrack-Admin-Training-Guide.pdf) |

Portal: **https://uat.urbeno.in** · Support: **info@urbeno.in**

## What’s inside each PDF

1. Cover (role, audience, portal)  
2. How to use + training agenda  
3. One chapter per step: **What to do** (numbered), **Tip**, and a screenshot  

## Regenerate from live UAT

```bash
# Local Docker UAT (or BASE_URL=https://uat.urbeno.in)
export BASE_URL=http://localhost:8080
node docs/uat/training/capture-client.mjs
node docs/uat/training/capture-factory.mjs
node docs/uat/training/capture-admin.mjs
.venv-pdf/bin/python docs/uat/training/build-training-pdfs.py
```

Capture scripts sign in with env overrides if needed (`TEST_EMAIL` / `TEST_PASSWORD`) but redact profile PII in screenshots.
