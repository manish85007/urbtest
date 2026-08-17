# Business rules

These are the rules the regulator, the client and the operations team depend on.
Each exists because getting it wrong produces a compliance failure, a billing
dispute or an audit finding. **Every one must survive the production build.**

Each rule names the function that enforces it and the test that proves it.

---

## The nine-stage lifecycle

| # | Stage | Who | Enforced in |
|---|---|---|---|
| 1 | Request | Client or admin | `db.subs.create` |
| 2 | Acknowledge | Admin | `db.subs.acknowledge` |
| 3 | Assign vehicles | Admin | `db.veh.add` |
| 4 | Load and weigh | Admin | `db.veh.weigh` |
| 5 | Billing | Admin | `db.inv.add` |
| 6 | MRN | Factory manager | `db.inv.createMRN` |
| 7 | Recycling | Factory manager | `db.inv.recycle` |
| 8 | Certificate | Admin | `db.inv.uploadCoD` |
| 9 | Closed | Requestor | `db.inv.close` |

Stages 1–4 belong to the request. From stage 5 each invoice progresses
**independently**, and the request's stage is its least-advanced invoice.

---

## Non-negotiable rules

### Weighment

**W1 · Photographic evidence is mandatory.**
A weighbridge weighment needs at least one slip photograph and one pickup
photograph. Refusing without them is the point — the photograph is the only
evidence that survives a dispute.
`db.veh.weigh` · `audit_v62.js`

**W2 · A manual weighment needs a written reason.**
Used for small consignments, or where the client's site rules bar the vehicle
from a weighbridge. Gross, tare and slip are not captured; a recorded weight, the
method and a written reason are. A pickup photograph is still required, because
with the slip gone it is the only physical evidence left.
`db.veh.weigh` · `audit_v62.js`

**W3 · Net weight is gross minus tare, computed, never typed.**
`db.veh.weigh`

### Billing

**B1 · Billing weight is anchored to the weighed vehicle net.**
Any difference requires a written deviation note stored on the invoice. Both
figures and the variance are kept.
`db.inv.add` · `audit_v62.js`

**B2 · Tax value and total are derived, never entered.**
The operator enters the taxable value and picks a rate from the tax master.
`db.inv.add` · `audit_v62.js`

**B3 · Every invoice carries its own e-way bill.**
Number, date and PDF, all mandatory. One e-way bill cannot cover two invoices.
`db.inv.add`

**B4 · Invoice numbers are unique within a request.**
`db.inv.add`

### Receipt and recycling

**R1 · One MRN per invoice, and only one.**
`db.inv.createMRN` · `audit_updates.js`

**R2 · MRN numbers are per facility and reset each financial year.**
Format `MRN/[Factory]/[FY]/[0001]`, April to March. **In production this needs an
atomic counter** — read-then-write will eventually issue duplicates.
`db.inv.nextMRN` · `audit_updates.js`

**R3 · The MRN is a gate document, not a classification exercise.**
No category assignment at the gate — the material has not been sorted yet. Only
vehicle, weighment and quantity received.
`mrnM` · `audit_updates.js`

**R4 · Clients never see MRNs.**
Not on the request, not in search, not in reports. It is an internal receiving
record.
`canSeeMRN` · `audit_updates.js`

**R5 · The category split must total the invoice billing weight exactly.**
Not approximately. Every kilogram received lands in an authorised category, or
the manifest and the capacity register are both wrong.
`db.inv.recycle` · `audit_v62.js`

**R6 · Material recovery is derived per category and must close.**
Each category's ferrous, non-ferrous, plastics and PCB fractions must account for
that category's received weight before the invoice total is accepted.
`db.inv.recycle` · `audit_v62.js`

**R7 · Capacity is checked per facility.**
Each site holds its own copy of the 126 authorised entries. Crossing an
authorised limit requires an explicit override, and the override is logged with a
reason.
`catm.utilization` · `audit_updates.js`

### Certificates and closure

**C1 · Certificates are uploaded, not generated.**
They are prepared outside the system. The tool records the number, the date and
the file.
`db.inv.uploadCoD`

**C2 · Certificate numbers are unique across the whole system.**
Not merely within an invoice.
`db.inv.uploadCoD` · `audit_v62.js`

**C3 · Several certificates may sit against one invoice.**
Material from one pickup often belongs to different client departments, each
needing its own certificate.
`invCods` · `audit_v62.js`

**C4 · Uploading a certificate emails the client automatically, with the file attached.**
`db.inv.uploadCoD` · `audit_v63.js`

**C5 · Only the requestor closes a request.**
Any client user of the same organisation may close after 30 days; an admin may
force-close after 60, with a reason.
`canCloseInv` · `audit6.js`

**C6 · A request cannot be closed while money is outstanding.**
This applies to an admin force-close as well.
`db.inv.close` · `audit_v62.js`

### Throughout

**A1 · Every mutation writes an audit entry** naming who, when and what changed.
`audit.log` · all suites

**A2 · Stage is derived from records, never read from a stored counter.**
`invStage`, `subStage` · `audit_v63.js`

**A3 · Sites are deactivated, never deleted,** once a submission references them.
`db.clients.toggleSite`

**A4 · Client IDs are four uppercase characters, unique and immutable.**
`URB`, `ADM`, `SYS` and `TEST` prefixes are reserved.
`db.clients.validCode` · `audit_updates.js`

---

## Scheduled behaviour

**S1 · Payment reminders run daily** against the client's agreed payment terms.
A settled invoice is never chased, and no invoice is chased twice in one day.
`runPaymentReminders` · `audit_v63.js`

**S2 · The recycling SLA is 30 days from MRN receipt to certificate issue.**
States are met, due-soon, breached and closed-late. An alert is raised once per
state change, not repeatedly.
`recySLA` · `audit_v63.js`

**S3 · Capacity alerts fire at 80% and 100%** of an authorised entry, per facility.
`checkCapacityAlerts`

**Scheduled jobs must be safe to run twice.** Container platforms restart things,
and a reminder job that reruns will email clients twice in a morning.

---

## Sustainability

Counts only invoices that reached stage 9 — certified **and** acknowledged. Work
in progress is excluded deliberately: a number that has been certified and
acknowledged can be defended, one still moving cannot.

| Factor | Value | Source |
|---|---|---|
| CO₂e avoided | 1.44 kg per kg | EPA WARM v16, mixed electronics |
| Landfill diverted | 92% of net weight | R2v3 downstream recovery |
| Tree equivalent | CO₂e ÷ 22 kg per tree-year | US Forest Service |
| Water saved | 0.61 kL per kg | UNEP Global E-waste Monitor 2024 |
| Energy saved | 2.3 kWh per kg | UNEP Global E-waste Monitor 2024 |
| Trees earned | 1 per tonne completed | Urbeno commitment |

Tree sequestration accrues **daily** from each planting's own date, and is
reported separately from avoided emissions. The two are never added — one is a
counterfactual saving, the other a physical removal.

`impactFor`, `heroesFor`, `db.trees.sequestered` · `audit_updates.js`

---

## Message wording

Refusal messages are part of the specification. An operator standing in a
warehouse needs to know what to do next.

> "The category split totals 80 kg but this invoice covers 120 kg. Every kilogram
> received has to land in an authorised category — adjust the split by 40 kg."

not

> "Validation failed."

Review these during UAT. They are how the system teaches its own rules.


---

## Compliance controls (v6.4)

Added following the review against SOC 2 and ISO/IEC 27001. Each names the
function that enforces it and the test that proves it. Standard references are
given so an auditor can trace the feature to the criterion it serves.

**X1 · The audit log is tamper-evident.**
Every entry carries a hash of its own contents and of the entry before it.
Altering, removing or reordering anything breaks the chain, and verification
names the entry and the reason. Never let a stored flag replace this.
`audit.log`, `audit.verifyChain` · A.8.15 / CC7.1 · `compliance_test.js`

**X2 · Security events are logged apart from business activity.**
Sign-ins, failures, lockouts, refused access, second-factor activity. High
severity alerts administrators rather than sitting unread.
`secLog.record`, `denyAccess` · A.8.15 / CC7.2 · `compliance_test.js`

**X3 · Privileged roles require a second factor.**
Admin and factory manager. Removing one requires a reason and logs high.
`mfa`, `CFG.mfaRoles` · A.5.17 / CC6.1 · `compliance_test.js`

**X4 · Password rules are enforced wherever a password is set.**
Ten characters, mixed case, a digit, not the user's own name, not one of the
last five, expiring after 180 days. One checker, used by every path.
`pwCheck`, `pwReused`, `pwExpired` · A.5.17 / CC6.1 · `compliance_test.js`

**X5 · Access is recertified every 90 days.**
A review cannot complete while any account is undecided. Withdrawal requires a
written reason and deactivates the account immediately.
`compliance.startReview`, `.decideReview`, `.closeReview` · A.5.18 / CC6.2

**X6 · An incident cannot be closed without a root cause and a corrective action.**
The ISO 9001 discipline applied to security. Stops the register becoming a list
of things that merely stopped happening.
`compliance.updateIncident` · A.5.24–A.5.28 · `compliance_test.js`

**X7 · Consent is versioned and recorded.**
Publishing a new notice version re-prompts everyone automatically.
`compliance.needsConsent`, `.recordConsent`, `consentGate` · DPDPA / A.5.34

**X8 · A data-principal request has a 30-day deadline and cannot be closed
without recording what was done.**
`compliance.raiseDSR`, `.closeDSR`, `.subjectData` · DPDPA · `compliance_test.js`

**X9 · Retention is tracked per record and disposal is recorded.**
Nothing is deleted automatically — disposal is a decision, and the record of it
is itself evidence.
`compliance.retentionRegister`, `.recordDisposal` · A.5.33 / Rule 12(4)

**X10 · Every document type carries a classification.**
Public, internal, confidential or restricted. Device serial records are the only
category rated restricted.
`FILE_CLASS`, `DATA_CLASSES` · A.5.12 · `compliance_test.js`

**X11 · Compliance is administrator-only.**
The registers hold personal data and security records. Client and factory users
are refused even if they navigate directly.
`renderCompliance` · CC6.3 · `compliance_test.js`

### In production

These are application controls. The hosted build must add: server-side hashing
with bcrypt or argon2, a real TOTP library verified server-side, audit and
security logs written to storage the application cannot subsequently edit,
encryption at rest and in transit, and automated backup with a tested restore.
See `PRODUCTION-NOTES.md` and the Compliance Review document.
