# UAT-ADMIN — Urbeno administrator

**Role:** Admin · operations, masters, audit, compliance  
**Business rules:** stages 2–5 and 8, W1–W3, B1–B4, C1–C6, A1–A4, X1–X11, Masters, letterhead.

| Field | Value |
|-------|--------|
| Environment / URL | |
| Build / git SHA | |
| Tester name | |
| Account used | `admin@urbeno.in` (primary). Keep `ops@urbeno.in` as backup. |
| Password | `demo` unless rotated |
| Date (IST) | |
| Browser | |
| Shared lifecycle request ID | `REQ-` _____________ |

Create a **throwaway user** in Masters before password-lockout tests so `demo` accounts stay shared.

---

## A0 — Sign-in, policies, shell

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| A0.1 | Sign in as `admin@urbeno.in`. Accept policies if prompted. | **Operations Dashboard**. | ☐ | |
| A0.2 | Navigation. | **Dashboard**, **Requests**, **Recycle Heroes**, **Capacity**, **Masters**, **Reports**, **Audit**, **Compliance**. | ☐ | |
| A0.3 | Profile. | Role **Urbeno Admin**. Letterhead / company form is visible (factory/client must not see this editor). | ☐ | |

---

## A1 — Dashboard and acknowledge (Stage 2)

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| A1.1 | Dashboard **New Requests** tile. | Count matches stage-1 list. Clicking opens filtered requests. | ☐ | |
| A1.2 | Open the shared new request (or `REQ-00046`). **Acknowledge Request** → modal **Acknowledge**. | Message **Request acknowledged.** Stage 3. Client receives / queue shows acknowledgement email if mail is configured. | ☐ | |
| A1.3 | On a **second** throwaway request: **Request changes**, fill **Note to client**, **Send back to client**. | Message **Changes requested from client.** Stage stays 1. Client sees the note. | ☐ | |

---

## A2 — Vehicle (Stage 3)

Header **Assign Vehicle** is shown to **staff** (admin and factory) at stage 3. Admin should still execute this on the sign-off request.

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| A2.1 | **Assign Vehicle**. Registration, type, driver name, driver phone. **Assign vehicle**. | Message **Vehicle assigned.** Stage 4. | ☐ | |
| A2.2 | Optional: add a second vehicle if the UI allows. | Both listed; weighment will be per vehicle. | ☐ | |

---

## A3 — Weighment (Stage 4) — W1 / W2 / W3

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| A3.1 | **Weigh**. Submit weighbridge path with **no** files. | Refused. Slip photograph **and** pickup photograph are mandatory. | ☐ | |
| A3.2 | Attach slip + pickup photos. Gross `5200`, tare `5125`, slip no. `WB-UAT-…`. **Record weighment**. | Message **Weighment recorded.** **Net is 75 kg** (gross − tare), not a typed net. | ☐ | |
| A3.3 | If testing **manual** weighment: method + written reason + pickup photo; no slip. | Accepted only with a written reason; pickup photo still required. | ☐ | |

---

## A4 — Invoice (Stage 5) — B1–B4

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| A4.1 | **Raise Invoice**. Invoice no., taxable amount, tax rate from master, e-way bill no. (and date/PDF if required). **Create invoice**. | Message **Invoice created.** Tax value and **total are calculated**. Billing weight defaults to vehicle net. | ☐ | |
| A4.2 | Try a second invoice with the **same invoice number** on this request. | Refused (unique within request). | ☐ | |
| A4.3 | If billing weight ≠ vehicle net, a **deviation note** is required. | Cannot save a silent difference. | ☐ | |

Invoice number: _______________________

---

## A5 — After factory MRN / Form 6 — certificate and payment (Stages 8–9 prep)

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| A5.1 | Confirm factory completed MRN + Form 6 on this invoice. | Recycling present. **Upload Certificate** available. | ☐ | |
| A5.2 | **Upload Certificate**. Attach PDF/image, unique certificate no., date. **Upload & email certificate** (or equivalent). | Message **Certificate uploaded.** Duplicate certificate number across the system is refused (C2). | ☐ | |
| A5.3 | **Masters → Email & Templates** (or Email queue) → **Process queue** if mail is console/queued. | Certificate email to the client is queued or sent (C4). | ☐ | |
| A5.4 | **+ Record Payment**. UTR, amount covering the total, mode. **Record payment**. | **Payment recorded.** Outstanding zero. | ☐ | |
| A5.5 | Do **not** close as admin unless testing force-close. Client performs **Review & Close**. | Admin can see close status after the client acts. | ☐ | |
| A5.6 | **Force close (60+ days)** on a fresh invoice that is **not** 60 days past first certificate. | Refused: admin force-close only 60 days after first certificate. Outstanding money also blocks close (C6). | ☐ | |

Certificate number: _______________________

---

## A6 — Masters

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| A6.1 | **Masters → Clients & Sites**. Open TechCorp. Sites are listed. Deactivate is offered; **delete** is not the happy path (A3). | Site remains historically referenced. | ☐ | |
| A6.2 | **New Client** with a 4-letter code that is not `URB`/`ADM`/`SYS`/`TEST`. | Client created. Invalid/reserved code refused. | ☐ | |
| A6.3 | **Users →** create `uat.factory@urbeno.in` (or similar) role factory, assign `URB-BLR`, password meeting policy **or** temporary `demo` if the form still allows tester-created `demo`. | User appears. Can sign in. | ☐ | |
| A6.4 | **Factory Sites**. MRN format hint visible. Edit Bengaluru address; save. | **Factory updated.** | ☐ | |
| A6.5 | **Category Master**. Filter by factory. Open one line. | Authorised TPA / activity visible. | ☐ | |
| A6.6 | **Lookup Lists**. Confirm vehicle types / tax rates / payment modes used in A2–A5 exist. | No empty required dropdowns in the lifecycle. | ☐ | |
| A6.7 | **Email & Templates**. View a template. Process outbox. | Queue processes without crashing. Console provider logs mail if SMTP is unset. | ☐ | |

Throwaway user created: _______________________

---

## A7 — Reports, Audit, Heroes, Capacity

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| A7.1 | **Reports**: Summary, Invoices, **MRN**, Form 6, Certificates, Category, Sustainability, Heroes. Export CSV on at least two. | All load. Period picker works. | ☐ | |
| A7.2 | **Audit**. Filter by the shared `REQ-` id or your email. **Export CSV**. | Mutations from acknowledge / weigh / invoice appear (A1). | ☐ | |
| A7.3 | **Recycle Heroes → Record Planting**. Save a test planting. | Planting listed. Client Heroes/Sustainability can see impact only for **closed** tonnes. | ☐ | |
| A7.4 | **Capacity**. | Facility utilization; override (if tested) requires a reason and is logged. | ☐ | |

---

## A8 — Compliance (admin-only) — X1–X11

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| A8.1 | **Compliance → Control status**. | Table of controls with Operating / Needs attention / Not operating. Hash-chained audit should not be “Not operating”. MFA may be Not operating until A9. Backup may be Needs attention (hosting control). | ☐ | |
| A8.2 | **Security events**. Filter failed sign-ins. **Export CSV**. | Events include `auth.failed` / `access.denied` after C1.2 tenancy test. | ☐ | |
| A8.3 | **Access review → Start a review**. **Confirm** each line (or **Withdraw** one throwaway with a reason). **Complete review** disabled while any line is undecided. | Review closes only when every account has a decision. Withdrawal deactivates that account. | ☐ | |
| A8.4 | **Incidents → + Record an incident**. Try **closed** without root cause and corrective action. | Refused (X6). Then fill both and save. Seeded `INC-0001` may already exist. | ☐ | |
| A8.5 | **Privacy & DSR**. Log a request kind `access` for `priya@techcorp.in`. **Look up** that email. **Export as JSON**. Close the DSR with an outcome. | Due date ~30 days. Cannot close without outcome (X8). Seeded `DSR-0001` may already be closed. | ☐ | |
| A8.6 | **Retention → Record a disposal**. Method, approved by, what was disposed. | Disposal saved. Nothing auto-deletes. | ☐ | |
| A8.7 | **Evidence pack (JSON)** and audit chain verify. | JSON downloads. Chain reports ok (or names the broken seq — **Fail** if broken on a clean UAT DB). | ☐ | |

---

## A9 — MFA and password policy (use throwaway user)

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| A9.1 | Profile (admin) → enrol TOTP. Sign out. Sign in with password + 6-digit code. | MFA required after enrolment. | ☐ | |
| A9.2 | On throwaway user: change password to `password` or email local-part. | Refused with kit-style “Your new password needs …”. | ☐ | |
| A9.3 | Set a valid password (`UatTrack1x` or similar). Sign in with it. | Success. Reuse of the same password as one of last 5 is refused. | ☐ | |
| A9.4 | **Lockout:** on a spare client (e.g. `anand@bharatretail.in`) enter wrong password **5** times. | Account locked ~15 minutes. Further attempts refused. Do not lock shared admin. | ☐ | |

---

## A10 — Admin-created request

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| A10.1 | Requests → new request. **Client** dropdown is present. Create for TechCorp. | `REQ-` issued. Appears in that client’s list. | ☐ | |

---

## Admin sign-off

| | |
|--|--|
| Cases executed | _____ of _____ |
| Pass / Fail / N/A / Blocked | _____ / _____ / _____ / _____ |
| Blockers found | Yes / No — IDs: |
| Fit for production as **admin / operations** | ☐ Yes ☐ Yes, with waivers ☐ No |

| | Name | Signature | Date |
|--|------|-----------|------|
| Tester | | | |
| Urbeno operations lead | | | |
