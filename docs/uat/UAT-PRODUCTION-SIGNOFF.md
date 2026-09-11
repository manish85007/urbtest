# Urb TecTrack — production UAT sign-off

Use this certificate only after the role scripts and the cross-role lifecycle are finished. Attach marked scripts (PDF or paper) and the defect log.

**Hosting under test:** GCP Cloud Run + Cloud SQL + Cloud Storage.  
**UAT URL:** https://uat.urbeno.in · **Production URL:** https://tectrack.urbeno.in

---

## 1. Build under test

| Field | Value |
|-------|--------|
| Product | Urb TecTrack (Urbeno e-waste platform) |
| Environment name / URL | ☐ UAT `https://uat.urbeno.in` ☐ Prod candidate `https://tectrack.urbeno.in` ☐ Other: ________ |
| Git branch | |
| Git SHA (full or 12-char) | |
| Release / tag | |
| Database migrated to | Prisma migrations through latest (include `lifecycle_actor_role`, `mrn_delivery_challan`) |
| Cloud Run service / revision | `tectrack-uat` / `tectrack-prod` · revision: ________ |
| Test window (IST) | From _____________ to _____________ |
| UAT lead | |

This is **not** a production URL unless the environment is explicitly named production-candidate and uses production-like data (no `demo` password on real client accounts).

---

## 2. Scripts completed

| Script | Tester | Pass | Fail | N/A | Blocked | Signed |
|--------|--------|------|------|-----|---------|--------|
| [UAT-CLIENT.md](./UAT-CLIENT.md) | | | | | | ☐ |
| [UAT-FACTORY.md](./UAT-FACTORY.md) | | | | | | ☐ |
| [UAT-OPERATIONS.md](./UAT-OPERATIONS.md) | | | | | | ☐ |
| [UAT-ADMIN.md](./UAT-ADMIN.md) (Super Admin) | | | | | | ☐ |
| [UAT-CROSS-ROLE-LIFECYCLE.md](./UAT-CROSS-ROLE-LIFECYCLE.md) — request `REQ-` ______ | | | | | | ☐ |

Playwright (`pnpm e2e`) on this SHA: ☐ Pass ☐ Fail ☐ Not run — log: _____________  
CI (migrate deploy + unit + integration): ☐ Pass ☐ Fail — run: _____________

---

## 3. Go-live gates (all required)

| Gate | Met? | Evidence |
|------|------|----------|
| Stages 1–9 completed on a **new** request, client closed | ☐ | Request ID: |
| TechCorp cannot open Infosoft `REQ-00043` | ☐ | Screenshot / case C1.2 |
| Clients never see MRN | ☐ | L7 / C4.2 |
| Client lifecycle shows **role titles**, not staff email/name | ☐ | L7 |
| Weighment requires slip + pickup photos; net = gross − tare | ☐ | A3 / O3 / L4 |
| Invoice tax/total derived; e-way required; unique invoice no. | ☐ | A4 / L5 |
| Operations cannot raise invoice or certify CoD | ☐ | O4 / N6 |
| Form 6 split equals billing weight | ☐ | F4 / L8 / N3 |
| Factory, client, and Operations cannot use Compliance | ☐ | F0.4 / C1.4 / O4.3 / N4 |
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
| Automated **Cloud SQL** backups / PITR (Control status “hosting control”) | ☐ Proven ☐ Warn / not configured yet | Prod uses REGIONAL HA + PITR per PRODUCTION-GCP.md |
| Object storage on **Cloud Storage** (not local disk) | ☐ Proven ☐ Local `UPLOAD_DIR` | |
| SMTP actually delivering to client inboxes | ☐ Proven ☐ Console / queue only | |
| MFA enrolled on all privileged **production** users | ☐ Proven ☐ UAT only | |
| `demo` password absent in production | ☐ Confirmed for prod ☐ N/A (this is UAT) | |
| Cloud Run reachable only via custom domain / LB (optional harden) | ☐ Proven ☐ Direct `*.run.app` still open | |

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
| Operations tester | | | |
| Super Admin tester | | | |
| UAT lead | | | |
| Product owner (Urbeno) | | | |
| Engineering / release owner | | | |

**Approved production SHA to deploy:** `________________`

**Approved hostname:** `________________`
