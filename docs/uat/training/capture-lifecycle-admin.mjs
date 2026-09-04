/**
 * Detailed Super Admin lifecycle training screenshots.
 * Walks a fresh mock request through stages 1–9 with a screenshot for every major form.
 * Usage: BASE_URL=http://localhost:8080 node docs/uat/training/capture-lifecycle-admin.mjs
 */
import {
  clearShots,
  fillPhone,
  fixturePaths,
  logout,
  makeSnapper,
  redactProfilePii,
  roleOutDir,
  signIn,
  waitToast,
  withBrowser,
  writeManifest,
} from './_capture-lib.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:8080';
const ADMIN = process.env.TEST_EMAIL || 'admin@urbeno.in';
const PASSWORD = process.env.TEST_PASSWORD || 'demo';
const FACTORY = process.env.FACTORY_EMAIL || 'blr@urbeno.in';
const CLIENT = process.env.CLIENT_EMAIL || 'ramesh@techcorp.in';
const OUT = roleOutDir('lifecycle-admin');
const steps = [];
const { photo, pdf } = fixturePaths();

async function dismissModal(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(400);
}

async function readReqId(page) {
  const heading = await page.getByRole('heading', { level: 1 }).textContent().catch(() => '');
  const m = String(heading || page.url()).match(/REQ-[\w-]+/);
  return m ? m[0] : null;
}

async function openReq(page, id) {
  await page.goto(`${BASE}/requests/${id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
}

async function main() {
  clearShots(OUT);
  const snap = makeSnapper(OUT, steps);
  const uniq = Date.now().toString().slice(-6);
  console.log('Detailed Super Admin lifecycle capture →', OUT);

  await withBrowser(async (page) => {
    // ── Login ────────────────────────────────────────────────
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'login',
      'Step 1 — Sign in as Super Admin',
      [
        '1. Open https://tectrack.urbeno.in.',
        '2. Enter your @urbeno.in Super Admin email.',
        '3. Enter your password and click Sign In.',
        '4. Complete MFA if enrolled; accept policies on first login.',
        '5. Change a temporary password immediately when prompted.',
      ].join('\n'),
      'Super Admin can backdate historical lifecycle dates from 2026-04-01. Protect MFA.',
    );
    await signIn(page, BASE, ADMIN, PASSWORD, { alreadyOnLogin: true });

    // ── Dashboard ────────────────────────────────────────────
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'dashboard',
      'Step 2 — Super Admin dashboard',
      [
        '1. Confirm Super Admin Dashboard with KPIs and work queues.',
        '2. Review navigation: Dashboard, Requests, Heroes, Sustainability, Capacity, Masters, Reports, Audit, Compliance.',
        '3. Use Acknowledge / New Requests tiles to jump into Stage 1 work.',
        '4. Hand-off map: Ops often does ack → vehicle → weigh; Factory does MRN → Form 6; you cover invoice, CoD, Masters, Audit, Compliance, and historical backdating.',
      ].join('\n'),
      'You see every organisation. Treat client data as confidential.',
    );

    // ── Staff new request (historical) ───────────────────────
    await page.goto(BASE + '/requests/new', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const clientSel = page.locator('#ns-cid');
    if (await clientSel.isVisible({ timeout: 4000 }).catch(() => false)) {
      const opts = await clientSel.locator('option').allTextContents();
      const tech = opts.findIndex((t) => /techcorp/i.test(t));
      if (tech > 0) await clientSel.selectOption({ index: tech });
      else if (opts.length > 1) await clientSel.selectOption({ index: 1 });
      await page.waitForTimeout(500);
    }
    const siteSel = page.locator('#ns-site');
    if (await siteSel.isVisible().catch(() => false)) {
      const siteOpts = await siteSel.locator('option').count();
      if (siteOpts > 1) await siteSel.selectOption({ index: 1 });
    }
    await page.locator('#ns-loc').fill(`Training bay ${uniq}`);
    await page.locator('#ns-ref').fill(`PO-TRAIN-${uniq}`);
    await page.locator('#ns-date').fill('2026-05-10');
    await page.locator('#ns-qty').fill('12');
    await page.locator('#ns-wt').fill('75');
    await page.locator('#ns-notes').fill(`Historical training walkthrough ${uniq}`);
    const item = page.getByPlaceholder('Item description');
    if (await item.isVisible().catch(() => false)) await item.fill(`Training e-waste ${uniq}`);
    await snap(
      page,
      'staff-new-request',
      'Step 3 — Staff-created / historically backdated request',
      [
        '1. Open Requests → + New Request.',
        '2. Choose Client and Site (Super Admin only sees the client dropdown).',
        '3. Enter pickup location, optional PO, approx qty/weight, notes, and line items.',
        '4. Set Pick-up request date. Super Admin may use dates from 2026-04-01 for FY catch-up.',
        '5. Click Submit Request and note the new REQ- number.',
      ].join('\n'),
      'Operations and Client users cannot open the Super Admin historical window. Document why a historical request was raised in notes.',
    );
    await page.getByRole('button', { name: /submit request/i }).click();
    await page.waitForTimeout(2000);
    let reqId = await readReqId(page);
    if (!reqId) {
      console.warn('Could not create training request — falling back to seeded demos');
      reqId = 'REQ-00099';
      await openReq(page, reqId);
    }
    await snap(
      page,
      'request-created',
      'Step 4 — Request created (Stage 1)',
      [
        `1. Confirm the heading shows ${reqId} (or your new REQ-).`,
        '2. Read site, approx weight, request date, and Bill of Materials / line items.',
        '3. Stage 1 actions: Acknowledge Request, Request changes, or Reject.',
        '4. Share the REQ- with Operations / Factory as the job advances.',
      ].join('\n'),
      'Clients raise Stage 1 normally; staff create is for Super Admin catch-up or on-behalf work.',
    );

    // ── Acknowledge ──────────────────────────────────────────
    const ackBtn = page.getByRole('button', { name: /acknowledge request/i }).first();
    if (await ackBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ackBtn.click();
      await page.waitForTimeout(600);
      await snap(
        page,
        'acknowledge',
        'Step 5 — Acknowledge Request modal',
        [
          '1. Click Acknowledge Request.',
          '2. Review client, site, approx weight/units, and requestor in the modal.',
          '3. Confirm — acknowledgement email uses the Request Acknowledgement template.',
          '4. Expected outcome: stage advances to Vehicles & Weighment.',
        ].join('\n'),
        'Use Request changes with a clear note when client data is incomplete — do not invent site details.',
      );
      await page.locator('.modal').getByRole('button', { name: /^acknowledge$/i }).click();
      await waitToast(page, /acknowledged/i);
      await page.waitForTimeout(800);
    }

    // ── Assign vehicle (backdate) ────────────────────────────
    const assignBtn = page.getByRole('button', { name: /assign vehicle|add vehicle/i }).first();
    if (await assignBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await assignBtn.click();
      await page.waitForTimeout(600);
      await page.getByLabel(/registration/i).fill(`KATR${uniq}`);
      await page.getByLabel(/driver name/i).fill('Training Driver');
      await fillPhone(page, 'Driver phone', '9900112233');
      await page.locator('#vh-exp-date').fill('2026-05-15');
      await page.locator('#vh-exp-time').fill('09:00');
      await snap(
        page,
        'assign-vehicle',
        'Step 6 — Assign Vehicle (historical expected pickup)',
        [
          '1. Click Assign Vehicle (or + Add Vehicle).',
          '2. Enter registration (letters/numbers only), type, logistics partner, driver, phone.',
          '3. Set Expected pickup date & time — Super Admin historical window from 2026-04-01.',
          '4. Add team members if required.',
          '5. Click Assign vehicle.',
        ].join('\n'),
        'Operations cannot backdate expected pickup. Never invent a live registration plate.',
      );
      await page.locator('.modal').getByRole('button', { name: /assign vehicle/i }).click();
      await waitToast(page, /vehicle assigned/i);
      await page.waitForTimeout(800);
      await snap(
        page,
        'vehicle-assigned',
        'Step 7 — Vehicle listed on request',
        [
          '1. Confirm the vehicle row appears under Vehicles & Weighment.',
          '2. Check registration, driver, and expected pickup date.',
          '3. Add more vehicles if the pickup needs them — each carries its own weighment.',
          '4. Next: Record Weighment on each vehicle.',
        ].join('\n'),
        'Weighment is per vehicle. Do not raise an invoice until every vehicle is weighed and loading is acknowledged.',
      );
    }

    // ── Weighment ────────────────────────────────────────────
    const weighBtn = page.getByRole('button', { name: /weigh|record weighment/i }).first();
    if (await weighBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await weighBtn.click();
      await page.waitForTimeout(700);
      const files = page.locator('.modal input[type="file"]');
      if ((await files.count()) >= 2) {
        await files.nth(0).setInputFiles(photo);
        await files.nth(1).setInputFiles(photo);
        await page.waitForTimeout(2000);
        await page.locator('.modal').getByText(/sample|\.jpg/i).first().waitFor({ timeout: 15000 }).catch(() => {});
      }
      const slip = page.locator('.modal label', { hasText: /slip/i }).locator('..').locator('input').first();
      if (await slip.isVisible().catch(() => false)) await slip.fill(`WB-TRN-${uniq}`);
      else await page.getByPlaceholder('WS-0042').fill(`WB-TRN-${uniq}`).catch(() => {});
      const gross = page.locator('.modal label', { hasText: /gross/i }).locator('..').locator('input').first();
      const tare = page.locator('.modal label', { hasText: /tare/i }).locator('..').locator('input').first();
      if (await gross.isVisible().catch(() => false)) await gross.fill('5200');
      if (await tare.isVisible().catch(() => false)) await tare.fill('5125');
      const whDate = page.locator('#wh-dt-date');
      if (await whDate.isVisible().catch(() => false)) await whDate.fill('2026-05-16');
      await snap(
        page,
        'weighment-form',
        'Step 8 — Record Weighment form',
        [
          '1. Click Record Weighment / Weigh on the vehicle row.',
          '2. Enter slip number, gross kg, and tare kg — confirm net = gross − tare.',
          '3. Set Weighment date (Super Admin may historical-backdate from 2026-04-01; Ops is today only).',
          '4. Attach weighment slip photo(s) and pickup photo(s) — both required.',
          '5. Click Record weighment.',
        ].join('\n'),
        'Refuse weighment without both photo sets. Do not invent weights.',
      );
      const recordBtn = page.locator('.modal').getByRole('button', { name: /record weighment/i });
      await recordBtn.click({ force: true }).catch(() => {});
      await waitToast(page, /weighment recorded/i);
      await page.waitForTimeout(800);
      await dismissModal(page);
    }

    // ── Loading complete ─────────────────────────────────────
    const loadBtn = page.getByRole('button', { name: /acknowledge loading complete/i }).first();
    if (await loadBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await snap(
        page,
        'loading-complete',
        'Step 9 — Acknowledge loading complete',
        [
          '1. After every vehicle is weighed, click Acknowledge loading complete.',
          '2. Confirm the action — this unlocks Raise Invoice for Super Admin.',
          '3. Do not leave consignments stuck awaiting loading acknowledgement.',
        ].join('\n'),
        'Missing this step blocks billing even when weighment evidence is complete.',
      );
      await loadBtn.click();
      await waitToast(page, /loading acknowledged/i);
      await page.waitForTimeout(800);
    }

    // ── Raise invoice ────────────────────────────────────────
    const invBtn = page.getByRole('button', { name: /raise invoice|add invoice/i }).first();
    if (await invBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await invBtn.click();
      await page.waitForTimeout(700);
      await page.locator('#iv-no').fill(`INV-TRN-${uniq}`);
      await page.locator('#iv-dt').fill('2026-05-18');
      await page.locator('#iv-amt').fill('8500');
      const tax = page.locator('#iv-tax');
      if (await tax.isVisible().catch(() => false)) {
        const has18 = await tax.locator('option[value="TX18"]').count();
        if (has18) await tax.selectOption('TX18');
        else {
          const opts = await tax.locator('option').count();
          if (opts > 1) await tax.selectOption({ index: 1 });
        }
      }
      await page.locator('#iv-ew').fill(`EWB-TRN-${uniq}`);
      await page.locator('#iv-ewdt').fill('2026-05-18');
      await page.locator('#iv-wt').fill('75');
      await snap(
        page,
        'raise-invoice',
        'Step 10 — Raise Invoice form',
        [
          '1. Click Raise Invoice (or Add Invoice for a split).',
          '2. Enter invoice number, invoice date, taxable amount, and tax rate — totals calculate automatically.',
          '3. Enter e-way bill number and date; attach PDFs when required.',
          '4. Confirm billing weight (defaults from vehicle net); add a deviation note if it differs.',
          '5. Super Admin may historical-backdate invoice / e-way dates from 2026-04-01 (not future).',
          '6. Click Create invoice.',
        ].join('\n'),
        'Do not type tax totals manually. Keep invoice numbers unique within the request.',
      );
      await page.locator('.modal').getByRole('button', { name: /create invoice/i }).click();
      await waitToast(page, /invoice created/i);
      await page.waitForTimeout(1000);
      await snap(
        page,
        'invoice-created',
        'Step 11 — Invoice on the request panel',
        [
          '1. Review invoice number, taxable / tax / total, billing weight, and e-way details.',
          '2. Factory can now Create MRN; you can Record Payment and later Upload Certificate.',
          '3. Use Add Invoice only when splitting one pickup into another bill.',
        ].join('\n'),
        'After invoices exist, coordinate so Factory is ready at the gate.',
      );
    }

    // ── Factory MRN + Form 6 (switch user) ───────────────────
    await logout(page, BASE);
    await signIn(page, BASE, FACTORY, PASSWORD);
    await openReq(page, reqId);
    await page.waitForTimeout(800);

    const mrnBtn = page.getByRole('button', { name: /create mrn/i }).first();
    if (await mrnBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await mrnBtn.click();
      await page.waitForTimeout(700);
      const sec = page.locator('#mr-sec');
      if (await sec.isVisible().catch(() => false)) await sec.fill('Gate Security');
      const mrnFiles = page.locator('.modal input[type="file"]');
      if ((await mrnFiles.count()) >= 2) {
        await mrnFiles.nth(0).setInputFiles(photo);
        await mrnFiles.nth(1).setInputFiles(photo);
        await page.waitForTimeout(1200);
      }
      const mrDate = page.locator('#mr-dt');
      if (await mrDate.isVisible().catch(() => false)) await mrDate.fill('2026-05-20');
      await snap(
        page,
        'create-mrn',
        'Step 12 — Create MRN (goods receipt)',
        [
          '1. On an invoiced request, click Create MRN (Factory normally owns this; Super Admin may cover).',
          '2. Confirm factory, receiving date, material lines (weight must match billing weight), and condition.',
          '3. Fill Security Officer and attach gate + material photos.',
          '4. Click Record goods receipt (MRN).',
          '5. Clients must never see the MRN number.',
        ].join('\n'),
        'One MRN per invoice. Do not invent categories at the gate — categories belong on Form 6.',
      );
      await page.locator('.modal').getByRole('button', { name: /record goods receipt|save mrn|create mrn/i }).click();
      await waitToast(page, /mrn created/i);
      await page.waitForTimeout(1000);
    } else {
      console.warn('Create MRN not visible — capturing request context');
      await snap(
        page,
        'mrn-context',
        'Step 12 — MRN context (factory hand-off)',
        [
          '1. After invoice exists, Factory creates the MRN.',
          '2. Open the invoice panel and locate the MRN card.',
          '3. Prefer Factory to own day-to-day MRN creation.',
        ].join('\n'),
        'Missing Create MRN usually means MRN already exists or invoice is not ready.',
      );
    }

    const form6Btn = page
      .locator('button')
      .filter({ hasText: /Process & Submit Form 6|Process & Issue Form 6|Edit Form 6/i })
      .first();
    if (await form6Btn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await form6Btn.click();
      await page.waitForTimeout(900);
      await snap(
        page,
        'form6-form',
        'Step 13 — Process Form 6 / recycling',
        [
          '1. Click Process & Submit Form 6 for Review (Factory) or Process & Issue Form 6 (admin cover).',
          '2. Set Processing Date; enter category split so totals equal billing weight exactly.',
          '3. Select vehicles on this Form 6 and complete recovery fields.',
          '4. Watch Capacity (80% warn / 100% block).',
          '5. Submit for admin review or Issue when permitted.',
        ].join('\n'),
        'Category split must equal billing weight. Clients download approved Form 6 only — never MRN.',
      );
      const issue = page
        .locator('.modal')
        .getByRole('button', { name: /issue form 6|submit for admin review|save form 6/i })
        .first();
      if (await issue.isVisible().catch(() => false)) {
        await issue.click();
        await waitToast(page, /recycling|form 6|submitted|recorded/i);
        await page.waitForTimeout(1000);
      } else {
        await dismissModal(page);
      }
    }

    // ── Back to admin: approve / CoD / payment ───────────────
    await logout(page, BASE);
    await signIn(page, BASE, ADMIN, PASSWORD);
    await openReq(page, reqId);
    await page.waitForTimeout(800);

    const approveBtn = page
      .locator('button')
      .filter({ hasText: /Approve.*Form 6|Approve &/i })
      .first();
    if (await approveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await snap(
        page,
        'approve-form6',
        'Step 14 — Approve & release Form 6',
        [
          '1. When Factory submitted Form 6 for review, open the Admin review card.',
          '2. Click Approve & release Form 6 (or return to factory with a reason).',
          '3. Client is notified when Form 6 is released; CoD upload unlocks after approval.',
        ].join('\n'),
        'Do not upload CoD before Form 6 is approved.',
      );
      await approveBtn.click();
      await waitToast(page, /approved|released/i);
      await page.waitForTimeout(800);
    }

    const codBtn = page.getByRole('button', { name: /upload certificate/i }).first();
    if (await codBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await codBtn.click();
      await page.waitForTimeout(700);
      await page.locator('.modal input[type="file"]').first().setInputFiles(pdf);
      await page.waitForTimeout(1000);
      const certNo = page.getByLabel(/certificate (no|number)/i).first();
      if (await certNo.isVisible().catch(() => false)) await certNo.fill(`DCOD-TRN-${uniq}`);
      const certDate = page.locator('.modal input[type="date"]').first();
      if (await certDate.isVisible().catch(() => false)) await certDate.fill('2026-05-22');
      await snap(
        page,
        'upload-certificate',
        'Step 15 — Upload Certificate of Destruction',
        [
          '1. After Form 6 is approved, click Upload Certificate.',
          '2. Enter a unique certificate number and certificate date.',
          '3. Attach the signed CoD PDF.',
          '4. Super Admin may historical-backdate CoD dates from 2026-04-01.',
          '5. Upload & email certificate.',
        ].join('\n'),
        'Never reuse certificate numbers across the system.',
      );
      await page.locator('.modal').getByRole('button', { name: /upload.*certificate/i }).click();
      await waitToast(page, /certificate uploaded/i);
      await page.waitForTimeout(800);
    }

    const payBtn = page.getByRole('button', { name: /record payment/i }).first();
    if (await payBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await payBtn.click();
      await page.waitForTimeout(700);
      await page.getByLabel(/utr|reference/i).fill(`UTR-TRN-${uniq}`);
      const payDate = page.getByLabel(/payment date/i);
      if (await payDate.isVisible().catch(() => false)) {
        // leave default or set historical
      }
      await snap(
        page,
        'record-payment',
        'Step 16 — Record Payment',
        [
          '1. Click + Record Payment on the invoice panel.',
          '2. Enter UTR / reference, amount, mode, and payment date.',
          '3. Capture TDS if applicable.',
          '4. Super Admin may historical-backdate payment dates from 2026-04-01.',
          '5. Save — client still cannot close until CoD + payment are both complete.',
        ].join('\n'),
        'Record real bank references only. Payment does not block Form 6 / CoD, but close requires both.',
      );
      await page.locator('.modal').getByRole('button', { name: /record payment/i }).click();
      await waitToast(page, /payment recorded/i);
      await page.waitForTimeout(800);
    }

    await snap(
      page,
      'ready-to-close',
      'Step 17 — Ready for client Review & Close',
      [
        '1. Confirm CoD and payment appear on the invoice panel.',
        '2. Hand off to the Client User: Review & Close → Acknowledge closure.',
        '3. Client Read Only can download Form 6 / CoD but cannot close.',
        '4. Verify Audit later for certificate, payment, and close events.',
      ].join('\n'),
      'Super Admin does not normally close for the client — leave Stage 9 to the Client User.',
    );

    // ── Client close (for completeness of lifecycle pack) ────
    await logout(page, BASE);
    await signIn(page, BASE, CLIENT, PASSWORD);
    await openReq(page, reqId);
    await page.waitForTimeout(800);
    const closeBtn = page.getByRole('button', { name: /review\s*&\s*close/i }).first();
    if (await closeBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(600);
      await snap(
        page,
        'client-review-close',
        'Step 18 — Client Review & Close (hand-off demo)',
        [
          '1. Client opens the request when CoD + payment are complete.',
          '2. Clicks Review & Close and acknowledges closure.',
          '3. Stage moves to Closed (Stage 9).',
          '4. Shown here so Super Admin trainers can teach the hand-off end-to-end.',
        ].join('\n'),
        'This is a Client User action on the normal path.',
      );
      await page.locator('.modal').getByRole('button', { name: /acknowledge closure/i }).click();
      await waitToast(page, /closed/i);
      await page.waitForTimeout(800);
    }

    // ── Admin secondary modules ──────────────────────────────
    await logout(page, BASE);
    await signIn(page, BASE, ADMIN, PASSWORD);

    await page.goto(BASE + '/requests', { waitUntil: 'networkidle' });
    await snap(
      page,
      'requests-queue',
      'Step 19 — Requests queue across stages',
      [
        '1. Open Requests.',
        '2. Scan stage badges and invoice mini-badges.',
        '3. Filter or search for work by stage or REQ- id.',
        '4. Prefer seeded or training REQ- ids for classroom demos.',
      ].join('\n'),
      'Walk one request carefully before bulk practice.',
    );

    await page.goto(BASE + '/capacity', { waitUntil: 'networkidle' });
    await snap(
      page,
      'capacity',
      'Step 20 — Capacity oversight',
      [
        '1. Open Capacity.',
        '2. Review utilisation across factories and categories.',
        '3. Support Factory when an override is justified and documented.',
        '4. Prefer routing to another plant over chronic overrides.',
      ].join('\n'),
      'Overrides are audited.',
    );

    await page.goto(BASE + '/heroes', { waitUntil: 'networkidle' });
    await snap(
      page,
      'heroes',
      'Step 21 — Recycling Heroes',
      [
        '1. Open Recycling Heroes.',
        '2. Review organisation tonnage and planting milestones.',
        '3. Record planting when authorised (photos, location, counts).',
      ].join('\n'),
      'Keep photo evidence for CSR storytelling.',
    );

    await page.goto(BASE + '/impact', { waitUntil: 'networkidle' });
    await snap(
      page,
      'sustainability',
      'Step 22 — Sustainability',
      [
        '1. Open Sustainability.',
        '2. Review recycled weight and impact figures.',
        '3. Use methodology notes when preparing client packs.',
      ].join('\n'),
      'In-progress pickups should not inflate closed impact.',
    );

    await page.goto(BASE + '/reports', { waitUntil: 'networkidle' });
    await snap(
      page,
      'reports',
      'Step 23 — Reports and exports',
      [
        '1. Open Reports.',
        '2. Run Request Summary, Invoice Register, Form 6 Log, Certificate Log, Sustainability, Heroes, Serials as needed.',
        '3. Set FY / period filters and export CSV or PDF.',
        '4. Ensure tenancy filters are correct for client-facing packs.',
      ].join('\n'),
      'Exports may contain multi-client data — store securely.',
    );

    await page.goto(BASE + '/masters', { waitUntil: 'networkidle' });
    await snap(
      page,
      'masters',
      'Step 24 — Masters administration',
      [
        '1. Open Masters.',
        '2. Use tabs: Users, Clients, Sites, Factories, Categories, Lookups, Email, Company.',
        '3. Prefer deactivating referenced sites instead of deleting them.',
        '4. Letterhead feeds Form 6 and MRN PDFs — verify GST and address.',
      ].join('\n'),
      'Never disable your own Super Admin account.',
    );

    const usersTab = page.getByRole('button', { name: /^users$/i }).or(page.getByText(/^Users$/)).first();
    if (await usersTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await usersTab.click();
      await page.waitForTimeout(600);
    }
    await snap(
      page,
      'masters-users',
      'Step 25 — Users (roles including client_readonly / auditor)',
      [
        '1. Open the Users tab.',
        '2. Create/edit users carefully — welcome emails include temporary passwords.',
        '3. Roles: Super Admin, Operations, Factory, Client User, Client Read Only, Auditor.',
        '4. Client Read Only: view + Form 6/CoD download; cannot raise or close.',
        '5. Auditor: @urbeno.in read-only across clients.',
        '6. Password reset: Edit → Reset → share temporary password out-of-band.',
      ].join('\n'),
      'Staff and auditor emails must be @urbeno.in. Resets are audited.',
    );

    await page.goto(BASE + '/audit', { waitUntil: 'networkidle' });
    await snap(
      page,
      'audit',
      'Step 26 — Audit trail',
      [
        '1. Open Audit.',
        '2. Filter by request id, actor, action, or date range.',
        '3. Confirm lifecycle events: ack, vehicle, weigh, invoice, MRN, Form 6, certificate, payment, close.',
      ].join('\n'),
      'If an expected event is missing, investigate before production sign-off.',
    );

    await page.goto(BASE + '/compliance', { waitUntil: 'networkidle' });
    await snap(
      page,
      'compliance',
      'Step 27 — Compliance registers',
      [
        '1. Open Compliance.',
        '2. Review privacy, DSR, incidents, access reviews, and control status.',
        '3. Confirm factory and client users cannot open this area.',
      ].join('\n'),
      'Compliance is Super Admin only — a factory/client reaching it is a Blocker.',
    );

    await page.goto(BASE + '/profile', { waitUntil: 'networkidle' });
    await redactProfilePii(page);
    await snap(
      page,
      'profile',
      'Step 28 — Profile, MFA, and letterhead',
      [
        '1. Open Profile.',
        '2. Confirm Role is Super Admin.',
        '3. Enrol or manage Two-factor authentication.',
        '4. Update password per policy when required.',
        '5. Edit Urbeno letterhead / company details if shown.',
      ].join('\n'),
      'Letterhead mistakes appear on legal PDFs.',
    );

    await logout(page, BASE);
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'signed-out',
      'Step 29 — Sign out',
      [
        '1. Click Logout / Sign out.',
        '2. Confirm the Sign In screen appears.',
        '3. Lock the workstation if stepping away mid-session.',
      ].join('\n'),
      'Admin sessions can change production masters — treat them like console access.',
    );
  });

  writeManifest(OUT, {
    role: 'lifecycle-admin',
    roleLabel: 'Super Admin — Complete Lifecycle',
    audience:
      'Urbeno Super Admins learning every lifecycle form from staff request / acknowledgement through client closure, plus Masters, Audit, and Compliance',
    portal: 'https://tectrack.urbeno.in',
    version: '1',
    documentControl: 'Version 1 — Production (detailed)',
    baseCaptured: BASE,
    steps,
  });
  console.log('Done.', steps.length, 'steps');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
