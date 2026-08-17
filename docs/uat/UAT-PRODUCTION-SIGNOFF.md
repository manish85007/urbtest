# Urb TecTrack — production UAT sign-off

Use this certificate only after the three role scripts and the cross-role lifecycle are finished. Attach marked scripts (PDF or paper) and the defect log.

---

## 1. Build under test

| Field | Value |
|-------|--------|
| Product | Urb TecTrack (Urbeno e-waste platform) |
| Environment name / URL | |
| Git branch | |
| Git SHA (full or 12-char) | |
| Release / tag | |
| Database migrated to | Prisma migrations including `20260817120000_v64_compliance` |
| Test window (IST) | From _____________ to _____________ |
| UAT lead | |

This is **not** a production URL unless the environment is explicitly named production-candidate and uses production-like data (no `demo` password on real client accounts).

---

## 2. Scripts completed

| Script | Tester | Pass | Fail | N/A | Blocked | Signed |
|--------|--------|------|------|-----|---------|--------|
| [UAT-CLIENT.md](./UAT-CLIENT.md) | | | | | | ☐ |
| [UAT-FACTORY.md](./UAT-FACTORY.md) | | | | | | ☐ |
| [UAT-ADMIN.md](./UAT-ADMIN.md) | | | | | | ☐ |
| [UAT-CROSS-ROLE-LIFECYCLE.md](./UAT-CROSS-ROLE-LIFECYCLE.md) — request `REQ-` ______ | | | | | | ☐ |

Playwright (`pnpm e2e`) on this SHA: ☐ Pass ☐ Fail ☐ Not run — log: _____________

---

## 3. Go-live gates (all required)

| Gate | Met? | Evidence |
|------|------|----------|
| Stages 1–9 completed on a **new** request, client closed | ☐ | Request ID: |
| TechCorp cannot open Infosoft `REQ-00043` | ☐ | Screenshot / case C1.2 |
| Clients never see MRN | ☐ | L7 / C4.2 |
| Weighment requires slip + pickup photos; net = gross − tare | ☐ | A3 / L4 |
| Invoice tax/total derived; e-way required; unique invoice no. | ☐ | A4 / L5 |
| Form 6 split equals billing weight | ☐ | F4 / L8 / N3 |
| Factory and client cannot use Compliance | ☐ | F0.4 / C1.4 / N4 |
| Audit chain verifies (Compliance → Evidence / Control status) | ☐ | A8.1 / A8.7 |
| Privacy accepted on this environment | ☐ | C0.2 / A0.1 |
| Zero open Blockers | ☐ | Section 4 |
| Zero open Majors **or** written waivers below | ☐ | Section 5 |

---

## 4. Defect log

| ID | Script / case | Severity | Summary | Owner | Status (Open / Fixed / Waived) |
|----|---------------|----------|---------|-------|--------------------------------|
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |

Open Blockers: _____ · Open Majors: _____ · Open Minors: _____

---

## 5. Waivers

Each Major left open needs a named owner, a dated fix, and a product-owner signature. Blockers cannot be waived.

| Defect ID | Why production is still acceptable | Fix by (date) | Owner | Product owner initials |
|-----------|--------------------------------------|---------------|-------|------------------------|
| | | | | |
| | | | | |

---

## 6. Known environment gaps (do not treat as product Fail if labelled)

Record hosting items that UAT cannot prove in this environment.

| Item | Status on this environment | Production follow-up |
|------|----------------------------|----------------------|
| Automated RDS/S3 backup (Control status “hosting control”) | ☐ Proven ☐ Warn / not hosted yet | |
| SMTP / SES actually delivering to client inboxes | ☐ Proven ☐ Console / queue only | |
| Uploads on durable S3 (not local disk) | ☐ Proven ☐ Local `UPLOAD_DIR` | |
| MFA enrolled on all privileged **production** users | ☐ Proven ☐ UAT only | |
| `demo` password absent in production | ☐ Confirmed for prod ☐ N/A (this is UAT) | |

---

## 7. Recommendation

Mark **one**:

- ☐ **Go** — all gates met; no open Blocker or unwaved Major. Deploy this SHA.
- ☐ **Go with waivers** — section 5 completed; no Blockers. Deploy this SHA with the dated fixes.
- ☐ **No-go** — retest after fixes. Do not promote this SHA.

Comments:

_________________________________________________________________

_________________________________________________________________

---

## 8. Signatures

By signing, you confirm the scripts were executed as written, results are truthful, and you accept the recommendation in section 7.

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Client tester | | | |
| Factory tester | | | |
| Admin / operations tester | | | |
| UAT lead | | | |
| Product owner (Urbeno) | | | |
| Engineering / release owner | | | |

**Approved production SHA to deploy:** `________________`

**Approved hostname:** `________________`
