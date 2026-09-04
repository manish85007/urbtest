# Urb TecTrack — Client User Training Manual

| | |
|--|--|
| **Product** | Urb TecTrack™ |
| **Audience / role** | Client User (requestor) |
| **Version** | **1** (process-flow revision) |
| **Portal** | https://tectrack.urbeno.in |
| **Support** | info@urbeno.in |
| **Companion PDF** | `docs/uat/training/client/Urb-TecTrack-Client-User-Training-Guide-v1.pdf` |
| **Confidentiality** | Internal to your organisation and Urbeno. Do not forward credentials or share screenshots that contain other parties’ data. |

---

## How to use this guide

This is a **complete process-flow** walkthrough of what a Client User does from first login through closing a consignment. Use it for self-paced learning or a live classroom session (about **60–75 minutes**).

| Agenda block | Topics | Approx. |
|--------------|--------|---------|
| A | Login, Home, your place in the nine stages | 10 min |
| B | Raise a collection request (Stage 1) | 15 min |
| C | Track Stages 2–8 (read-only) & download Form 6 / CoD | 15 min |
| D | Changes requested → resubmit | 10 min |
| E | Review & Close (Stage 9) | 10 min |
| F | Heroes, Sustainability, Reports, Profile, sign-out | 15 min |

**Conventions**

- **Steps** are numbered actions in the portal.  
- **Expected outcome** describes success.  
- **Tip** highlights a boundary or practical detail.  
- **Urbeno does this** marks work you observe but do **not** perform.  
- No passwords are printed here. Credentials come only from the system email or your Urbeno administrator.

**Screenshot pack:** Prefer the Client User PDF under `docs/uat/training/client/` — each step has a full-page screenshot with how-to text.

---

## 1. What TecTrack does for you

Urb TecTrack is Urbeno’s e-waste **pickup lifecycle** portal. As a **Client User** you:

1. **Raise** a collection request for your organisation’s site (Stage 1).  
2. **Track** stages as Urbeno and the factory process the consignment (Stages 2–8).  
3. **Resubmit** if Urbeno requests changes before acknowledgement.  
4. **Download Form 6** and the **Certificate of Destruction (CoD)** when available.  
5. **Close** the invoice after payment is recorded and CoD is present (Stage 9).  
6. Review **Reports**, **Recycling Heroes**, and **Sustainability** for **your organisation only**.

You never see other clients’ data, factory **MRN** numbers, Masters, Audit, Capacity, or Compliance screens.

---

## 2. Process map — who owns each stage

| # | Stage | Who acts | What you do |
|---|-------|----------|-------------|
| 1 | Request | **You** | Raise (and resubmit if changes requested) |
| 2 | Acknowledge | Urbeno staff | Watch stage advance |
| 3 | Assign vehicle | Urbeno staff | See vehicle details when present |
| 4 | Load & weigh | Urbeno staff | See weighment progress (read-only) |
| 5 | Billing | Super Admin | See invoice / e-way when raised |
| 6 | MRN | Factory | Processing advances — **MRN number hidden** |
| 7 | Recycling (Form 6) | Factory (+ admin approval) | Download Form 6 when released |
| 8 | CoD upload | Super Admin | Download CoD when uploaded |
| 9 | Closed | **You** | **Review & Close** after CoD + payment |

**Tip:** From billing onward, each **invoice** can progress independently. The request stage follows the **least-advanced** invoice.

---

## 3. What you can and cannot do

### You can

- Raise, edit (when changes are requested), and resubmit collection requests.  
- Track stage progress on your organisation’s requests.  
- View vehicles, invoices, Form 6, and certificates when present.  
- Download Form 6 and CoD when issued / approved for client visibility.  
- Close invoices after **payment** and **CoD** (Review & Close).  
- Run client-scoped reports and view Heroes / Sustainability.  
- Change your own password.

### You cannot

- See or create **MRN** (goods receipt) — internal to Urbeno / factory.  
- Acknowledge requests, assign vehicles, record weighment, raise invoices, or upload CoD.  
- Issue Form 6 or edit factory capacity.  
- Open another organisation’s requests (tenancy is enforced).  
- Access Masters, Audit, Capacity, or Compliance.  
- Close an invoice while payment is still outstanding or CoD is missing.  
- Use Super Admin historical backdating on request dates.

---

## 4. First login

### 4.1 Before you begin

| Item | Detail |
|------|--------|
| Portal | https://tectrack.urbeno.in |
| Browser | Latest Chrome, Edge, or Safari |
| Account email | Official address nominated by your organisation |
| Temporary password | Urb TecTrack welcome email (not in this manual) |

### 4.2 Sign in and set your password

1. Open https://tectrack.urbeno.in.  
2. Enter your **email** and the **temporary password** from your account email.  
3. If prompted **You signed in with a temporary password**, choose a new password that meets the on-screen policy (length, upper/lower case, digit). Confirm and continue.  
4. If **Accept policies to continue** appears, open each policy link, then accept.

**Expected outcome:** You land on **Home** with a welcome heading that includes your first name. Profile role shows **Client User**.

**Tip:** Do not share or forward the temporary-password email. If you did not receive it, contact **info@urbeno.in** — never reply with a password in clear text.

### 4.3 MFA

Client Users **typically do not** use MFA. Staff roles do. If Profile has no **Two-factor authentication** card, that is expected.

### 4.4 Password later

Change your password any time under **Profile**. Weak or reused passwords are refused by policy.

---

## 5. Navigation overview

| Item | Purpose |
|------|---------|
| **Home** | Open / completed tiles, impact snapshot, **+ New Request** |
| **My Requests** | List and open all requests for your organisation |
| **Recycling Heroes** | Trees / tonnage milestones for your organisation |
| **Sustainability** | Environmental impact (closed consignments only) |
| **Reports** | Exportable registers scoped to your organisation |

You should **not** see: Masters, Audit, Capacity, Compliance, or factory MRN tools.

Avatar / name → **Your profile** and **Sign out**.

---

## 6. Process flow A — Raise a collection request (Stage 1)

### 6.1 Open the blank form

1. From **Home** (or **My Requests**), click **+ New Request**.  
2. Confirm the heading **New Collection Request**.  
3. There is **no Client dropdown** — your organisation is implied.

**Expected outcome:** Blank form with Site, Pickup Location, date, approx qty/weight, line items / BoM.

### 6.2 Complete and submit

1. Select **Site** (only your organisation’s sites appear).  
2. Enter **Pickup Location** (building / floor / warehouse / bay).  
3. Optionally enter **Your PO / Reference** for finance matching.  
4. Confirm **Pick Up Request Date** (clients cannot historical-backdate like Super Admin).  
5. Enter **Approx. Quantity** (units) and **Approx. Weight** (kg).  
6. Add **Notes** for access windows, PPE, or contact person.  
7. Add **Line Items** and/or attach a **Bill of Materials** file.  
8. Click **Submit Request**.

**Expected outcome:** Request detail opens with a heading like `REQ-#####`. Stage shows **Request** (awaiting Urbeno acknowledgement). Header shows organisation, site, raised date, and raised-by email. You do **not** see Acknowledge / Assign Vehicle / Weigh / Raise Invoice / Create MRN / Upload Certificate.

**Tip:** Exact weight is captured later at Urbeno weighment. Double-check site and location before submit — after acknowledgement, corrections usually go through “changes requested.”

### 6.3 My Requests list

1. Open **My Requests**.  
2. Confirm every row belongs to your organisation only.  
3. Use search / filters to find a `REQ-` by number or site.  
4. Click a row to open detail and track stages 1–9.

**Tip:** If another company’s request or an **MRN number** appears, stop and report a **Blocker** to info@urbeno.in.

---

## 7. Process flow B — Track Stages 2–8 (read-only)

Urbeno and the factory advance the job. Refresh the request detail periodically.

### 7.1 Vehicles & weighment

1. Open a request Urbeno has acknowledged and assigned.  
2. Review vehicle registration, driver, and weighment progress when shown.  
3. Confirm you **cannot** edit weighment or assign vehicles.

**Urbeno does this:** Acknowledge → Assign Vehicle → Record weighment → Acknowledge loading complete → Raise invoice.

### 7.2 Invoice, Form 6, Certificate

1. Open an advanced or closed request.  
2. Expand Invoicing / Recycling / Closed sections as shown.  
3. Review invoice number, billing weight, and totals when visible.  
4. Locate **Form 6** and **Certificate of Destruction** download controls.  
5. Confirm **MRN number is not shown**.

**Factory / Urbeno does this:** Create MRN → Process Form 6 → Admin approve Form 6 (when required) → Upload CoD → Record payment.

---

## 8. Process flow C — Download Form 6 and CoD

### 8.1 Form 6

1. On the invoice / recycling area, find **Form 6**.  
2. Download the Form 6 PDF when status is approved / available.  
3. Store it with your EHS / compliance records.

**Expected outcome:** PDF downloads. If missing, Urbeno may still be processing or awaiting admin approval — ask your Urbeno contact before treating it as a portal failure.

### 8.2 Certificate of Destruction

1. Locate **Certificate of Destruction** on the request / invoice panel.  
2. Download the signed CoD PDF.  
3. Keep the portal file and any email attachment Urbeno sent.

**Tip:** CoD without payment is not enough to close. Payment without CoD is not enough either. Both are required for **Review & Close**.

---

## 9. Process flow D — Changes requested and resubmit

Sometimes Urbeno asks for a correction instead of acknowledging.

1. Open the request from **My Requests**. Look for a **Changes requested** badge and Urbeno’s note.  
2. Click **Edit** (or the resubmit control).  
3. Update the fields named in the note (e.g. pickup location, gate hours).  
4. Enter **Your response to Urbeno** if asked.  
5. Click **Save and resubmit**.

**Expected outcome:** Message confirming the request was updated and sent back to Urbeno. Stage remains awaiting acknowledgement. You still cannot Acknowledge yourself.

**Tip:** Answer every point in the note in one pass so the request is not returned again.

---

## 10. Process flow E — Close after payment and CoD (Stage 9)

Only your organisation’s Client Users close a normal invoice.

### 10.1 Ready to close

1. Refresh the request after Urbeno finishes Stages 2–8.  
2. Confirm **Certificate of Destruction** is present.  
3. Confirm **payment** is recorded (no outstanding balance).  
4. Look for **Review & Close** — it appears only when both conditions are met.

**Tip:** If **Review & Close** is missing, payment or CoD is still outstanding. Contact Urbeno rather than forcing a close.

### 10.2 Acknowledge closure

1. Click **Review & Close**.  
2. Read the summary in the modal (invoice, certificate, payment).  
3. Click **Acknowledge closure**.

**Expected outcome:** Message **Invoice closed** (or equivalent). Stage shows **Closed**. Home **Completed** count increases. Sustainability includes this weight only after closure. Form 6 / CoD downloads remain available for your records.

**Tip:** **Client Read Only** users can download documents but **cannot** close.

---

## 11. Home, Recycling Heroes, Sustainability

### Home

1. Open **Home**.  
2. Review tiles for open requests, completed work, and impact snapshot.  
3. Use **+ New Request** when you need another pickup.

**Expected outcome:** Tiles match your organisation only.

### Recycling Heroes

1. Open **Recycling Heroes**.  
2. Review trees / tonnage milestones for your organisation.  
3. Use this view for CSR / ESG storytelling with **closed** recycled work.

**Expected outcome:** Client-scoped heroes view. You do not manage Urbeno-wide planting controls.

### Sustainability

1. Open **Sustainability**.  
2. Review weight recycled, CO₂e avoided, landfill diverted, water / energy figures as presented.  
3. Open methodology (“How these numbers are built”) and download **Impact PDF** if offered.

**Expected outcome:** Figures count **closed** (certified and acknowledged) consignments only — work in progress is excluded by design.

**Tip:** Do not add “in flight” pickups into board packs; wait for closure so numbers stay defensible.

---

## 12. Reports

1. Open **Reports**.  
2. Choose a report type available to clients (e.g. Complete Request Summary, Form 6 Log, Certificate Log, Sustainability, Heroes, Device Serials — as listed in your portal).  
3. Set FY / period filters if shown.  
4. **Export CSV** (or run on screen).

**Expected outcome:** Rows are **your organisation only**. **MRN Register** does **not** appear in the client report list.

**Tip:** Re-export after a batch of closures so CoD and sustainability columns stay current.

---

## 13. Profile, policies, sign-out

### Profile

1. Open **Profile** from your avatar / name menu.  
2. Confirm Role is **Client User** and Organisation is correct.  
3. Change password: Current → New (policy) → Confirm → Update.  
4. Confirm **Two-factor authentication** is not shown.

### Terms of Use / Privacy

1. Open **Terms of Use** (and Privacy Policy) from the footer or first-login gate.  
2. Read obligations before accepting on first login.  
3. You are not re-prompted unless Urbeno publishes a new version.

### Sign out

1. Open your avatar / name menu.  
2. Choose **Sign out** / **Logout**.  
3. Confirm the Sign In screen. Close the browser on shared computers.

**Tip:** Always sign out on shared workstations. Do not leave a client session open on a kiosk.

---

## 14. Support

| Need | Contact |
|------|---------|
| Access, login, missing welcome email | info@urbeno.in |
| Portal URL | https://tectrack.urbeno.in |
| Training questions | Your Urbeno project contact or info@urbeno.in |

When writing for help, include your organisation name, the `REQ-` number, and a short description — **never** include passwords.

---

## Appendix A — Client Read Only (brief)

Your organisation may also nominate **Client Read Only** users.

| | Client User | Client Read Only |
|--|-------------|------------------|
| View requests / reports / Heroes / Sustainability | Yes | Yes |
| Download Form 6 / CoD when available | Yes | Yes |
| Raise / edit / resubmit requests | Yes | **No** |
| Close after payment + CoD | Yes | **No** |
| New-request / operational emails | Yes | **No** (by design) |

Use Read Only for leadership, auditors, or finance who need visibility without raising work or filling the inbox.

---

## Appendix B — Classroom demo tips

| Goal | Suggested approach |
|------|--------------------|
| Full raise → close in one session | Use UAT / training environment; Urbeno trainer advances Stages 2–8 on the same `REQ-` while the client stays signed in for Steps 14–16 |
| Document downloads only | Open a closed demo request (e.g. `REQ-00102` / `REQ-00050` on UAT) |
| Track mid-lifecycle | Open a vehicle-stage request (e.g. `REQ-00101` on UAT) |
| Screenshot PDF rebuild | `node docs/uat/training/capture-client.mjs` then `build-training-pdfs.py` |

---

## Document control

**Version 1 (process-flow revision)** | Urb TecTrack | https://tectrack.urbeno.in  
Companion screenshot PDF: Client User Training Guide v1 under `docs/uat/training/client/`  
Support: info@urbeno.in · Confidential — authorised users only
