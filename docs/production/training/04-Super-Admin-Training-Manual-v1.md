# Urb TecTrack — Super Admin Training Manual

| | |
|--|--|
| **Product** | Urb TecTrack™ |
| **Audience / role** | Super Admin (Urbeno Admin) |
| **Version** | **1** |
| **Portal** | https://tectrack.urbeno.in |
| **Support** | info@urbeno.in |
| **Confidentiality** | Highest sensitivity. Masters, Audit, and Compliance data must not be shared outside authorised Urbeno staff. |

---

## How to use this guide

Full-role training for production operators (about 90–120 minutes, or split across two sessions).

| Agenda block | Topics | Approx. |
|--------------|--------|---------|
| A | First login, MFA, full navigation | 10 min |
| B | Acknowledge → vehicles → weighment (ops overlap) | 15 min |
| C | Invoicing, payment | 15 min |
| D | After factory MRN/Form 6 — approve Form 6, CoD | 15 min |
| E | Masters & users (incl. client_readonly, auditor) | 20 min |
| F | Reports, Heroes, Capacity, backdating | 10 min |
| G | Audit & Compliance | 15 min |
| H | Sign-out, support, escalation | 5 min |

**Conventions:** numbered steps, **Expected outcome**, **Tip**. No passwords printed. Prefer throwaway users for password-lockout drills — never lock the shared production Super Admin.

---

## 1. Your role — full lifecycle ownership

Super Admin has **full operational and configuration access**:

- Stages **2–5** and **8** (acknowledge through billing, CoD), plus ability to perform factory actions when needed.  
- **Masters** — clients, sites, users, factories, categories, lookups, email templates.  
- **Audit** and **Compliance**.  
- **Backdating** pickup requests within the configured historical window (when enabled).  
- Staff-raised requests on behalf of a client.

You remain bound by business rules (weighment evidence, unique certificate numbers, payment before close, clients never see MRN, etc.).

---

## 2. First login

### 2.1 Access

| Item | Detail |
|------|--------|
| Portal | https://tectrack.urbeno.in |
| Email | `@urbeno.in` Super Admin account |
| Temporary password | System welcome email (or secure out-of-band reset) |

1. Sign in at https://tectrack.urbeno.in.  
2. Complete temporary-password change.  
3. Accept policies if prompted.

**Expected outcome:** **Operations Dashboard** (admin variant). Profile: **Urbeno Admin** / Super Admin. Letterhead / company profile editor may be visible (clients and factory must not see this).

### 2.2 MFA (mandatory)

1. **Profile** → enrol two-factor (authenticator preferred).  
2. Confirm with a 6-digit code.  
3. Re-login with password + MFA.

**Expected outcome:** Privileged MFA active. Compliance control status should reflect MFA operating once staff are enrolled.

**Tip:** Keep a break-glass process with a second Super Admin. Do not disable MFA on production shared accounts without a recorded reason.

---

## 3. Navigation overview

| Item | Purpose |
|------|---------|
| **Dashboard** | New requests, active work, ops overview |
| **Requests** | Full lifecycle actions on request detail |
| **Recycling Heroes** | Plantings and milestones |
| **Sustainability** | Impact views |
| **Capacity** | Facility utilisation / overrides |
| **Reports** | Full report catalogue |
| **Masters** | Clients, users, factories, categories, lookups, email |
| **Audit** | Mutation trail |
| **Compliance** | Controls, security events, access review, DSR, retention, evidence |

---

## 4. What you can and cannot do

### You can

- Acknowledge, request changes, reject; assign vehicles; weigh.  
- Raise / edit invoices; record payments; upload CoD.  
- Create MRN and manage recycling / Form 6 (including approve / reject Form 6 as designed).  
- Create requests for any client; **backdate** within policy when `backdateRequests` applies.  
- Manage all master data and users — roles include **admin**, **operations**, **factory**, **client**, **client_readonly**, **auditor**.  
- Run Audit and Compliance workflows.  
- Force-close only when policy allows (e.g. 60+ days after first certificate) and never while money is outstanding.

### You should not / cannot bypass

- Close as a substitute for the client on a normal path — clients **Review & Close** after payment + CoD.  
- Issue duplicate certificate numbers or silent billing-weight deviations.  
- Delete sites that are referenced — **deactivate** instead.  
- Share temporary passwords in tickets or group chat; use secure channels.  
- Invent credentials in documentation or training decks.

---

## 5. Workflow — Acknowledge, vehicles, weighment

These steps match Operations Manager practice; Super Admin can always perform them.

1. **Dashboard** → open a stage-1 request → **Acknowledge Request**.  
2. **Assign Vehicle**(s) with registration, type, driver details.  
3. **Weigh** each vehicle (slip + pickup photos; net = gross − tare). Complete loading acknowledgement if shown.

**Expected outcome:** Request ready for billing (stage path toward invoicing).

**Tip:** Use **Request changes** with a clear note when client data is wrong — do not invent site details on their behalf.

---

## 6. Workflow — Raise invoice (Stage 5)

Rules: tax derived from taxable value + rate master; e-way bill per invoice; billing weight anchored to weighment (deviation note if different); invoice numbers unique within the request.

1. Click **Raise Invoice**.  
2. Enter invoice number, taxable amount, tax rate, e-way bill number/date/PDF as required.  
3. Confirm billing weight (default vehicle net) and deviation note if it differs.  
4. **Create invoice**.

**Expected outcome:** Message **Invoice created.** Totals calculated. Multiple invoices may split one pickup; sum of billing weights must reconcile to total weighment.

**Tip:** After invoices exist, Factory can create MRN. Coordinate so goods are not waiting at the gate without an invoice.

---

## 7. Workflow — After factory MRN and Form 6

1. Confirm Factory completed **MRN** and **Issue Form 6**.  
2. If Form 6 awaits admin review, **Approve** (or reject with reason for factory revision) per UI.  
3. When recycling is approved, **Upload Certificate**. Attach signed CoD PDF, unique certificate number, date.  
4. **Upload & email certificate** (or equivalent).  
5. **+ Record Payment** (UTR, amount, mode) so the client can close.  
6. Leave normal closure to the **Client User** (**Review & Close**).

**Expected outcome:** Certificate uploaded; client emailed when mail works; payment clears outstanding; client closes to stage 9. Duplicate certificate numbers across the whole system are refused.

**Tip:** Several certificates may sit on one invoice (different client departments). Force-close is a last resort and is blocked if unpaid or too early under the 60-day rule.

---

## 8. Workflow — Staff-created and backdated requests

1. **Requests** → new request. **Client** dropdown is present for Super Admin.  
2. Select client/site and complete the form. Submit.  
3. For historical catch-up (when enabled): set pickup date within the allowed historical window from configuration (`HISTORICAL_REQUEST_FROM` / backdate permission). Operations cannot do this.

**Expected outcome:** `REQ-` issued and visible to that client’s users. Backdated dates outside the window are refused.

**Tip:** Document why a backdated request was raised (audit trail already captures who/when; keep the business reason in notes).

---

## 9. Masters — Clients, factories, lookups

1. **Masters → Clients & Sites** — create/edit clients (4-letter codes; reserved prefixes like `URB` / `ADM` / `SYS` / `TEST` refused). Deactivate sites rather than deleting.  
2. **Factory Sites** — addresses, MRN format context, facility identifiers.  
3. **Category Master** — authorised entries per facility.  
4. **Lookup Lists** — vehicle types, tax rates, payment modes used in the lifecycle.  
5. **Email & Templates** — review templates; process outbox / queue if mail is queued.

**Expected outcome:** Lifecycle dropdowns stay populated; clients and factories match real operations.

---

## 10. Masters — Users (including client_readonly and auditor)

1. **Masters → Users →** create or edit a user.  
2. Choose role:

| Role | Typical use |
|------|-------------|
| **Super Admin (`admin`)** | Full access |
| **Operations Manager** | Ack, vehicles, weighment, reports |
| **Factory Manager** | MRN, Form 6, capacity; assign facilities |
| **Client User (`client`)** | Raise / close; operational emails |
| **Client Read Only (`client_readonly`)** | View + Form 6/CoD download; **no** raise/close; **no** new-request emails |
| **Auditor** | Cross-client read, reports, audit/compliance visibility without mutating lifecycle |

3. Staff / auditor emails must be `@urbeno.in`. Client roles bind to a client organisation.  
4. Save. A **welcome email** with temporary password is sent automatically when mail is configured.  
5. If email fails, use **Reset password** and share the temporary password **securely out-of-band**.

**Expected outcome:** User appears active; first login forces password change. Report permission checkboxes follow role defaults unless you customise.

**Tip:** Prefer Client Read Only for leadership who should not raise pickups or receive new-request mail. Prefer Auditor for independent review without Masters write access.

---

## 11. Recycling Heroes and Capacity

1. **Recycling Heroes → Record Planting** — save plantings with photos/dates as required.  
2. **Capacity** — monitor utilisation; overrides require a reason and are logged.

**Expected outcome:** Client Heroes/Sustainability reflect impact from **closed** tonnes plus planting sequestration rules.

---

## 12. Reports

1. Open **Reports**.  
2. Exercise Summary, Complete Request Summary, Invoices, **MRN**, Form 6, Certificates, Category, Sustainability, Heroes, Serials, Capacity as available.  
3. Export CSV; use period filters.

**Expected outcome:** Full catalogue loads. Treat MRN exports as internal-only.

---

## 13. Audit

1. Open **Audit**.  
2. Filter by `REQ-` id, user email, or date.  
3. **Export CSV**.

**Expected outcome:** Mutations (acknowledge, weigh, invoice, CoD, master changes) appear with actor and timestamp (rule A1).

---

## 14. Compliance (admin-only)

Work through the Compliance areas your organisation uses in production:

1. **Control status** — Operating / Needs attention / Not operating.  
2. **Security events** — failed sign-ins, access denied; export as needed.  
3. **Access review** — start review, confirm or withdraw each account, complete only when every line is decided.  
4. **Incidents** — record with root cause and corrective action before closing.  
5. **Privacy & DSR** — log access/erasure-style requests, look up, export, close with outcome.  
6. **Retention** — record disposals (nothing auto-deletes without process).  
7. **Evidence pack** / audit chain verify when offered.

**Expected outcome:** Controls and evidence support regulatory posture. Incomplete incident/DSR closures are refused until required fields are filled.

**Tip:** Run access reviews on a calendar. Withdrawal deactivates accounts — confirm before completing.

---

## 15. Signing out

1. Avatar → **Sign out**.  
2. Never leave a Super Admin session unlocked on a shared machine.

**Expected outcome:** Login screen; MFA on next sign-in.

---

## 16. Support and escalation

| Need | Contact |
|------|---------|
| Platform / production incidents | info@urbeno.in + your internal ops channel |
| Portal | https://tectrack.urbeno.in |
| Client onboarding nominations | Use production welcome email template; create users in Masters |

When escalating, include environment (**production**), `REQ-` / invoice / certificate numbers, and steps already tried — **never** passwords.

---

## Appendix A — Nine-stage lifecycle ownership

| # | Stage | Primary actor |
|---|-------|----------------|
| 1 | Request | Client User (or Super Admin on behalf) |
| 2 | Acknowledge | Operations / Super Admin |
| 3 | Assign vehicle | Operations / Super Admin |
| 4 | Load & weigh | Operations / Super Admin |
| 5 | Billing | Super Admin |
| 6 | MRN | Factory (Super Admin can) |
| 7 | Recycling / Form 6 | Factory (+ Super Admin approve) |
| 8 | CoD upload | Super Admin |
| 9 | Closed | Client User |

---

## Appendix B — Role matrix (summary)

| Capability | Client | Client RO | Ops | Factory | Super Admin | Auditor |
|------------|--------|-----------|-----|---------|-------------|---------|
| Raise / close | Yes | No | No | No | Staff create; client closes | No |
| Ack / vehicles / weigh | No | No | Yes | No | Yes | No |
| Invoice / CoD | No | No | No | No | Yes | No |
| MRN / Form 6 | No | View Form6/CoD | No | Yes | Yes | View |
| Masters | No | No | No | No | Yes | No |
| Audit / Compliance | No | No | No | No | Yes | Read as permitted |
| MFA typical | No | No | Yes | Yes | Yes | Per policy |

---

## Document control

**Version 1** | Urb TecTrack | https://tectrack.urbeno.in  
Support: info@urbeno.in · Confidential — authorised users only
