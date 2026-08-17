# Changelog

## v6.4 — current
Compliance review against SOC 2, ISO/IEC 27001:2022, ISO 9001, ISO 14001 and
DPDPA. Eight application-level gaps found and closed. See
`docs/Compliance-Review.docx` for the full assessment and what remains
organisational.

- **Hash-chained audit log.** Every entry hashes itself and its predecessor;
  `verifyChain()` reports the exact entry and reason if anything is altered,
  removed or reordered. A.8.15 / CC7.1.
- **Separate security event log** with severity ratings and alerting on
  high-severity events. A.8.15 / CC7.2.
- **Two-factor authentication**, required by policy for admin and factory roles.
  A.5.17 / CC6.1.
- **Password policy** — 10 characters, complexity, no reuse of the last five,
  180-day expiry, checked wherever a password is set. A.5.17 / CC6.1.
- **90-day access recertification** that cannot complete while any account is
  undecided; withdrawal requires a reason and deactivates immediately.
  A.5.18 / CC6.2.
- **Incident register** requiring root cause and corrective action before
  closure. A.5.24–A.5.28.
- **Versioned privacy notice, consent record, DSR register and subject-access
  lookup.** DPDPA / A.5.34.
- **Retention register and disposal record**, with four-level data
  classification applied to every document type. A.5.33 / A.5.12.
- **Control status page and one-click evidence pack** for auditors.
- New suite `compliance_test.js`, 113 assertions. Total 835.
- Modules renumbered so build order matches filename order; `13-pdf-and-boot.js`
  is last because it holds `boot()`.

## v6.3.1 — current
Fixes a blank dashboard reported after upgrading in place.

- **State schema guard.** Saves carry `schema: 6.3`. A load finding an older
  stamp archives that data under a separate key and starts from seed rather than
  half-restoring it. Root cause: a saved user roster from an earlier version had
  no password hash, so sign-in failed silently, `me` stayed null, and the
  dashboard render threw — leaving an empty page.
- **User reconciliation.** `reconcileUsers()` merges a saved roster against
  `SEED_USERS`, filling structural fields and falling back to seed credentials.
- **Render guard.** `nav()` catches render failures and shows an explained
  message with recovery options instead of a blank screen.
- **`resetLocalData()`** archives before clearing.
- New suite `guard_test.js`, 10 assertions. Total 721.

## v6.3
Single request-level certificates panel (duplicate card removed) · Compliance
Documents at the foot of a request · **stage derived from records** rather than a
stored counter, with a repair pass · Profile moved onto the name chip · client
payment terms with daily reminders · 30-day recycling-to-certificate SLA · Terms
of Use in the footer.

## v6.2
Manual weighment flag · billing weight anchored to weighed net with deviation
note · tax rate master driving derived tax and total · category split tied to
invoice weight, with sample serials CSV · request-level multi-certificate ·
material recovery derived per category · closure blocked until paid · mobile
support.

## v6.1
MRN reduced to a gate document, hidden from clients · recycling owns
categorisation and processing evidence · new requests email admins · per-facility
capacity with CPCB/EPR numbers · tree progress photos and client CSR plantings ·
email moved into Masters · logistics GST · daily tree sequestration · methodology
document · Logout · multi-certificate · Urbeno branding.

## v6.0
Rebuilt on a nine-stage lifecycle with three roles, multi-vehicle, multi-invoice,
MRN, invoice-wise recycling, uploaded certificates, requestor closure, four-character
client codes, multi-facility masters, email templates, password reset, global
search, Recycle Heroes and working sustainability reporting. EPR credits and
driver mode removed.
