# Urb TecTrack — Client UAT Testing Document

**For:** Individual client testers (requestor role)  
**Portal:** https://uat.urbeno.in  
**Support:** info@urbeno.in  

Sign-in credentials are issued **separately** by Urbeno and are **not** listed in this document.  
Complete every case, log findings, and return this pack to Urbeno.

---

## 1. Session details

| Field | Your entry |
|-------|------------|
| Organisation | |
| Tester name | |
| Tester email | |
| Date(s) of testing (IST) | |
| Browser + version | |
| Device (desktop / laptop / tablet) | |
| Portal URL | https://uat.urbeno.in |
| Account used (issued separately) | |
| Build / release note (if provided) | |

**Before you start**

- Use only the account Urbeno issued to you for this exercise.
- Prefer a private/incognito window if you use other portal roles on the same browser.
- On first sign-in you may see **Accept policies to continue**. Open Terms and Privacy, then accept.
- Do not share this completed pack with passwords written on it.

---

## 2. How to mark results

| Result | Meaning |
|--------|---------|
| **Pass** | Behaviour matches Expected |
| **Fail** | Wrong or missing vs Expected — add a findings row |
| **N/A** | Cannot run — state why in Notes |
| **Blocked** | Blocked by another Fail or environment issue |

Write **Pass / Fail / N/A / Blocked** and your initials in Result.

### Severity (for Fail / Blocked)

| Severity | Use when |
|----------|----------|
| **Blocker** | Cannot raise, view, or close own requests; sees another organisation’s data; security concern |
| **Major** | Business rule broken; workaround exists |
| **Minor** | Awkward UI; process still completable |
| **Cosmetic** | Spelling / layout only |

---

## 3. Test parameters (reference)

| Parameter | Value / guidance |
|-----------|------------------|
| Portal URL | https://uat.urbeno.in |
| Role under test | Client User (requestor) |
| Expected navigation | Home, My Requests, Recycling Heroes, Sustainability, Reports |
| Navigation that must **not** appear | Masters, Audit, Capacity, Compliance |
| New request sample data | Pickup location e.g. Loading bay; Approx. qty e.g. 12; Approx. weight e.g. 75 kg; ≥1 line item |
| Tenancy check | Only your organisation’s requests/reports; refuse other-org request IDs if Urbeno supplies one |
| Staff-only actions (must not appear for you) | Acknowledge, Assign Vehicle, Weigh, Raise Invoice, Create MRN, Upload Certificate, Form 6 issue |
| Close rule | Review & Close only after certificate **and** payment are complete |
| Password policy (if changing password) | 10+ characters; upper; lower; digit; not last 5 passwords |
| Two-factor | Not used for client users in this portal |
| Return findings to | info@urbeno.in |
| Return subject | `Urb TecTrack UAT — Client findings — [Organisation] — [Date]` |

**Request ID you create:** `REQ-` _______________

---

## 4. Checklist

### C0 — Sign-in, policies, navigation

| ID | Step | Expected | Result | Notes |
|----|------|----------|--------|-------|
| C0.1 | Open the portal URL. Sign in with your issued account. | Login succeeds. | | |
| C0.2 | If policy acceptance appears: open Terms and Privacy, then accept. | Gate clears. Home welcomes you by name. | | |
| C0.3 | Review main navigation. | Client areas only (Home, My Requests, Recycling Heroes, Sustainability, Reports). No Masters, Audit, Capacity, Compliance. | | |
| C0.4 | Open Your profile. | Role is Client User. Organisation matches yours. Change password is available. Two-factor is **not** shown. | | |
| C0.5 | Sign out, then sign in again. | Returns to Home. Policies not re-prompted unless Urbeno published a new version. | | |

### C1 — Data isolation (critical)

| ID | Step | Expected | Result | Notes |
|----|------|----------|--------|-------|
| C1.1 | Open My Requests. | Only your organisation’s requests. | | |
| C1.2 | If Urbeno supplies another organisation’s request ID, open it via the address bar. | Access refused or redirected. No other company’s details. | | |
| C1.3 | Open Reports (Request Summary / Invoice Register). | Your organisation only. No MRN Register. | | |
| C1.4 | Try `/masters`, `/audit`, `/compliance`, `/capacity` on the portal URL. | Redirected or denied. No restricted data shown. | | |

### C2 — Raise a collection request (Stage 1)

Create a **new** request for this UAT.

| ID | Step | Expected | Result | Notes |
|----|------|----------|--------|-------|
| C2.1 | Home or My Requests → + New Request. | Form opens. Your organisation is implied. Site/location required. | | |
| C2.2 | Submit with required fields empty. | Form does not submit; validation messages appear. | | |
| C2.3 | Fill location, approx. qty & weight, ≥1 line item; optional PO/notes. Submit. | New `REQ-#####` at Stage 1 (awaiting acknowledgement). | | |
| C2.4 | Check header and actions. | Organisation, site, date, raised-by correct. No staff actions (Acknowledge / Vehicle / Weigh / Invoice). | | |

### C3 — Changes requested & resubmit (needs Urbeno)

Ask Urbeno to request changes on your request. Mark N/A if happy-path only.

| ID | Step | Expected | Result | Notes |
|----|------|----------|--------|-------|
| C3.1 | After changes requested: open the request. | Badge/note shows changes requested. | | |
| C3.2 | Edit details → save / resubmit. | Sent back to Urbeno. Still cannot Acknowledge. | | |

### C4 — Visibility while staff process (Stages 2–8)

Coordinate with Urbeno so your request advances.

| ID | Step | Expected | Result | Notes |
|----|------|----------|--------|-------|
| C4.1 | After ack / vehicle / weighment / invoice: refresh. | Stage advances. Vehicle/invoice appear when ready. | | |
| C4.2 | Inspect invoice / processing panels. | Progress visible. No MRN number, Create MRN, or factory security MRN fields. | | |
| C4.3 | After recycling / Form 6. | Processing progressed; you are not asked to issue Form 6. | | |
| C4.4 | After certificate upload. | Certificate reference/date visible. No Upload Certificate for you. | | |
| C4.5 | Try Review & Close before payment is complete. | Unavailable or refused until payment recorded. | | |

### C5 — Close the request (Stage 9)

| ID | Step | Expected | Result | Notes |
|----|------|----------|--------|-------|
| C5.1 | When certificate and payment exist: Review & Close. | Confirmation modal opens. | | |
| C5.2 | Acknowledge closure. | Closed / Stage 9. | | |
| C5.3 | Check Home completed counts. | Counts reflect closed work. | | |

### C6 — Home, Sustainability, Recycling Heroes

| ID | Step | Expected | Result | Notes |
|----|------|----------|--------|-------|
| C6.1 | Home. | Open/completed tiles and impact load. + New Request available. | | |
| C6.2 | Sustainability. | Figures load; help / Impact PDF (if offered) work. Reflects closed work. | | |
| C6.3 | Recycling Heroes. | Tree/tonnage view loads. | | |

### C7 — Reports & export

| ID | Step | Expected | Result | Notes |
|----|------|----------|--------|-------|
| C7.1 | Reports → Request Summary → Export CSV (if available). | Download; your organisation only. | | |
| C7.2 | Invoice Register, Certificate Log, Sustainability, Recycling Heroes. | Each runs; no MRN register. | | |
| C7.3 | Change period if shown. | Figures refresh; still no other organisations. | | |

### C8 — Profile / password (optional — do last)

| ID | Step | Expected | Result | Notes |
|----|------|----------|--------|-------|
| C8.1 | Profile → try a weak password (e.g. `short`). | Refused per password policy. | | |
| C8.2 | Successful password change. | Only if Urbeno asked you to change it; otherwise N/A. | | |

---

## 5. Findings log

| ID | Case | Severity | Summary (seen vs expected) | Screenshot | Steps to reproduce | Status |
|----|------|----------|----------------------------|------------|--------------------|--------|
| F-001 | | | | | | Open |
| F-002 | | | | | | |
| F-003 | | | | | | |
| F-004 | | | | | | |
| F-005 | | | | | | |

Quote exact on-screen messages for Failures. Add rows as needed.

---

## 6. Summary

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

## 7. Sign-off

| Question | Answer |
|----------|--------|
| Blockers found? | ☐ No ☐ Yes — IDs: _______________ |
| Fit for production as a client user? | ☐ Yes ☐ Yes, with waivers ☐ No |
| Overall comments | |

I confirm I executed this checklist and that the results are accurate.

| Role | Name | Organisation | Signature | Date |
|------|------|--------------|-----------|------|
| Tester | | | | |
| Client sponsor (optional) | | | | |

---

## 8. Return results

Email the completed document and screenshots to **info@urbeno.in** (copy your Urbeno contact).

Subject: `Urb TecTrack UAT — Client findings — [Your Organisation] — [Date]`

Companion visual walkthrough (no credentials): `Urb-TecTrack-Client-Access-Visual-Guide.pdf`
