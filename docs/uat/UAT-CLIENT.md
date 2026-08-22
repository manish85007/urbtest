# UAT-CLIENT — Client user (requestor)

**Role:** Client · waste generator / requestor  
**Business rules:** stages 1 and 9, R4 (no MRN), C4–C6, sustainability counts **closed** invoices only, X7 consent, X11 no Compliance.

**Spreadsheet for client testers:** [Urb-TecTrack-Client-Portal-UAT.xlsx](./Urb-TecTrack-Client-Portal-UAT.xlsx) — share this Excel file so clients can capture Pass/Fail results and sign off.

**Latest automated feature test report (Local UAT):** [Local-UAT-Feature-Test-Report.doc](./Local-UAT-Feature-Test-Report.doc)

| Field | Value |
|-------|--------|
| Environment / URL | |
| Build / git SHA | |
| Tester name / organisation | |
| Account used | `ramesh@techcorp.in` (primary). Tenancy: also `meera@infosoft.in` or inspect `REQ-00043`. |
| Password | `demo` unless this environment rotated it |
| Date (IST) | |
| Browser | |
| Shared lifecycle request ID | `REQ-` _____________ (from [UAT-CROSS-ROLE-LIFECYCLE.md](./UAT-CROSS-ROLE-LIFECYCLE.md)) |

Mark each case **Pass / Fail / N/A / Blocked**. Initials in the last column.

---

## C0 — Sign-in, policies, shell

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| C0.1 | Open the web URL while signed out. | Login screen. Do **not** leave the pre-filled admin email — enter `ramesh@techcorp.in` and password. | ☐ | |
| C0.2 | Sign in. If **Accept policies to continue** appears, open each policy link, then **I accept the policies above**. | Gate clears. Home heading **Welcome, Ramesh** (or first name). | ☐ | |
| C0.3 | Read the left (or top) navigation. | Only: **Home**, **My Requests**, **Recycle Heroes**, **Sustainability**, **Reports**. No Masters, Audit, Capacity, Compliance. | ☐ | |
| C0.4 | Open **Your profile** (avatar / name). | Role shows **Client User**. Organisation **TCPL**. Two-factor and change-password cards are present. | ☐ | |
| C0.5 | Sign out, then sign in again. | Returns to Home without re-prompting policies (unless an admin published a new version). | ☐ | |

---

## C1 — Tenancy (must Pass for go-live)

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| C1.1 | **My Requests**. Scan the list. | Only TechCorp requests (e.g. `REQ-00046`, `REQ-00047`, `REQ-00048`, plus any you raised). **No** Infosoft `REQ-00043`. | ☐ | |
| C1.2 | In the address bar, open `/requests/REQ-00043`. | Refused. Message **You don't have access to this request** (or redirect away). Must **not** show Infosoft Koramangala details. | ☐ | |
| C1.3 | **Reports**. Open **Request Summary** and **Invoice Register**. | Rows are TechCorp only. **MRN Register** is **not** in the report type list. | ☐ | |
| C1.4 | Direct URL `/masters`, `/audit`, `/compliance`, `/capacity`. | Redirect to Home (or not found). Must not show master data, audit rows, or compliance registers. | ☐ | |

---

## C2 — Raise a collection request (Stage 1)

Use a **new** request if you are also running the cross-role lifecycle. Write the ID at the top of this script.

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| C2.1 | Home → **+ New Request** (or My Requests → new). | Modal **New Collection Request**. Client dropdown is **absent** (organisation is implied). Site is required. | ☐ | |
| C2.2 | Submit empty (no location / qty / weight / lines). | Stays on form. Error: site, location, date, approximate quantity and weight are required — and/or add a line item or BoM. | ☐ | |
| C2.3 | Fill **Pickup Location** (e.g. `UAT loading bay`), **Approx. Weight (kg)** `75`, **Approx. Quantity** `12`, at least one line **Item description**, optional PO/ref and notes. **Submit Request**. | Lands on request detail. Heading `REQ-#####`. Stage **1** (awaiting acknowledgement). | ☐ | |
| C2.4 | Confirm header meta. | Own client name, site, raised date, **Raised By** your email. No Acknowledge / Assign Vehicle / Weigh / Raise Invoice buttons. | ☐ | |

Request ID created: `REQ-` _____________

---

## C3 — Changes requested and resubmit

Needs an admin to click **Request changes** on this request (or use a throwaway request). Skip if running only the happy-path lifecycle; then mark N/A and run C3 on a second request.

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| C3.1 | After admin sends back: open the request. | Badge **Changes requested**. Card **Changes requested by Urbeno** shows the admin’s note. | ☐ | |
| C3.2 | **Edit** (or the resubmit popup). Change pickup location. **Save and resubmit**. | Message **Request updated and sent back to Urbeno.** Stage remains 1. Client cannot Acknowledge. | ☐ | |

---

## C4 — Visibility during operations (Stages 2–8)

On the shared lifecycle request (or `REQ-00048` for a late-stage sample):

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| C4.1 | After acknowledgement / vehicle / weighment / invoice (performed by staff). Refresh the request. | Stage badge advances. Vehicle registration and invoice number are visible. | ☐ | |
| C4.2 | Inspect the invoice panel. | **No MRN number**, no “Create MRN”, no security-officer fields. (Rule R4.) | ☐ | |
| C4.3 | After factory recycling: look for Form 6 / categories. | Client may see that processing happened; must **not** be asked to issue Form 6. | ☐ | |
| C4.4 | After admin uploads a certificate. | Certificate number/date visible. Client does **not** see **Upload Certificate**. | ☐ | |
| C4.5 | **Review & Close** before payment is complete. | Button absent or close refused until the invoice is paid (rule C6). | ☐ | |

---

## C5 — Close the request (Stage 9)

Only the requestor’s organisation closes a normal invoice (rule C5). Admin force-close is out of scope here.

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| C5.1 | When certificate exists **and** payment is recorded: **Review & Close**. | Modal **Review & Close**. | ☐ | |
| C5.2 | **Acknowledge closure**. | Message **Invoice closed.** Stage shows closed / 9. | ☐ | |
| C5.3 | Home **Completed** (or equivalent) tile. | Count increased. Sustainability tiles still ignore in-progress work. | ☐ | |

---

## C6 — Home, sustainability, Recycle Heroes

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| C6.1 | **Home**. | Tiles include open requests, completed, and impact figures. **+ New Request** is visible. | ☐ | |
| C6.2 | **Sustainability**. | Heading **Sustainability**. Weight recycled / CO₂e / landfill / water use **closed** kg only. **How these numbers are built** and **Impact PDF** open. | ☐ | |
| C6.3 | **Recycle Heroes**. | Client view of trees / tonnage. **Record Planting** is **not** the admin-wide Urbeno control (client may log own CSR planting if the button exists — record what you see). | ☐ | |

---

## C7 — Reports

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| C7.1 | **Reports** → Request Summary → **Export CSV**. | File downloads. Contains own requests only. | ☐ | |
| C7.2 | Invoice Register, Certificate Log, Sustainability, Recycle Heroes. | Each runs without error. No MRN register. | ☐ | |
| C7.3 | Change period (FY / month) if a period picker is shown. | Figures refresh; no other client’s rows appear. | ☐ | |

---

## C8 — Profile (optional password — do last)

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| C8.1 | Profile → new password `short`. | Refused. Needs 10 characters, upper, lower, digit. | ☐ | |
| C8.2 | Skip a successful password change on the shared demo user unless you are the last tester. MFA is optional for clients (privileged MFA is admin/factory). | N/A is acceptable. | ☐ | |

---

## Client sign-off

| | |
|--|--|
| Cases executed | _____ of _____ |
| Pass / Fail / N/A / Blocked | _____ / _____ / _____ / _____ |
| Blockers found | Yes / No — IDs: |
| Fit for production as a **client** | ☐ Yes ☐ Yes, with waivers ☐ No |

I confirm I executed this script on the environment named above and that the results are accurate.

| | Name | Organisation | Signature | Date |
|--|------|----------------|-----------|------|
| Tester | | | | |
| Client sponsor (optional) | | | | |
