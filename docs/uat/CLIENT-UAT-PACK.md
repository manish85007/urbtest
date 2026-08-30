# Urb TecTrack™ — Client User Acceptance Testing (UAT) Pack

**Audience:** Client (waste generator / requestor) testers  
**Environment:** User Acceptance Testing  
**Portal:** https://uat.urbeno.in  
**Support / feedback:** info@urbeno.in  

Please complete this pack, mark every case, log all findings, and return the signed summary to Urbeno.

---

## 1. Session details (complete before testing)

| Field | Your entry |
|-------|------------|
| Organisation | |
| Tester name | |
| Tester email | |
| Date(s) of testing (IST) | |
| Browser + version (e.g. Chrome 128) | |
| Device (desktop / laptop / tablet) | |
| Portal URL used | https://uat.urbeno.in |
| Account used | e.g. `ramesh@techcorp.in` |
| Build / release note from Urbeno (if provided) | |

### Demo accounts (password `demo` unless Urbeno notifies otherwise)

| Account | Organisation | Use for |
|---------|--------------|---------|
| `ramesh@techcorp.in` | TechCorp (TCPL) | Primary client testing |
| `priya@techcorp.in` | TechCorp (TCPL) | Second TechCorp user (optional) |
| `meera@infosoft.in` | Infosoft | Tenancy check only (other client’s data) |

**Important**

- Do **not** change the shared `demo` password until your final session of the day (or use a dedicated account if Urbeno creates one).
- First sign-in may show **Accept policies to continue** (Terms & Privacy). Open the links, then accept before continuing.
- Prefer a private/incognito window if you also have an admin or factory login on the same browser.

---

## 2. How to mark results

| Result | Meaning |
|--------|---------|
| **Pass** | Behaviour matches **Expected** |
| **Fail** | Wrong, missing, or unclear vs Expected — **must** add a findings row |
| **N/A** | Cannot run in this session — state why in Notes |
| **Blocked** | Blocked by another Fail or environment issue — state dependency |

Mark the checkbox column: ☐ → write **Pass / Fail / N/A / Blocked** and your initials.

### Severity (for Fail rows in the findings log)

| Severity | When to use |
|----------|-------------|
| **Blocker** | Cannot raise, view, or close own requests; sees another client’s data; security concern |
| **Major** | Business rule broken but a workaround exists |
| **Minor** | Awkward UI / missing hint; process still completable |
| **Cosmetic** | Spelling / layout that does not change meaning |

---

## 3. Checklist — Client portal

### C0 — Sign-in, policies, navigation

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| C0.1 | Open https://uat.urbeno.in while signed out. Sign in with your client account (not a pre-filled admin email). | Login succeeds. | | |
| C0.2 | If **Accept policies to continue** appears: open Terms and Privacy, then accept. | Gate clears. Home shows a welcome with your first name. | | |
| C0.3 | Review the main navigation. | You see client areas only (e.g. Home, My Requests, Recycle Heroes, Sustainability, Reports). You do **not** see Masters, Audit, Capacity, or Compliance. | | |
| C0.4 | Open **Your profile** (avatar / name). | Role is **Client User**. Organisation matches your company. Profile / change-password options are visible. Two-factor authentication is **not** shown for client users. | | |
| C0.5 | Sign out, then sign in again. | Returns to Home. Policies are **not** re-prompted (unless Urbeno published a new version). | | |

### C1 — Data isolation (tenancy) — critical

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| C1.1 | Open **My Requests**. Scan the list. | Only **your organisation’s** requests. No other company’s request IDs. | | |
| C1.2 | In the address bar, try to open another organisation’s request (Urbeno will supply an ID such as `REQ-00043` if needed). | Access refused or redirected. You must **not** see another company’s site or details. | | |
| C1.3 | Open **Reports** (Request Summary / Invoice Register). | Rows are your organisation only. There is **no** MRN Register for clients. | | |
| C1.4 | Try direct URLs such as `/masters`, `/audit`, `/compliance`, `/capacity` (append to the portal URL). | Redirected away or access denied. No master / audit / compliance data shown. | | |

### C2 — Raise a collection request (Stage 1)

Create a **new** request for this UAT (do not rely only on seeded samples).

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| C2.1 | Home or My Requests → **+ New Request**. | Form opens. Client organisation is implied (no need to pick another company). Site / location fields are required. | | |
| C2.2 | Try Submit with required fields empty. | Form does not submit; clear validation messages appear. | | |
| C2.3 | Fill pickup location, approximate quantity & weight, at least one line item; optional PO/ref/notes. **Submit**. | Request detail opens with a new `REQ-#####`. Stage shows awaiting acknowledgement (Stage 1). | | |
| C2.4 | Check header / actions. | Your organisation, site, raised date, and raised-by email are correct. You do **not** see Acknowledge / Assign Vehicle / Weigh / Raise Invoice (Urbeno staff actions). | | |

**Request ID created:** `REQ-` _______________

### C3 — Changes requested & resubmit (needs Urbeno admin)

Ask Urbeno to use **Request changes** on your new request (or a throwaway). Mark **N/A** if this session is happy-path only.

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| C3.1 | After admin requests changes: open the request. | Status / badge shows changes requested; admin note is visible. | | |
| C3.2 | Edit pickup details → save / resubmit. | Confirmation that the request was sent back to Urbeno. Stage remains awaiting acknowledgement. You still cannot Acknowledge. | | |

### C4 — Visibility while Urbeno / factory process the job (Stages 2–8)

Coordinate with Urbeno so your request advances (or use a late-stage sample they nominate).

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| C4.1 | After ack / vehicle / weighment / invoice: refresh the request. | Stage badge advances. Vehicle and invoice details appear when ready. | | |
| C4.2 | Inspect invoice / processing panels. | You see invoice / certificate progress as intended. You do **not** see an MRN number, Create MRN, or factory security-officer MRN fields. | | |
| C4.3 | After recycling / Form 6 (factory). | You may see that processing progressed; you are **not** asked to issue Form 6. | | |
| C4.4 | After certificate upload (Urbeno). | Certificate reference/date visible. You do **not** see **Upload Certificate**. | | |
| C4.5 | Try **Review & Close** before payment is complete (if the button appears). | Close is unavailable or refused until payment is recorded. | | |

### C5 — Close the request (Stage 9)

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| C5.1 | When certificate exists **and** payment is recorded: **Review & Close**. | Closure confirmation modal opens. | | |
| C5.2 | Acknowledge closure. | Confirmation that the invoice/request is closed. Stage shows Closed / Stage 9. | | |
| C5.3 | Check Home completed / closed counts. | Counts reflect the closed work. | | |

### C6 — Home, Sustainability, Recycle Heroes

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| C6.1 | **Home**. | Open / completed tiles and impact figures load. **+ New Request** is available. | | |
| C6.2 | **Sustainability**. | Impact figures load; explanatory text / Impact PDF (if offered) open without error. Figures reflect **closed** work, not in-progress only. | | |
| C6.3 | **Recycle Heroes**. | Tree / tonnage view loads. Note whether planting controls are client-scoped vs Urbeno-wide. | | |

### C7 — Reports & export

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| C7.1 | Reports → Request Summary → **Export CSV** (if available). | File downloads; contains only your organisation’s rows. | | |
| C7.2 | Try Invoice Register, Certificate Log, Sustainability, Recycle Heroes reports. | Each runs without error. No MRN register. | | |
| C7.3 | Change period (FY / month) if shown. | Figures refresh; still no other client’s data. | | |

### C8 — Profile / password (optional — do last)

| ID | Step | Expected | Result | Notes / initials |
|----|------|----------|--------|------------------|
| C8.1 | Profile → try a weak password (e.g. `short`). | Refused; policy requires stronger password (length + upper + lower + digit). | | |
| C8.2 | Successful password change on shared demo accounts. | Prefer **N/A** unless you are the last tester of the day or Urbeno gave a dedicated user. | | |

---

## 4. Findings log (update for every Fail / Blocked / notable observation)

| ID | Case (e.g. C1.2) | Severity | Summary (what you saw vs expected) | Screenshot / attachment | Steps to reproduce | Status |
|----|------------------|----------|-------------------------------------|-------------------------|--------------------|--------|
| F-001 | | | | | | Open |
| F-002 | | | | | | |
| F-003 | | | | | | |
| F-004 | | | | | | |
| F-005 | | | | | | |

Add rows as needed. Quote **exact on-screen messages** when reporting Failures.

---

## 5. Summary counts

| Metric | Count |
|--------|-------|
| Cases executed | _____ of _____ |
| Pass | |
| Fail | |
| N/A | |
| Blocked | |
| Open Blockers | |
| Open Majors | |

---

## 6. Client sign-off

| Question | Answer |
|----------|--------|
| Blockers found? | ☐ No ☐ Yes — IDs: _______________ |
| Fit for production **as a client user**? | ☐ Yes ☐ Yes, with waivers ☐ No |
| Overall comments | |

I confirm I executed this checklist on the environment named above and that the results and findings are accurate to the best of my knowledge.

| Role | Name | Organisation | Signature | Date |
|------|------|--------------|-----------|------|
| Tester | | | | |
| Client sponsor (optional) | | | | |

---

## 7. How to return results

Please email the completed pack (or a clear photo/PDF of filled pages) and any screenshots to **info@urbeno.in**, with copy to your Urbeno contact, using subject:

`Urb TecTrack UAT — Client findings — [Your Organisation] — [Date]`

Optional Excel workbook for the same script: [Urb-TecTrack-Client-Portal-UAT.xlsx](./Urb-TecTrack-Client-Portal-UAT.xlsx).
