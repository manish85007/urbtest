/**
 * Capture Super Admin end-to-end e-waste lifecycle training screenshots.
 * Prefers seeded demo requests at various stages; opens existing UI actions when present.
 * Usage: BASE_URL=http://localhost:8080 node docs/uat/training/capture-lifecycle-admin.mjs
 *
 * Credentials are used only to sign in — never shown in screenshots or howTo text.
 */
import {
  clearShots,
  makeSnapper,
  redactProfilePii,
  roleOutDir,
  signIn,
  withBrowser,
  writeManifest,
} from './_capture-lib.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:8080';
const EMAIL = process.env.TEST_EMAIL || 'admin@urbeno.in';
const PASSWORD = process.env.TEST_PASSWORD || 'demo';
const OUT = roleOutDir('lifecycle-admin');
const steps = [];

/** Prefer seeded demos at known stages when present. */
const SEED = {
  awaitAck: 'REQ-00099',
  ackNoVehicle: 'REQ-00046',
  invoiced: 'REQ-00047',
  invoicedAlt: 'REQ-00048',
  closed: 'REQ-00050',
};

async function dismissModal(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(350);
}

async function openRequest(page, id) {
  await page.goto(`${BASE}/requests/${id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const heading = page.getByText(id).first();
  return heading.isVisible({ timeout: 4000 }).catch(() => false);
}

async function openFirstMatchingRequest(page, ids) {
  for (const id of ids) {
    if (await openRequest(page, id)) return id;
  }
  const link = page.locator('a[href*="/requests/REQ-"]').first();
  await page.goto(`${BASE}/requests`, { waitUntil: 'networkidle' });
  if (await link.isVisible({ timeout: 4000 }).catch(() => false)) {
    const href = await link.getAttribute('href');
    await link.click();
    await page.waitForLoadState('networkidle');
    const m = (href || page.url()).match(/REQ-[\w-]+/);
    return m ? m[0] : null;
  }
  return null;
}

/**
 * Click a control if visible; snap; dismiss. Warn and continue when missing.
 */
async function tryActionSnap(page, snap, opts) {
  const { id, title, howTo, tips, buttonName, afterOpen } = opts;
  const btn = page.getByRole('button', { name: buttonName }).first();
  if (!(await btn.isVisible({ timeout: 2500 }).catch(() => false))) {
    console.warn(`  skip ${id} — control not visible: ${buttonName}`);
    return false;
  }
  await btn.click();
  await page.waitForTimeout(700);
  if (afterOpen) await afterOpen(page);
  await snap(page, id, title, howTo, tips);
  await dismissModal(page);
  return true;
}

async function main() {
  clearShots(OUT);
  const snap = makeSnapper(OUT, steps);
  console.log('Lifecycle Super Admin capture →', OUT);

  await withBrowser(async (page) => {
    // ── 1. Login ──────────────────────────────────────────────
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'login',
      'Step 1 — Sign in as Super Admin',
      [
        '1. Open https://tectrack.urbeno.in in Chrome, Edge, or Safari.',
        '2. Enter your @urbeno.in Super Admin email from the account notification.',
        '3. Enter your password and click Sign In.',
        '4. Complete two-factor authentication if enrolled.',
        '5. Accept Terms of Use and Privacy Policy on first login if prompted.',
        '6. Change a temporary password immediately when the must-reset gate appears.',
      ].join('\n'),
      'Super Admin can change Masters, reset passwords, and backdate historical lifecycle dates from 2026-04-01. Protect MFA and never leave the session unlocked on a shared machine.',
    );

    await signIn(page, BASE, EMAIL, PASSWORD, { alreadyOnLogin: true });

    // ── 2. Dashboard ──────────────────────────────────────────
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'dashboard',
      'Step 2 — Operations dashboard overview',
      [
        '1. Confirm you land on the Operations Dashboard (admin variant).',
        '2. Review tiles: New Requests / awaiting acknowledgement, open work, and operational KPIs.',
        '3. Note full navigation: Dashboard, Requests, Recycling Heroes, Sustainability, Capacity, Masters, Reports, Audit, Compliance.',
        '4. Use the New Requests (or Stage 1) shortcut to jump into acknowledgement work.',
        '5. Remember the hand-off map: Ops often does ack → vehicle → weigh; Factory does MRN → Form 6; you cover billing, CoD, Masters, Audit, Compliance, and backdating.',
      ].join('\n'),
      'You see every organisation. Treat client data as confidential even inside Urbeno. If Compliance or Masters is missing from the menu, you are not on a Super Admin session.',
    );

    // ── 3. Requests list ──────────────────────────────────────
    await page.goto(BASE + '/requests', { waitUntil: 'networkidle' });
    await snap(
      page,
      'requests',
      'Step 3 — Requests queue across stages',
      [
        '1. Open Requests from the top navigation.',
        '2. Scan stage badges (1–9) and invoice mini-badges on each row.',
        '3. Filter or search for Stage 1 items awaiting acknowledgement, or jump to a known REQ- id.',
        '4. Prefer seeded demos for training walkthroughs (e.g. stage-1, vehicles, invoiced, closed samples) so you do not invent live client data.',
        '5. Open a row to reach request detail — all lifecycle actions live there.',
      ].join('\n'),
      'Keep unique suffixes on registration / invoice / e-way / certificate numbers during re-runs. Walk one request carefully before bulk practice.',
    );

    // ── 4. Stage 1 — Acknowledge ──────────────────────────────
    const stage1Id = await openFirstMatchingRequest(page, [SEED.awaitAck]);
    if (stage1Id) {
      await snap(
        page,
        'stage1-detail',
        'Step 4 — Open a Stage 1 / new request',
        [
          '1. Open a Stage 1 request (awaiting acknowledgement).',
          '2. Read site, location, approx qty/weight, notes, and raised-by details.',
          '3. Decide: Acknowledge, Request changes (with a clear note), or Reject when the UI offers it.',
          '4. Do not invent missing client site details — send Request changes instead.',
          '5. After acknowledgement the request moves to Vehicles & Weighment.',
        ].join('\n'),
        'Clients raise Stage 1. Operations Managers and Super Admins acknowledge. Factory cannot acknowledge.',
      );

      await tryActionSnap(page, snap, {
        id: 'acknowledge',
        title: 'Step 4b — Acknowledge Request',
        buttonName: /acknowledge request|^acknowledge$/i,
        howTo: [
          '1. Click Acknowledge Request (or Acknowledge on the dashboard queue).',
          '2. Review the summary in the modal (site, weight, units, request date).',
          '3. Confirm acknowledgement — an email is sent using the Request Acknowledgement template.',
          '4. Expected outcome: stage advances toward Vehicles & Weighment.',
        ].join('\n'),
        tips: 'If the button is missing, the request is already past Stage 1 — open another Stage 1 demo or continue with Assign Vehicle on an acknowledged request.',
      });
    } else {
      console.warn('  skip stage1 — no request available');
    }

    // ── 5. Assign vehicle (+ backdate) ─────────────────────────
    const vehicleReq = await openFirstMatchingRequest(page, [SEED.ackNoVehicle]);
    if (vehicleReq) {
      const assignBtn = page.getByRole('button', { name: /assign vehicle|add vehicle/i }).first();
      if (await assignBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
        await assignBtn.click();
        await page.waitForTimeout(700);
        // Show Super Admin historical window on expected pickup
        const dateInput = page.locator('#vh-exp-date, input[type="date"]').first();
        if (await dateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await dateInput.fill('2026-05-15');
          await page.waitForTimeout(300);
        }
        const reg = page.locator('#vh-reg');
        if (await reg.isVisible().catch(() => false)) {
          await reg.fill('KA99TR' + String(Date.now()).slice(-4));
        }
        const drv = page.locator('#vh-drv');
        if (await drv.isVisible().catch(() => false)) {
          await drv.fill('Training Driver');
        }
        await snap(
          page,
          'assign-vehicle',
          'Step 5 — Assign Vehicle (with Super Admin backdate)',
          [
            '1. On an acknowledged request, click Assign Vehicle (or + Add Vehicle).',
            '2. Enter registration, vehicle type, logistics partner, driver name, and phone.',
            '3. Set Expected pickup date and time (or a quick time slot).',
            '4. Super Admin only: historical expected pickup dates from 2026-04-01 are allowed when the backdate hint is shown — use this for FY catch-up uploads, not day-to-day ops.',
            '5. Add team members if required, then save.',
            '6. Operations Managers can also assign vehicles but cannot use the Super Admin historical backdate window.',
          ].join('\n'),
          'Never invent a registration plate for a live pickup. The form hint confirms the historical upload window from 2026-04-01.',
        );
        await dismissModal(page);
      } else {
        console.warn('  skip assign-vehicle — Assign/Add Vehicle not visible');
      }
    }

    // ── 6. Weighment form ─────────────────────────────────────
    const weighReq = await openFirstMatchingRequest(page, [SEED.invoiced, SEED.invoicedAlt, SEED.ackNoVehicle]);
    if (weighReq) {
      const weighBtn = page.getByRole('button', { name: /record weighment|weigh \(/i }).first();
      if (await weighBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
        await weighBtn.click();
        await page.waitForTimeout(700);
        await snap(
          page,
          'weighment',
          'Step 6 — Weighment form (date + Super Admin historical backdate)',
          [
            '1. Open Vehicles & Weighment on the request.',
            '2. Click Record Weighment (or Weigh pending) on a vehicle row.',
            '3. Enter weighment slip number, gross kg, and tare kg — confirm net = gross − tare.',
            '4. Set Weighment date. Super Admin sees a historical upload hint: dates from 2026-04-01 are allowed; non-admin roles are limited to today for weighment.',
            '5. Attach weighment slip photo(s) and pickup photo(s) — both evidence sets are required.',
            '6. Submit. After every vehicle is weighed, Acknowledge loading complete if shown, then proceed to Raise Invoice.',
          ].join('\n'),
          'Refuse weighment without both photo sets. Do not type invented weights. Operations Managers weigh but cannot historical-backdate weighment dates.',
        );
        await dismissModal(page);
      } else {
        console.warn('  skip weighment — Record Weighment / Weigh control not visible');
        await snap(
          page,
          'weighment-context',
          'Step 6 — Weighment context on request detail',
          [
            '1. Open a request that already has vehicles.',
            '2. Review existing weighment rows (slip #, gross / tare / net, photos).',
            '3. When training live: use Record Weighment on an unweighed vehicle.',
            '4. Super Admin historical weighment dates: from 2026-04-01 when the backdate hint appears.',
            '5. After all vehicles are weighed, Acknowledge loading complete, then Raise Invoice.',
          ].join('\n'),
          'Seeded invoiced demos may already be weighed — that is fine for showing completed evidence. Practice Record Weighment on a fresh vehicle when available.',
        );
      }
    }

    // ── 7. Raise invoice ──────────────────────────────────────
    const invoiceReq = await openFirstMatchingRequest(page, [SEED.invoiced, SEED.invoicedAlt, SEED.closed]);
    if (invoiceReq) {
      const raised = await tryActionSnap(page, snap, {
        id: 'raise-invoice',
        title: 'Step 7 — Raise Invoice',
        buttonName: /raise invoice|add invoice/i,
        howTo: [
          '1. After loading is acknowledged, click Raise Invoice (or Add Invoice for a split).',
          '2. Enter invoice number, invoice date, taxable value, and tax rate — totals calculate automatically.',
          '3. Confirm billing weight (defaults from vehicle net); add a deviation note if it differs.',
          '4. Enter e-way bill number / date and attach the e-way PDF as required.',
          '5. Super Admin may use historical invoice dates from 2026-04-01 when the backdate hint is shown.',
          '6. Create invoice. Multiple invoices may split one pickup; billing weights must reconcile to total weighment.',
        ].join('\n'),
        tips: 'Operations Managers do not raise invoices. Do not type tax totals manually when the system calculates them. Keep invoice numbers unique within the request.',
      });
      if (!raised) {
        await snap(
          page,
          'invoice-panel',
          'Step 7 — Invoice panel on an invoiced request',
          [
            '1. Open a request that already has an invoice (Stage 5+).',
            '2. Review invoice number, taxable / tax / total, billing weight, and e-way details.',
            '3. From here Factory can Create MRN; you can Record Payment and later Upload Certificate.',
            '4. Use Add Invoice only when splitting a pickup into another bill.',
          ].join('\n'),
          'Seeded REQ demos often already show a raised invoice — use them to teach the post-invoice path without inventing numbers.',
        );
      }
    }

    // ── 8. Record payment ─────────────────────────────────────
    if (invoiceReq) {
      await openRequest(page, invoiceReq);
      const payOk = await tryActionSnap(page, snap, {
        id: 'record-payment',
        title: 'Step 8 — Record Payment',
        buttonName: /record payment/i,
        howTo: [
          '1. Scroll to the Payment section on the invoice panel.',
          '2. Click + Record Payment.',
          '3. Enter UTR / reference, amount, mode, and payment date.',
          '4. Capture TDS if applicable per client terms.',
          '5. Save. Payment does not block Form 6 or Certificate of Destruction, but the client cannot Review & Close until payment and CoD are both complete.',
          '6. Super Admin may historical-backdate payment dates from 2026-04-01 when the hint is shown.',
        ].join('\n'),
        tips: 'Record real bank references only. Clients close the request after payment + CoD — do not force-close as a substitute on the normal path.',
      });
      if (!payOk) {
        console.warn('  skip record-payment — button not visible (may already be paid or panel collapsed)');
      }
    }

    // ── 9. MRN / goods receipt ────────────────────────────────
    const mrnReq = await openFirstMatchingRequest(page, [SEED.invoiced, SEED.invoicedAlt, SEED.closed]);
    if (mrnReq) {
      const mrnOk = await tryActionSnap(page, snap, {
        id: 'mrn',
        title: 'Step 9 — MRN / goods receipt (factory action)',
        buttonName: /create mrn|edit mrn/i,
        howTo: [
          '1. On an invoiced request, locate the MRN card on the invoice panel.',
          '2. Factory Managers normally click Create MRN — Super Admin can open the same form when needed.',
          '3. Confirm factory, received date (not a future date), materials lines, and gate / material photos.',
          '4. Enter driver / manager / security officer signatures as required, then submit.',
          '5. One MRN per invoice. Clients must never see the MRN number even though it exists for chain of custody.',
          '6. If you cannot open Create MRN as admin in a given environment, note that Factory performs this step and continue to Form 6 / CoD on a later-stage demo.',
        ].join('\n'),
        tips: 'Do not invent categories at the gate — categories belong on Form 6. Prefer Factory to own day-to-day MRN creation.',
      });
      if (!mrnOk) {
        console.warn('  skip mrn — Create/Edit MRN not visible; Factory typically owns this step');
        await snap(
          page,
          'mrn-note',
          'Step 9 — MRN hand-off note (factory-owned)',
          [
            '1. After invoice exists, Factory creates the MRN (goods receipt).',
            '2. Super Admin can perform MRN when covering for Factory, but training should emphasise the hand-off.',
            '3. Open an invoiced request and confirm the MRN card / status area.',
            '4. Clients never see MRN numbers — verify that boundary in Client training.',
            '5. After MRN, Factory proceeds to Process & Issue / Submit Form 6.',
          ].join('\n'),
          'Missing Create MRN on this seed is OK — document the Factory hand-off and continue with a closed sample for CoD / close context.',
        );
      }
    }

    // ── 10. Form 6 / recycling ────────────────────────────────
    const form6Req = await openFirstMatchingRequest(page, ['REQ-00047', SEED.closed, SEED.invoiced]);
    if (form6Req) {
      const form6Btn = page
        .locator('button')
        .filter({ hasText: /Process & Submit Form 6|Process & Issue Form 6|Edit Form 6|Approve &/i })
        .first();
      if (await form6Btn.isVisible({ timeout: 2500 }).catch(() => false)) {
        await form6Btn.click();
        await page.waitForTimeout(700);
        await snap(
          page,
          'form6',
          'Step 10 — Form 6 / recycling',
          [
            '1. After MRN exists, open Recycling / Form 6 controls on the invoice.',
            '2. Factory enters category split so totals equal billing weight exactly, then submits for review (or issues per design).',
            '3. Super Admin Approves & releases Form 6 (or returns it to Factory with a reason).',
            '4. Download Form 6 PDF when available for the audit pack.',
            '5. Capacity warnings near 80% / blocks at 100% TPA must be respected — document overrides.',
          ].join('\n'),
          'Category split must equal billing weight. Clients can download approved Form 6; they never see MRN.',
        );
        await dismissModal(page);
      } else {
        const recycleHdr = page.getByText(/recycling\s*\/\s*form 6|form 6/i).first();
        if (await recycleHdr.isVisible({ timeout: 2000 }).catch(() => false)) {
          await recycleHdr.scrollIntoViewIfNeeded().catch(() => {});
          await snap(
            page,
            'form6-panel',
            'Step 10 — Form 6 / recycling panel',
            [
              '1. Scroll to Recycling / Form 6 on a request that has progressed past MRN.',
              '2. Review Form 6 number, review status, and category recovery lines.',
              '3. If pending admin review, use Approve & release (or return to factory).',
              '4. If already approved, proceed to Certificate of Destruction upload.',
            ].join('\n'),
            'Closed lifecycle seeds are ideal for showing completed Form 6 without inventing categories.',
          );
        } else {
          console.warn('  skip form6 — Form 6 controls not visible on this request');
        }
      }
    }

    // ── 11. Certificate of Destruction ────────────────────────
    const codReq = await openFirstMatchingRequest(page, ['REQ-00048', SEED.closed, SEED.invoiced]);
    if (codReq) {
      await openRequest(page, codReq);
      const codOk = await tryActionSnap(page, snap, {
        id: 'certificate',
        title: 'Step 11 — Certificate of Destruction upload',
        buttonName: /upload certificate/i,
        howTo: [
          '1. After Form 6 is approved, click Upload Certificate on the Certificate of Destruction card.',
          '2. Enter a unique certificate number and certificate date.',
          '3. Attach the signed CoD PDF.',
          '4. Super Admin may historical-backdate CoD dates from 2026-04-01 when the hint is shown.',
          '5. Upload & email certificate (or equivalent). Duplicate certificate numbers must be refused.',
          '6. After CoD + payment, the Client User performs Review & Close — not Super Admin on the normal path.',
        ].join('\n'),
        tips: 'Never reuse certificate numbers. Payment can remain open on client terms without blocking CoD, but close requires both.',
      });
      if (!codOk) {
        const codHdr = page.getByText(/certificate of destruction/i).first();
        if (await codHdr.isVisible({ timeout: 2000 }).catch(() => false)) {
          await codHdr.scrollIntoViewIfNeeded().catch(() => {});
          await snap(
            page,
            'certificate-panel',
            'Step 11 — Certificate of Destruction panel',
            [
              '1. Locate the Certificate of Destruction card on the invoice.',
              '2. If Form 6 is not yet approved, the upload control stays locked — approve Form 6 first.',
              '3. When upload is available, attach the signed PDF with a unique certificate number.',
              '4. Review existing certificate rows on closed demos for the expected layout.',
            ].join('\n'),
            'If Upload Certificate is missing, the seed may already have CoD on file — use it to show the completed state.',
          );
        } else {
          console.warn('  skip certificate — CoD panel not visible');
        }
      }
    }

    // ── 12. Client close / Review & Close ─────────────────────
    const closeReq = await openFirstMatchingRequest(page, [SEED.closed, SEED.invoiced]);
    if (closeReq) {
      const closeBtn = page.getByRole('button', { name: /review\s*&\s*close/i }).first();
      if (await closeBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(700);
        await snap(
          page,
          'review-close',
          'Step 12 — Review & Close (client action)',
          [
            '1. Review & Close appears when Certificate of Destruction and payment conditions are met.',
            '2. This is a Client User action — the client acknowledges receipt of the CoD and closes Stage 9.',
            '3. Super Admin may see the control in some views; on the normal path leave closure to the client.',
            '4. Force-close (if offered) is exceptional policy (e.g. aged open invoices) and must never run while money is outstanding.',
            '5. After close, impact / Heroes figures update for closed work.',
          ].join('\n'),
          'Do not substitute for the client on happy-path training. Client Read Only cannot close.',
        );
        await dismissModal(page);
      } else {
        console.warn('  skip review-close — Review & Close not visible (expected client-owned)');
        await snap(
          page,
          'close-context',
          'Step 12 — Closure hand-off to the client',
          [
            '1. Confirm CoD is on file and payment status on the invoice panel.',
            '2. Tell trainees: Client User opens the request → Review & Close → Acknowledge closure.',
            '3. Client Read Only can view / download Form 6 and CoD but cannot raise or close.',
            '4. Super Admin verifies Audit shows certificate, payment, and close events.',
          ].join('\n'),
          'Missing Review & Close for Super Admin is expected — capture the invoice end-state and document the client hand-off.',
        );
      }
    }

    // ── 13. Reports ───────────────────────────────────────────
    await page.goto(BASE + '/reports', { waitUntil: 'networkidle' });
    await snap(
      page,
      'reports',
      'Step 13 — Operational and compliance reports',
      [
        '1. Open Reports.',
        '2. Run Request Summary, Complete Request Summary, Invoice Register, Sustainability, Heroes, Serials, Form 6 Log, Certificate Log as needed.',
        '3. Set FY / period filters and export CSV or PDF.',
        '4. Cross-check figures against a known closed REQ- during training.',
        '5. When preparing client-facing exports, ensure tenancy filters are correct — Factory MRN data must not leak to clients.',
      ].join('\n'),
      'Exports may contain multi-client data. Store them securely and share only what the recipient is entitled to see.',
    );

    // ── 14. Masters users (roles) ─────────────────────────────
    await page.goto(BASE + '/masters', { waitUntil: 'networkidle' });
    await snap(
      page,
      'masters',
      'Step 14 — Masters administration',
      [
        '1. Open Masters.',
        '2. Use tabs: Users, Clients, Sites, Factories, Categories, Lookups, Email, Company as available.',
        '3. Prefer deactivating referenced sites instead of deleting them.',
        '4. Letterhead / company profile feeds Form 6 and MRN PDFs — verify GST and address before save.',
      ].join('\n'),
      'Never disable your own Super Admin account. Prefer throwaway users for password-lockout drills.',
    );

    const usersTab = page.getByRole('button', { name: /^users$/i }).or(page.getByText(/^Users$/)).first();
    if (await usersTab.isVisible({ timeout: 2500 }).catch(() => false)) {
      await usersTab.click();
      await page.waitForTimeout(600);
      await snap(
        page,
        'masters-users',
        'Step 14b — Users: client_readonly and auditor roles',
        [
          '1. Open the Users tab.',
          '2. Create or edit users carefully — welcome emails include temporary passwords (share out-of-band only).',
          '3. Role Client Read Only: can view requests and download Form 6 / Certificate of Destruction; cannot raise or close requests.',
          '4. Role Auditor: Urbeno @urbeno.in read-only across clients — reports / audit-style visibility without mutating lifecycle.',
          '5. Other roles: Super Admin, Operations Manager, Factory Manager, Client User.',
          '6. Password reset: Edit user → Reset / regenerate → communicate temporary password securely; user must change it on next login.',
        ].join('\n'),
        'Staff and auditor emails must be @urbeno.in. Password reset signs the user out of all sessions and is audited.',
      );
      await dismissModal(page);
    } else {
      console.warn('  skip masters-users — Users tab not visible');
    }

    // ── 15. Profile + sign out ────────────────────────────────
    await page.goto(BASE + '/profile', { waitUntil: 'networkidle' });
    await redactProfilePii(page);
    await snap(
      page,
      'profile',
      'Step 15 — Profile, MFA, and letterhead',
      [
        '1. Open Profile.',
        '2. Confirm Role is Urbeno Admin / Super Admin.',
        '3. Enrol or manage Two-factor authentication (mandatory for privileged staff).',
        '4. Update password per policy when required (length + complexity).',
        '5. Edit Urbeno letterhead / company details if shown — these print on Form 6 and MRN.',
      ].join('\n'),
      'Letterhead mistakes appear on legal PDFs. Keep a break-glass second Super Admin for MFA recovery.',
    );

    const signOut = page.getByRole('button', { name: /sign out|log out|logout/i }).first();
    if (await signOut.isVisible().catch(() => false)) {
      await signOut.click();
      await page.waitForTimeout(800);
      await snap(
        page,
        'signed-out',
        'Step 15b — Sign out',
        [
          '1. Click Logout / Sign out.',
          '2. Confirm the Sign In screen appears.',
          '3. Lock the workstation if stepping away mid-session instead of leaving the portal open.',
        ].join('\n'),
        'Admin sessions can change production masters — treat them like production console access.',
      );
    } else {
      console.warn('  skip signed-out — Sign out control not visible');
    }
  });

  writeManifest(OUT, {
    role: 'lifecycle-admin',
    roleLabel: 'Super Admin',
    audience:
      'Urbeno Super Admins learning the complete e-waste lifecycle from acknowledgement through closure, plus Masters and reports',
    portal: 'https://tectrack.urbeno.in',
    version: '1',
    documentControl: 'Version 1 — Production',
    baseCaptured: BASE,
    steps,
  });
  console.log('Done.', steps.length, 'steps');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
