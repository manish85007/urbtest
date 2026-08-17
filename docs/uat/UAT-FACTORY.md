# UAT-FACTORY — Factory manager

**Role:** Factory · goods receipt and recycling  
**Business rules:** stages 6–7 (MRN, Form 6), R1–R7, R4 (MRN is internal), capacity 80%/100%, X3 MFA for privileged roles, X11 no Compliance.

| Field | Value |
|-------|--------|
| Environment / URL | |
| Build / git SHA | |
| Tester name / facility | |
| Account used | `blr@urbeno.in` (Bengaluru). Scope check: `kgf@urbeno.in` if a second tester is available. |
| Password | `demo` unless rotated |
| Date (IST) | |
| Browser | |
| Shared lifecycle request ID | `REQ-` _____________ |
| Invoice number on that request | |

Factory testers often start from seeded **`REQ-00048`** (already invoiced) if the cross-role request has not reached stage 5 yet. Prefer the **shared new request** for sign-off.

---

## F0 — Sign-in, policies, shell

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| F0.1 | Sign in as `blr@urbeno.in`. Accept policies if prompted. | **Factory Dashboard**. Subtitle includes `URB-BLR` (or Bengaluru). | ☐ | |
| F0.2 | Navigation. | **Dashboard**, **Requests**, **Capacity**, **Reports**. No Masters, Audit, Compliance, Recycle Heroes, Sustainability. | ☐ | |
| F0.3 | Profile. | Role **Factory Manager**. Facilities list includes `URB-BLR`. **Two-factor authentication** card is present. | ☐ | |
| F0.4 | Direct URLs `/masters`, `/audit`, `/compliance`, `/impact`. | Redirect Home. Must not list clients, audit events, DSR, or client-only sustainability. | ☐ | |

---

## F1 — What factory must **not** do

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| F1.1 | **Requests** — is **New request** offered? | **No** (only client and admin create requests). | ☐ | |
| F1.2 | Open a stage-1 request (`REQ-00046` or the shared request before ack). | **Acknowledge Request** and **Request changes** are **absent**. | ☐ | |
| F1.3 | Open a weighed, not-yet-invoiced request (if available). | **Raise Invoice** is **absent**. | ☐ | |
| F1.4 | After a certificate exists: **Upload Certificate**. | Absent. Factory does not issue CoD. | ☐ | |

---

## F2 — Dashboard and request list

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| F2.1 | Dashboard tiles. | New / open requests, net weight, **Capacity Used**, payments pending. Tiles navigate to Requests / Reports / Capacity. | ☐ | |
| F2.2 | **Requests**. Open `REQ-00048` or the shared invoiced request. | Request detail loads. Invoice panel visible. **Create MRN** available while stage is 5 and no MRN exists. | ☐ | |

---

## F3 — MRN — goods receipt (Stage 6)

Rule R1: one MRN per invoice. R2: number format `MRN/[Factory]/[FY]/[0001]`, April–March. R3: no category at the gate.

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| F3.1 | Invoice panel → **Create MRN**. | Modal **Create MRN — {invoice no.}**. | ☐ | |
| F3.2 | Submit without required photos / security officer if the form requires them. | Refused with a specific message (not a blank error). | ☐ | |
| F3.3 | Enter **Security Officer**, attach the two photo inputs (gate / vehicle as labelled), **Record goods receipt (MRN)**. | Message **MRN created.** An MRN number is shown to **staff**. | ☐ | |
| F3.4 | Confirm MRN number shape. | Looks like `MRN/URB-BLR/…` (factory id + FY). Not editable by typing a duplicate. | ☐ | |
| F3.5 | Try **Create MRN** again on the same invoice. | Button gone or refused (one MRN per invoice). | ☐ | |
| F3.6 | Recycling SLA card (if shown). | 30-day target from receipt; state met / due-soon / breached as applicable. | ☐ | |

MRN number issued: _______________________

---

## F4 — Form 6 / recycling (Stage 7)

Rules R5–R6: category split **equals** billing weight; recovery fractions close per category.

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| F4.1 | **Process & Issue Form 6**. | Modal **Process Invoice**. Category select is populated from the factory authorisation. | ☐ | |
| F4.2 | Enter a split that does **not** total the invoice billing weight. **Issue Form 6**. | Refused. Message names the shortfall/overage in kg (kit style: every kilogram must land in an authorised category). | ☐ | |
| F4.3 | Correct the split so the total **equals** billing weight. Complete recovery fields if required. **Issue Form 6**. | Message **Recycling recorded.** Stage moves toward certificate. | ☐ | |
| F4.4 | Confirm Form 6 / processing record is visible to factory. | Categories and processed weight shown. | ☐ | |

---

## F5 — Capacity

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| F5.1 | **Capacity**. | Authorised entries for the facility. Utilization %; alerts at 80% / 100% if any line is there. | ☐ | |
| F5.2 | If signed in as `kgf@urbeno.in` (second tester). | Dashboard / capacity scoped to `URB-KGF`, not Bengaluru’s TPA as the only site. | ☐ | |

---

## F6 — Reports (staff)

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| F6.1 | **Reports** — confirm **MRN Register** is listed. | Present (staff-only). Export CSV. | ☐ | |
| F6.2 | Form 6 Log, Category Recovery. | Rows reflect the MRN/recycling just recorded. | ☐ | |
| F6.3 | Client filter (if shown). | Can narrow; does not expose Compliance. | ☐ | |

---

## F7 — Payment (staff may record)

The UI allows **admin or factory** to **+ Record Payment** once an invoice exists and is unpaid.

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| F7.1 | If the UAT plan assigns payment to **admin**, mark N/A. Otherwise **+ Record Payment**, UTR, amount, mode. | **Payment recorded.** Client can then close. | ☐ | |

---

## F8 — MFA (privileged role)

Kit X3: admin and factory require a second factor. Enrolment is on **Profile**. Unenrolled login may still succeed today; Control status will show MFA as not operating until someone enrols.

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| F8.1 | Profile → set up two-factor. Save the secret in an authenticator app. Confirm with a 6-digit code. | Enrolment succeeds. | ☐ | |
| F8.2 | Sign out. Sign in with password only. | Prompt for authenticator code (or equivalent). Wrong code refused. Correct code signs in. | ☐ | |
| F8.3 | If you must leave the shared `blr@urbeno.in` usable for others, disable MFA only after recording the result, or use a dedicated factory user created by admin. | Note what you left enabled. | ☐ | |

---

## Factory sign-off

| | |
|--|--|
| Cases executed | _____ of _____ |
| Pass / Fail / N/A / Blocked | _____ / _____ / _____ / _____ |
| Blockers found | Yes / No — IDs: |
| Fit for production as a **factory manager** | ☐ Yes ☐ Yes, with waivers ☐ No |

| | Name | Facility | Signature | Date |
|--|------|----------|-----------|------|
| Tester | | | | |
| Operations lead (optional) | | | | |
