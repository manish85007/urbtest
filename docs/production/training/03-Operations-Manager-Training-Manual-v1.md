# Urb TecTrack — Operations Manager Training Manual

| | |
|--|--|
| **Product** | Urb TecTrack™ |
| **Audience / role** | Operations Manager |
| **Version** | **1** |
| **Portal** | https://tectrack.urbeno.in |
| **Support** | info@urbeno.in |
| **Confidentiality** | Internal Urbeno use. Client data is confidential; do not export beyond operational need. |

---

## How to use this guide

Self-paced or live training (about 50–70 minutes). Focus on the field-to-weighment path and clear handoffs to Factory and Super Admin.

| Agenda block | Topics | Approx. |
|--------------|--------|---------|
| A | First login, MFA, navigation vs Super Admin | 10 min |
| B | Dashboard, acknowledge, request changes / reject | 15 min |
| C | Assign vehicles | 10 min |
| D | Weighment (bridge + manual) | 15 min |
| E | Capacity view, Heroes, Sustainability, Reports | 10 min |
| F | Boundaries, sign-out, support | 5 min |

**Conventions:** numbered steps, **Expected outcome**, **Tip**. No passwords in this document.

---

## 1. Your role — limited vs Super Admin

Operations Managers run the **early operational lifecycle**: acknowledge (or send back / reject), assign vehicles, and record weighment. You also use **reports** and impact views.

You are **not** a Super Admin. You typically **do not**:

- Manage **Masters** (clients, users, factories, lookups, email templates)  
- Create **MRN** or **Issue Form 6**  
- **Raise invoices** or **upload Certificate of Destruction**  
- Open **Audit** or **Compliance** modules  
- **Backdate** historical pickup requests  
- Create requests on behalf of clients as staff (Super Admin capability)

Hand off to **Factory** after billing exists (billing is Super Admin), and to **Super Admin** for invoice / CoD / masters / compliance.

---

## 2. First login

### 2.1 Access

| Item | Detail |
|------|--------|
| Portal | https://tectrack.urbeno.in |
| Email | Your `@urbeno.in` address |
| Temporary password | Urb TecTrack welcome email |

1. Sign in at https://tectrack.urbeno.in.  
2. Replace the temporary password when prompted.  
3. Accept policies if shown.

**Expected outcome:** **Operations Dashboard**. Profile role reflects Operations Manager / Urbeno · Operations.

### 2.2 MFA (required)

1. Open **Profile** → **Two-factor authentication**.  
2. Enrol authenticator (or email OTP if offered) and confirm.  
3. Verify on next login with password + code.

**Expected outcome:** Staff MFA gate satisfied. Grace reminder disappears after enrolment.

**Tip:** Treat MFA reset / lockout via Super Admin or info@urbeno.in — do not share backup codes in chat.

---

## 3. Navigation overview

| Item | Purpose |
|------|---------|
| **Dashboard** | Awaiting ack, active work, operational overview |
| **Requests** | Acknowledge, vehicles, weighment on request detail |
| **Recycling Heroes** | Impact / planting visibility |
| **Sustainability** | Environmental impact views |
| **Capacity** | Facility utilisation (read / operational awareness) |
| **Reports** | Operational and admin-style reports allowed for ops |

**Not in your nav:** Masters, Audit, Compliance.

---

## 4. What you can and cannot do

### You can

- **Acknowledge** stage-1 requests.  
- **Request changes** (send back to client with a note) and **reject** where the UI provides reject.  
- **Assign / manage vehicles** for a pickup.  
- **Record weighment** (weighbridge or manual with reason) and upload required photos.  
- View capacity, Heroes, Sustainability.  
- Run **reports** (summary, invoices, complete lifecycle, sustain, heroes, serials, etc. as permitted).  
- See work across clients (staff scope).

### You cannot (typical production permissions)

- Raise or edit invoices (`manageInvoices` is Super Admin).  
- Create or edit MRN; issue Form 6 / recycling.  
- Upload CoD.  
- Create or backdate staff-raised historical requests.  
- Manage users/clients in Masters.  
- Use Audit / Compliance consoles.

**Tip:** If a button you expect is missing, check role — do not assume a UI bug. Escalate to Super Admin for billing / CoD / masters.

---

## 5. Workflow — Dashboard and acknowledge (Stage 2)

1. Open **Dashboard**. Check **Awaiting ack** / **New Requests** tile.  
2. Open the stage-1 request.  
3. Click **Acknowledge Request** → confirm in the **Acknowledge** modal.

**Expected outcome:** Message **Request acknowledged.** Stage moves toward vehicle assignment. Client may receive acknowledgement notification when mail is configured.

**Tip:** Read quantity, weight, site, and notes before acknowledging. If data is incomplete, use **Request changes** instead of acknowledging.

---

## 6. Workflow — Request changes / reject

### Send back for changes

1. On a stage-1 (or eligible) request, click **Request changes**.  
2. Fill **Note to client** with concrete corrections needed.  
3. **Send back to client**.

**Expected outcome:** Message confirming changes requested. Stage stays at request. Client sees the note and can edit / resubmit.

### Reject

1. Use **Reject** (when available) only for consignments that will not proceed.  
2. Provide the reason required by the form.

**Expected outcome:** Request is rejected per system rules; client visibility updates accordingly.

**Tip:** Prefer “request changes” for fixable data issues; reserve reject for true cancellations.

---

## 7. Workflow — Assign vehicles (Stage 3)

**Date rule:** Expected pickup must be **today or a future date**. Super Admin can backdate expected pickup for historical FY upload (from **2026-04-01**); Operations cannot.

1. On an acknowledged request, click **Assign Vehicle**.  
2. Enter **registration**, **type**, **driver name**, **driver phone** (and any other required fields).  
3. **Assign vehicle**.  
4. Add additional vehicles if the pickup needs more than one.

**Expected outcome:** Message **Vehicle assigned.** Vehicles listed on the request; stage advances toward load & weigh. Weighment will be **per vehicle**.

**Tip:** Assign as many vehicles as the pickup needs up front when known — each carries its own team and weighment.

---

## 8. Workflow — Weighment (Stage 4)

**Date rule:** Weighment date is **today** for Operations. Super Admin may historical-backdate weighment from **2026-04-01** for FY catch-up.

Photographic evidence rules: weighbridge needs **slip photo + pickup photo**; net weight is **gross − tare** (computed, not typed). Manual weighment needs a **written reason** and pickup photo.

### Weighbridge path

1. Open the vehicle → **Weigh** (or **Record weighment**).  
2. Attach slip photograph and pickup photograph.  
3. Enter gross, tare, slip number as labelled.  
4. Save.

**Expected outcome:** Message **Weighment recorded.** Net kg equals gross minus tare. After **all** vehicles are weighed (and loading complete acknowledgement if required by UI), invoicing can be unlocked for Super Admin.

### Manual path (no weighbridge)

1. Select manual weighment.  
2. Enter recorded weight, method, and **written reason**.  
3. Attach pickup photograph.  
4. Save.

**Expected outcome:** Accepted only with reason + pickup evidence.

**Negative check:** Submit weighbridge without files → refused. Fix attachments before retrying.

**Tip:** After every vehicle is weighed, complete any **Acknowledge loading complete** step shown so Super Admin can raise invoices. Do not leave consignments stuck at “awaiting loading complete.”

---

## 9. Handoff after weighment

When weighment (and loading complete) is done:

1. Confirm net weights look correct on the request.  
2. Notify Super Admin (or follow your SOP) that the request is ready for **billing**.  
3. Factory cannot create MRN until invoices exist — billing is not an Operations permission.

**Expected outcome:** Clear handoff; no attempt to create invoice/MRN from the Operations role.

---

## 10. Capacity, Heroes, Sustainability

1. **Capacity** — monitor facility utilisation so planning stays ahead of 80%/100% alerts.  
2. **Recycling Heroes** — review tonnage / tree milestones.  
3. **Sustainability** — review impact methodology; closed consignments drive client-facing numbers.

**Expected outcome:** Views load without Masters/Audit. You may not record Urbeno-wide plantings if that control is admin-only — follow on-screen buttons.

---

## 11. Reports

1. Open **Reports**.  
2. Run Request Summary, Complete Request Summary, Invoice Register, Sustainability, Heroes, Device Serials, etc. as listed.  
3. Export CSV for ops reviews; filter by period / client when available.

**Expected outcome:** Cross-client staff visibility for operational reporting. MRN / Form 6 detail appears in complete / factory-oriented exports where permitted — treat MRN as internal.

**Tip:** Do not send MRN-bearing exports to client contacts.

---

## 12. Signing out

1. Avatar → **Sign out**.  
2. Always sign out on shared ops workstations.

**Expected outcome:** Login screen; MFA required on next entry.

---

## 13. Support

| Need | Contact |
|------|---------|
| Access / MFA | info@urbeno.in or Super Admin |
| Portal | https://tectrack.urbeno.in |
| Billing / CoD / Masters | Super Admin |
| MRN / Form 6 | Factory Manager |

Include `REQ-` and vehicle registration in tickets. Never include passwords.

---

## Appendix — Permission snapshot (Operations vs Super Admin)

| Capability | Operations | Super Admin |
|------------|------------|-------------|
| Acknowledge / reject / vehicles / weigh | Yes | Yes |
| Raise invoice / CoD upload | No | Yes |
| MRN / Form 6 | No | Yes |
| Masters / users | No | Yes |
| Audit / Compliance | No | Yes |
| Backdate historical requests | No | Yes |
| Admin reports | Yes | Yes |
| Nav: Heroes / Sustainability / Capacity | Yes | Yes |

---

## Document control

**Version 1** | Urb TecTrack | https://tectrack.urbeno.in  
Support: info@urbeno.in · Confidential — authorised users only
