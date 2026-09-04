# Urb TecTrack — Production training manuals (Version 1)

Role-wise end-user training for the **production** portal.

| Manual | Audience | File |
|--------|----------|------|
| Client User | Waste generator / requestor | [01-Client-User-Training-Manual-v1.md](./01-Client-User-Training-Manual-v1.md) |
| Factory Manager | Facility MRN / Form 6 | [02-Factory-Manager-Training-Manual-v1.md](./02-Factory-Manager-Training-Manual-v1.md) |
| Operations Manager | Acknowledge, vehicles, weighment, reports | [03-Operations-Manager-Training-Manual-v1.md](./03-Operations-Manager-Training-Manual-v1.md) |
| Super Admin | Full lifecycle, masters, audit, compliance | [04-Super-Admin-Training-Manual-v1.md](./04-Super-Admin-Training-Manual-v1.md) |

**Portal:** https://tectrack.urbeno.in  
**Support:** info@urbeno.in  

Related: [Client welcome email template](../CLIENT-WELCOME-EMAIL.md)

## Screenshots / PDFs

These Version 1 manuals are markdown walkthroughs (no embedded credentials).

Screenshot-based PDF packs (Version 1) live under **`docs/uat/training/`**:

- Client User, Factory Manager, Operations Manager, Super Admin (`*-Training-Guide-v1.pdf`)

Rebuild with:

```bash
.venv-pdf/bin/python docs/uat/training/build-training-pdfs.py
```

Capture against **https://tectrack.urbeno.in** — never `uat.urbeno.in` — and keep passwords out of the artwork.

## Document control

**Version 1** | Urb TecTrack | https://tectrack.urbeno.in
