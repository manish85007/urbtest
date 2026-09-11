# UAT-OPERATIONS — Urbeno Operations Manager

**Role:** `operations` · acknowledge, vehicles, weighment, reports  
**Not in scope for this role:** Raise Invoice, Record Payment, Upload CoD, certify Form 6/CoD, Masters, Audit, Compliance  
**Account:** `ops@urbeno.in` (Deepa Rao) · password `demo` unless rotated  

Use this script for the Operations persona. Super Admin work (invoice → certify → payment, Masters, Compliance) is in [UAT-ADMIN.md](./UAT-ADMIN.md).

| Field | Value |
|-------|--------|
| Environment / URL | https://uat.urbeno.in (or production-candidate URL) |
| Build / git SHA | |
| Tester name | |
| Account used | `ops@urbeno.in` |
| Date (IST) | |
| Browser | |
| Shared lifecycle request ID | `REQ-` _____________ |

---

## O0 — Sign-in and shell

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| O0.1 | Sign in as `ops@urbeno.in`. Accept policies if prompted. | **Operations Dashboard**. | ☐ | |
| O0.2 | Navigation. | **Dashboard**, **Requests**, **Recycling Heroes**, **Sustainability**, **Capacity**, **Reports**. **No** Masters, Audit, or Compliance. | ☐ | |
| O0.3 | Profile. | Role shows Operations (not Super Admin). | ☐ | |

---

## O1 — Acknowledge and request changes (Stage 2)

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| O1.1 | Dashboard **New Requests** tile. | Count matches stage-1 list. | ☐ | |
| O1.2 | Open the shared new request (or `REQ-00046`). **Acknowledge Request**. | Message **Request acknowledged.** Stage advances. | ☐ | |
| O1.3 | On a **second** throwaway request: **Request changes**, fill note, **Send back to client**. | Changes requested; client sees the note. | ☐ | |

---

## O2 — Vehicle (Stage 3)

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| O2.1 | **Assign Vehicle**. Registration, type, driver. **Assign vehicle**. | **Vehicle assigned.** Stage 4. | ☐ | |

---

## O3 — Weighment and loading (Stage 4)

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| O3.1 | **Weigh** without photos. | Refused — slip + pickup photos required on weighbridge path. | ☐ | |
| O3.2 | Attach slip + pickup photos. Gross / tare / slip no. **Record weighment**. | Net = gross − tare. | ☐ | |
| O3.3 | **Loading complete** (if shown). | Loading confirmed. | ☐ | |

---

## O4 — Role boundaries (must Pass)

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| O4.1 | On a weighed, not-yet-invoiced request. | **Raise Invoice** is **absent** (or refused). | ☐ | |
| O4.2 | After factory Form 6 + CoD exists (use shared lifecycle after Super Admin upload). | **Upload Certificate** / **Certify for client** controls are **absent** (or refused). | ☐ | |
| O4.3 | Open `/masters` and `/compliance` directly. | Redirect or forbidden — no registers. | ☐ | |

---

## O5 — Reports and capacity

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| O5.1 | **Reports**: open Summary and at least one export. | Loads for ops scope. | ☐ | |
| O5.2 | **Capacity**. | Facility utilization visible. | ☐ | |
| O5.3 | **Recycling Heroes** / Sustainability. | Pages load. | ☐ | |

---

## Operations sign-off

| | |
|--|--|
| Cases executed | _____ of _____ |
| Pass / Fail / N/A / Blocked | _____ / _____ / _____ / _____ |
| Blockers found | Yes / No — IDs: |
| Fit for production as **Operations Manager** | ☐ Yes ☐ Yes, with waivers ☐ No |

| | Name | Signature | Date |
|--|------|-----------|------|
| Tester | | | |
| Urbeno operations lead | | | |
