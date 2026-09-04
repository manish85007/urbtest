# Urb TecTrack — Factory Manager Training Manual

| | |
|--|--|
| **Product** | Urb TecTrack™ |
| **Audience / role** | Factory Manager |
| **Version** | **1** |
| **Portal** | https://tectrack.urbeno.in |
| **Support** | info@urbeno.in |
| **Confidentiality** | Internal Urbeno / facility use. MRN details are staff-only — never share MRN numbers with clients. |

---

## How to use this guide

Use for self-paced learning or a live facility training (about 45–60 minutes).

| Agenda block | Topics | Approx. |
|--------------|--------|---------|
| A | First login, MFA, navigation | 10 min |
| B | Dashboard and request list | 5 min |
| C | Create MRN (goods receipt) | 15 min |
| D | Process & Issue Form 6 | 15 min |
| E | Capacity, reports, payment note | 10 min |
| F | Sign-out and support | 5 min |

**Conventions:** numbered steps, **Expected outcome**, and **Tip**. No passwords are printed here.

---

## 1. Your role in the lifecycle

Factory Managers own **Stage 6 (MRN)** and **Stage 7 (Form 6 / recycling)** for invoices that have already been billed by Urbeno.

| You own | Others own |
|---------|------------|
| Goods receipt (MRN) | Client raise / close |
| Category split & Form 6 | Acknowledge, vehicles, weighment |
| Facility capacity view | Invoice raise / CoD upload (Super Admin) |
| Factory reports (incl. MRN Register) | Masters, Audit, Compliance |

**Rule reminder:** Clients **never** see MRN numbers (internal receiving record).

---

## 2. First login

### 2.1 Access

| Item | Detail |
|------|--------|
| Portal | https://tectrack.urbeno.in |
| Email | Your `@urbeno.in` staff address |
| Temporary password | From Urb TecTrack welcome email |

1. Open https://tectrack.urbeno.in and sign in with email + temporary password.  
2. Set a new password when the **temporary password** gate appears.  
3. Accept policies if prompted.

**Expected outcome:** **Factory Dashboard**. Subtitle / facility context shows your assigned site(s) (e.g. Bengaluru / `URB-BLR`). Profile role: **Factory Manager**.

### 2.2 MFA (required for staff)

Factory Managers **must** enrol two-factor authentication.

1. Open **Profile**.  
2. Under **Two-factor authentication**, set up an authenticator app (or email method if offered) and confirm with a 6-digit code.  
3. Sign out and sign in again with password **plus** MFA code to verify.

**Expected outcome:** Enrolment succeeds. Subsequent logins require the second factor. Wrong codes are refused.

**Tip:** Complete MFA within the staff grace window shown on screen. Unenrolled privileged accounts may be blocked from normal use once the gate is enforced.

### 2.3 Password policy

Profile password changes must meet complexity rules; recent passwords cannot be reused. Do not use shared “demo” style passwords in production.

---

## 3. Navigation overview

| Item | Purpose |
|------|---------|
| **Dashboard** | New / open work, net weight, capacity used, payments pending |
| **Requests** | Open consignments; perform MRN and Form 6 on invoice panels |
| **Capacity** | Authorised category utilisation for your facility |
| **Reports** | MRN Register, Form 6 Log, Category Recovery, serials, etc. |

You should **not** see: Masters, Audit, Compliance, Recycling Heroes, or client Sustainability as primary nav (those are admin / client experiences).

---

## 4. What you can and cannot do

### You can

- Open requests across clients (staff scope) for factory work.  
- **Create MRN** once per invoice after billing.  
- **Process & Issue Form 6** (category split equalling billing weight).  
- View and work capacity utilisation for assigned facilities.  
- Run factory reports including **MRN Register**.  
- Optionally **Record Payment** when the UI allows factory to do so (confirm with operations if payment is owned by Super Admin).

### You cannot

- Raise new client requests (no New Request for factory).  
- Acknowledge / request changes / assign vehicles / weigh / raise invoices.  
- Upload Certificate of Destruction.  
- Edit MRN after creation (create only; corrections go through Super Admin process if needed).  
- Access Masters, Audit, or Compliance.  
- Expose MRN numbers to clients (system hides them; do not paste into client emails).

---

## 5. Workflow — Dashboard and find work

1. Open **Dashboard**. Review tiles (new/open, weight, **Capacity Used**, payments pending).  
2. Click a tile or open **Requests**.  
3. Find an invoiced request ready for goods receipt (stage **Billing** / awaiting MRN). Open the request detail.

**Expected outcome:** Invoice panel visible. **Create MRN** available when the invoice has no MRN yet.

**Tip:** Prefer working from a known `REQ-` / invoice number supplied by Operations. Filter the list if many active consignments exist.

---

## 6. Workflow — Create MRN (Stage 6)

Business rules: **one MRN per invoice**; number format `MRN/[Factory]/[FY]/[0001]` (April–March FY); **no category assignment** at the gate.

1. On the invoice panel, click **Create MRN**.  
2. Modal title resembles **Create MRN — {invoice no.}**.  
3. Enter **Security Officer** (and any other required fields).  
4. Attach the required photographs (gate / vehicle as labelled).  
5. Submit **Record goods receipt (MRN)**.

**Expected outcome:** Message **MRN created.** An MRN number is shown to **staff**. Recycling SLA card may show a 30-day target from receipt (met / due-soon / breached).

**Tip:** Submitting without required photos / officer is refused with a specific message — fix the named field rather than retrying blindly. Trying Create MRN again on the same invoice should be blocked (already exists).

---

## 7. Workflow — Process & Issue Form 6 (Stage 7)

Rules: category split must **exactly equal** invoice billing weight; recovery fractions must close per category where required; categories come from the facility authorisation. Processing date is today or earlier (not future). Super Admin may historical-backdate from **2026-04-01** when covering; Factory day-to-day uses the normal past-or-today rule.

1. On the same invoice, click **Process & Submit Form 6 for Review** (or **Process & Issue Form 6** when offered).  
2. In **Process Invoice**, set **Processing Date**, select authorised categories, and enter weights that sum to billing weight.  
3. Complete recovery fields if the form requires them.  
4. Submit for admin review (or Issue when permitted).

**Expected outcome:** Message **Recycling recorded** (or equivalent). Form 6 / processing record visible with categories and processed weight. Stage moves toward certificate. Admin approval may be required before CoD upload and before clients can download Form 6 — coordinate with Super Admin if status shows awaiting approval.

**Negative check (training):** Enter a split that does **not** total billing weight → issue is refused with a message naming the shortfall/overage in kg. Correct and re-issue.

**Tip:** “Every kilogram received has to land in an authorised category.” Do not approximate; adjust the split until the total matches.

---

## 8. Workflow — Capacity

1. Open **Capacity**.  
2. Review authorised entries for your facility and utilisation %.  
3. Note alerts at **80%** and **100%** of an authorised entry.

**Expected outcome:** Facility-scoped data. If you are assigned only one site, you do not manage another factory’s TPA as your primary view.

**Tip:** Crossing an authorised limit requires an explicit override with a logged reason (when that control is exercised by authorised staff). Prefer planning capacity before the gate is blocked.

---

## 9. Workflow — Reports

1. Open **Reports**.  
2. Confirm **MRN Register** is listed (staff-only). Export CSV.  
3. Open **Form 6 Log** and **Category Recovery** (and other factory-visible reports). Filter by client/period if shown.

**Expected outcome:** Rows reflect MRNs and recycling you recorded. No Compliance module access from this role.

**Tip:** Export MRN Register for internal audits; never attach MRN CSVs to client-facing mail.

---

## 10. Payment (when assigned to factory)

If Operations asks factory to record payment:

1. On an unpaid invoice with CoD path in progress or complete, use **+ Record Payment**.  
2. Enter UTR, amount, and mode. Save.

**Expected outcome:** **Payment recorded.** Client can then **Review & Close**.

**Tip:** If your site SOP assigns payment only to Super Admin, mark this section N/A and leave payment to them.

---

## 11. Signing out

1. Avatar / name → **Sign out**.  
2. On shared facility PCs, always sign out after the shift.

**Expected outcome:** Login screen. Next login requires password + MFA.

---

## 12. Support

| Need | Contact |
|------|---------|
| Account / MFA lockout | info@urbeno.in or Super Admin |
| Portal | https://tectrack.urbeno.in |
| Process disputes (weight / category) | Operations / Super Admin with `REQ-` and invoice no. |

Never include passwords in email. Never send MRN numbers to client mailboxes.

---

## Appendix — Boundaries vs Super Admin / Operations

| Action | Factory | Operations | Super Admin |
|--------|---------|------------|-------------|
| Acknowledge / vehicles / weigh | No | Yes | Yes |
| Raise invoice / upload CoD | No | No | Yes |
| Create MRN / Issue Form 6 | Yes | No | Yes |
| Masters / Audit / Compliance | No | No | Yes |
| Capacity | Yes (facility) | View (nav) | Yes |

---

## Document control

**Version 1** | Urb TecTrack | https://tectrack.urbeno.in  
Support: info@urbeno.in · Confidential — authorised users only
