# UAT-CROSS-ROLE-LIFECYCLE — Stages 1–9 (production-critical)

One **new** collection request must travel through every stage with **three people** (or one tester switching accounts). Seeded `REQ-00046`–`048` are **not** sufficient for this script: stage 9 must be earned on this ID.

**Kit stage table**

| Stage | Name | Who in this script |
|-------|------|--------------------|
| 1 | Request | Client |
| 2 | Acknowledge | Admin |
| 3 | Assign vehicles | Admin |
| 4 | Load and weigh | Admin |
| 5 | Billing | Admin |
| 6 | MRN | Factory |
| 7 | Recycling (Form 6) | Factory |
| 8 | Certificate | Admin |
| 9 | Closed | Client (requestor) |

| Field | Value |
|-------|--------|
| Environment / URL | |
| Build / git SHA | |
| Date started / finished (IST) | |
| **Request ID** | `REQ-` _____________ |
| Invoice no. | |
| MRN no. | |
| Certificate no. | |
| Net kg (must equal gross − tare) | |
| Billing kg | |

Testers: Client _____________ · Admin _____________ · Factory _____________

Use unique suffixes (date + initials) on registration, invoice, e-way, UTR, and certificate numbers so re-runs do not collide.

---

## Handoff checklist

| ID | Actor | Action | Expected | Result | Time / initials |
|----|--------|--------|----------|--------|-----------------|
| L1 | Client `ramesh@techcorp.in` | New request: location, ~75 kg, ~12 units, ≥1 line item. Submit. | `REQ-#####` stage 1. Write ID above. | ☐ | |
| L2 | Admin | Open that ID. **Acknowledge Request**. | Stage 3. Message **Request acknowledged.** | ☐ | |
| L3 | Admin | **Assign Vehicle** (registration, driver). | Stage 4. **Vehicle assigned.** | ☐ | |
| L4 | Admin | Weighbridge: slip photo + pickup photo, gross/tare/slip. | **Weighment recorded.** Net = gross − tare. Stage 5. | ☐ | |
| L5 | Admin | **Raise Invoice**: unique invoice no., taxable ₹, tax from master, e-way bill. | **Invoice created.** Tax/total derived. | ☐ | |
| L6 | Factory `blr@urbeno.in` | **Create MRN** + photos + security officer. | **MRN created.** Client still must not see MRN if they refresh. | ☐ | |
| L7 | Client | Refresh request. | No MRN number on screen. | ☐ | |
| L8 | Factory | **Process & Issue Form 6**. Split **equals** billing kg. | **Recycling recorded.** | ☐ | |
| L9 | Admin | **Upload Certificate** (unique no. + file). Process email queue if needed. | **Certificate uploaded.** | ☐ | |
| L10 | Admin (or factory) | **+ Record Payment** covering the total. | **Payment recorded.** | ☐ | |
| L11 | Client | **Review & Close** → **Acknowledge closure**. | **Invoice closed.** Stage 9 / Closed. | ☐ | |
| L12 | Client | Sustainability / Home completed count. | This request’s kg is included only **after** L11. | ☐ | |
| L13 | Admin | **Audit** filter this `REQ-`. | Entries for ack, vehicle, weigh, invoice, MRN, recycle, certificate, payment, close. | ☐ | |

---

## Negative checks on the **same** request (do not skip)

| ID | Actor | Action | Expected | Result |
|----|--------|--------|----------|--------|
| N1 | Client | Try `/requests/REQ-00043` (Infosoft). | No access. | ☐ |
| N2 | Admin | Weigh without photos (use a **new** vehicle/request if this one is already weighed). | Refused. | ☐ |
| N3 | Factory | Form 6 split off by 1 kg. | Refused with kg delta in the message. | ☐ |
| N4 | Factory or client | Open `/compliance`. | No registers. | ☐ |
| N5 | Admin | Close while unpaid (before L10). | Refused — money outstanding. | ☐ |

---

## Lifecycle sign-off

This path is a **go-live gate**. Any Fail on L1–L11 is a **Blocker** unless a documented workaround still produces a correct, auditable closed invoice.

| | |
|--|--|
| Request ID closed at stage 9 | `REQ-` _____________ |
| All of L1–L13 Pass | ☐ Yes ☐ No |
| Negative N1–N5 Pass | ☐ Yes ☐ No |
| Fit to treat this build as lifecycle-complete | ☐ Yes ☐ No |

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Client tester | | | |
| Factory tester | | | |
| Admin tester | | | |
| UAT lead | | | |
