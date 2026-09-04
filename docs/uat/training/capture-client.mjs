/**
 * Detailed Client User process-flow training screenshots.
 * Covers login → raise request → track stages → documents → close → impact/reports.
 * Advances one mock request through Urbeno/factory steps so Review & Close can be shown.
 *
 * Usage: BASE_URL=http://localhost:8080 node docs/uat/training/capture-client.mjs
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
const CLIENT = process.env.TEST_EMAIL || 'ramesh@techcorp.in';
const ADMIN = process.env.ADMIN_EMAIL || 'admin@urbeno.in';
const FACTORY = process.env.FACTORY_EMAIL || 'blr@urbeno.in';
const PASSWORD = process.env.TEST_PASSWORD || 'demo';
const OUT = roleOutDir('client');
const steps = [];
const { photo, pdf } = fixturePaths();

async function dismissModal(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(350);
}

async function openReq(page, id) {
  await page.goto(`${BASE}/requests/${id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
}

async function readReqId(page) {
  const heading = await page.getByRole('heading', { level: 1 }).textContent().catch(() => '');
  return String(heading || page.url()).match(/REQ-[\w-]+/)?.[0] || null;
}

/** Quietly advance a request so the client can practice Review & Close. */
async function staffAdvanceToClosable(page, reqId, uniq) {
  await logout(page, BASE);
  await signIn(page, BASE, ADMIN, PASSWORD);
  await openReq(page, reqId);

  const ack = page.getByRole('button', { name: /acknowledge request/i }).first();
  if (await ack.isVisible({ timeout: 3000 }).catch(() => false)) {
    await ack.click();
    await page.locator('.modal').getByRole('button', { name: /^acknowledge$/i }).click();
    await waitToast(page, /acknowledged/i);
    await page.waitForTimeout(600);
  }

  const assign = page.getByRole('button', { name: /assign vehicle|add vehicle/i }).first();
  if (await assign.isVisible({ timeout: 3000 }).catch(() => false)) {
    await assign.click();
    await page.getByLabel(/registration/i).fill(`KACL${uniq}`);
    await page.getByLabel(/driver name/i).fill('Client Training Driver');
    await fillPhone(page, 'Driver phone', '9845012345');
    await page.locator('#vh-exp-time').fill('11:00');
    await page.locator('.modal').getByRole('button', { name: /assign vehicle/i }).click();
    await waitToast(page, /vehicle assigned/i);
    await page.waitForTimeout(600);
  }

  const weigh = page.getByRole('button', { name: /weigh|record weighment/i }).first();
  if (await weigh.isVisible({ timeout: 3000 }).catch(() => false)) {
    await weigh.click();
    await page.waitForTimeout(500);
    const files = page.locator('.modal input[type="file"]');
    if ((await files.count()) >= 2) {
      await files.nth(0).setInputFiles(photo);
      await files.nth(1).setInputFiles(photo);
      await page.waitForTimeout(1500);
    }
    await page.getByPlaceholder('WS-0042').fill(`WB-CL-${uniq}`).catch(() => {});
    const gross = page.locator('.modal label', { hasText: /gross/i }).locator('..').locator('input').first();
    const tare = page.locator('.modal label', { hasText: /tare/i }).locator('..').locator('input').first();
    if (await gross.isVisible().catch(() => false)) await gross.fill('5050');
    if (await tare.isVisible().catch(() => false)) await tare.fill('5000');
    await page.locator('.modal').getByRole('button', { name: /record weighment/i }).click({ force: true });
    await waitToast(page, /weighment recorded/i);
    await dismissModal(page);
  }

  const load = page.getByRole('button', { name: /acknowledge loading complete/i }).first();
  if (await load.isVisible({ timeout: 2500 }).catch(() => false)) {
    await load.click();
    await waitToast(page, /loading acknowledged/i);
  }

  const inv = page.getByRole('button', { name: /raise invoice/i }).first();
  if (await inv.isVisible({ timeout: 3000 }).catch(() => false)) {
    await inv.click();
    await page.locator('#iv-no').fill(`INV-CL-${uniq}`);
    await page.locator('#iv-dt').fill('2026-05-20');
    await page.locator('#iv-amt').fill('5000');
    const tax = page.locator('#iv-tax');
    if (await tax.locator('option[value="TX18"]').count()) await tax.selectOption('TX18');
    else if ((await tax.locator('option').count()) > 1) await tax.selectOption({ index: 1 });
    await page.locator('#iv-ew').fill(`EWB-CL-${uniq}`);
    await page.locator('#iv-ewdt').fill('2026-05-20');
    await page.locator('#iv-wt').fill('50');
    await page.locator('.modal').getByRole('button', { name: /create invoice/i }).click();
    await waitToast(page, /invoice created/i);
    await page.waitForTimeout(800);
  }

  await logout(page, BASE);
  await signIn(page, BASE, FACTORY, PASSWORD);
  await openReq(page, reqId);

  const mrn = page.getByRole('button', { name: /create mrn/i }).first();
  if (await mrn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await mrn.click();
    await page.locator('#mr-sec').fill('Gate Security');
    const mrnFiles = page.locator('.modal input[type="file"]');
    if ((await mrnFiles.count()) >= 2) {
      await mrnFiles.nth(0).setInputFiles(photo);
      await mrnFiles.nth(1).setInputFiles(photo);
      await page.waitForTimeout(1200);
    }
    await page.locator('.modal').getByRole('button', { name: /record goods receipt/i }).click();
    await waitToast(page, /mrn created/i);
    await page.waitForTimeout(800);
  }

  const form6 = page
    .locator('button')
    .filter({ hasText: /Process & Submit Form 6|Process & Issue Form 6/i })
    .first();
  if (await form6.isVisible({ timeout: 3000 }).catch(() => false)) {
    await form6.click();
    await page.waitForTimeout(700);
    const issue = page
      .locator('.modal')
      .getByRole('button', { name: /issue form 6|submit for admin review/i })
      .first();
    if (await issue.isVisible().catch(() => false)) {
      await issue.click();
      await waitToast(page, /recycling|form 6|submitted|recorded/i);
      await page.waitForTimeout(800);
    } else await dismissModal(page);
  }

  await logout(page, BASE);
  await signIn(page, BASE, ADMIN, PASSWORD);
  await openReq(page, reqId);

  const approve = page.locator('button').filter({ hasText: /Approve.*Form 6|Approve &/i }).first();
  if (await approve.isVisible({ timeout: 3000 }).catch(() => false)) {
    await approve.click();
    await waitToast(page, /approved|released/i);
    await page.waitForTimeout(600);
  }

  const cod = page.getByRole('button', { name: /upload certificate/i }).first();
  if (await cod.isVisible({ timeout: 3000 }).catch(() => false)) {
    await cod.click();
    await page.locator('.modal input[type="file"]').first().setInputFiles(pdf);
    await page.waitForTimeout(1000);
    await page.getByLabel(/certificate (no|number)/i).fill(`DCOD-CL-${uniq}`);
    await page.locator('.modal').getByRole('button', { name: /upload.*certificate/i }).click();
    await waitToast(page, /certificate uploaded/i);
    await page.waitForTimeout(600);
  }

  const pay = page.getByRole('button', { name: /record payment/i }).first();
  if (await pay.isVisible({ timeout: 3000 }).catch(() => false)) {
    await pay.click();
    await page.getByLabel(/utr|reference/i).fill(`UTR-CL-${uniq}`);
    await page.locator('.modal').getByRole('button', { name: /record payment/i }).click();
    await waitToast(page, /payment recorded/i);
    await page.waitForTimeout(600);
  }

  await logout(page, BASE);
  await signIn(page, BASE, CLIENT, PASSWORD);
}

async function main() {
  clearShots(OUT);
  const snap = makeSnapper(OUT, steps);
  const uniq = Date.now().toString().slice(-6);
  console.log('Detailed Client User process-flow capture →', OUT);

  await withBrowser(async (page) => {
    // ── 1. Login ─────────────────────────────────────────────
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'login',
      'Step 1 — Sign in to the Client portal',
      [
        '1. Open https://tectrack.urbeno.in in Chrome, Edge, or Safari.',
        '2. Enter the work email from your Urb TecTrack welcome / account notification.',
        '3. Enter the temporary password from that email (or your current password).',
        '4. Click Sign In.',
        '5. On first login: set a new password when prompted (10+ characters, upper, lower, digit).',
        '6. Accept Terms of Use and Privacy Policy when the policy gate appears.',
      ].join('\n'),
      'Never share passwords. Client Users typically do not use MFA (unlike Urbeno staff). Contact info@urbeno.in if locked out — never email your password.',
    );
    await signIn(page, BASE, CLIENT, PASSWORD, { alreadyOnLogin: true });

    // ── 2. Home ──────────────────────────────────────────────
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'home',
      'Step 2 — Home dashboard (your organisation only)',
      [
        '1. Confirm you land on Home with a welcome line showing your name and organisation.',
        '2. Review tiles: open requests, completed work, recycled kg, trees planted.',
        '3. Note navigation: Home, My Requests, Recycling Heroes, Sustainability, Reports.',
        '4. Confirm you do NOT see Masters, Audit, Capacity, or Compliance.',
        '5. Use + New Request to start a pickup.',
      ].join('\n'),
      'PROCESS FLOW (client view): You raise (Stage 1) → Urbeno acknowledges / vehicles / weigh / invoice → Factory MRN & Form 6 → Urbeno uploads CoD & records payment → you download Form 6/CoD → you Review & Close (Stage 9).',
    );

    // ── 3. Process map (home + callout via tip; also snap my-requests empty state later)
    await snap(
      page,
      'process-overview',
      'Step 3 — Your role in the nine-stage process',
      [
        '1. Remember which stages you own vs Urbeno:',
        '   • Stage 1 Request — YOU raise (and resubmit if changes requested).',
        '   • Stages 2–8 — Urbeno Operations / Super Admin / Factory advance the job.',
        '   • Stage 9 Closed — YOU acknowledge after CoD + payment.',
        '2. You can view vehicles, invoices, Form 6, and CoD when ready — but you never Create MRN, Acknowledge, Assign Vehicle, Weigh, Raise Invoice, or Upload Certificate.',
        '3. Client Read Only users can view/download but cannot raise or close.',
      ].join('\n'),
      'If you ever see another company’s request or an MRN number, stop and report a Blocker to info@urbeno.in.',
    );

    // ── 4. Blank new request ─────────────────────────────────
    await page.goto(BASE + '/requests/new', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await snap(
      page,
      'new-request-blank',
      'Step 4 — Open New Collection Request (blank form)',
      [
        '1. From Home or My Requests, click + New Request.',
        '2. Confirm the heading New Collection Request.',
        '3. There is no Client dropdown — your organisation is implied.',
        '4. Required fields typically include: Site, Pickup Location, Pick Up Request Date, Approx. Quantity, Approx. Weight, and at least one line item or BoM.',
      ].join('\n'),
      'Leave a required field empty once in training to see validation, then fill correctly. Exact weight is captured later at Urbeno weighment.',
    );

    // ── 5. Filled form ───────────────────────────────────────
    const site = page.locator('#ns-site');
    if (await site.isVisible().catch(() => false) && (await site.locator('option').count()) > 1) {
      await site.selectOption({ index: 1 });
    }
    await page.getByLabel(/pickup location/i).fill(`Bay A / Floor 2 — training ${uniq}`);
    const po = page.getByLabel(/po|reference/i).first();
    if (await po.isVisible().catch(() => false)) await po.fill(`PO-CL-${uniq}`);
    await page.getByLabel(/approx\.?\s*quantity/i).fill('10');
    await page.getByLabel(/approx\.?\s*weight/i).fill('50');
    const notes = page.getByLabel(/^notes$/i);
    if (await notes.isVisible().catch(() => false)) {
      await notes.fill(`Gate 2 open 9am–6pm. Contact security on arrival. Training ${uniq}`);
    }
    const item = page.getByPlaceholder('Item description');
    if (await item.isVisible().catch(() => false)) await item.fill(`IT assets batch ${uniq}`);
    await snap(
      page,
      'new-request-filled',
      'Step 5 — Complete the request form',
      [
        '1. Select Site (only your organisation’s sites appear).',
        '2. Enter Pickup Location (building / floor / warehouse / bay).',
        '3. Optionally enter Your PO / Reference for finance matching.',
        '4. Confirm Pick Up Request Date (clients cannot use Super Admin historical backdating).',
        '5. Enter Approx. Quantity (units) and Approx. Weight (kg).',
        '6. Add Notes for access windows, PPE, or contact person.',
        '7. Add Line Items and/or attach a Bill of Materials file.',
        '8. Click Submit Request.',
      ].join('\n'),
      'Double-check site and location before submit. After Urbeno acknowledges, corrections usually go through Request changes → you Edit & resubmit.',
    );

    await page.getByRole('button', { name: /submit request/i }).click();
    await page.waitForTimeout(2000);
    const trainingReq = await readReqId(page);

    // ── 6. Submitted Stage 1 ─────────────────────────────────
    await snap(
      page,
      'request-submitted',
      'Step 6 — Request created (Stage 1 — awaiting Urbeno)',
      [
        `1. Confirm the heading shows your new REQ- number${trainingReq ? ` (e.g. ${trainingReq})` : ''}.`,
        '2. Read site, raised-by, approx weight/qty, and line items / BoM.',
        '3. Stage shows Request / awaiting acknowledgement.',
        '4. Confirm you do NOT see Acknowledge, Assign Vehicle, Weigh, Raise Invoice, Create MRN, or Upload Certificate.',
        '5. Share the REQ- with Urbeno if they ask for the reference.',
      ].join('\n'),
      'Next (Urbeno): Acknowledge → Assign Vehicle → Weigh → Raise Invoice. Next (Factory): MRN → Form 6. Next (you): download docs → Review & Close after payment + CoD.',
    );

    // ── 7. My Requests ───────────────────────────────────────
    await page.goto(BASE + '/requests', { waitUntil: 'networkidle' });
    await snap(
      page,
      'my-requests',
      'Step 7 — My Requests list',
      [
        '1. Open My Requests.',
        '2. Every row must belong to your organisation only.',
        '3. Use search or filters to find a REQ- by number or site.',
        '4. Click a row to open detail and track stages 1–9.',
        '5. Watch for badges such as awaiting ack, in progress, or closed.',
      ].join('\n'),
      'If another company’s request appears, report a Blocker immediately.',
    );

    // ── 8. Mid-lifecycle: vehicles (client view) ─────────────
    await openReq(page, 'REQ-00101');
    if (await page.getByText('REQ-00101').first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await snap(
        page,
        'track-vehicles',
        'Step 8 — Track Vehicles & Weighment (read-only)',
        [
          '1. Open a request that Urbeno has acknowledged and assigned.',
          '2. Review vehicle registration, driver, and weighment progress when shown.',
          '3. You can see evidence Urbeno recorded — you cannot edit weighment or assign vehicles.',
          '4. Refresh the page as Operations completes loading.',
        ].join('\n'),
        'Missing Assign Vehicle / Weigh buttons is correct for Client Users.',
      );
    }

    // ── 9. Closed sample: full documents ─────────────────────
    await openReq(page, 'REQ-00102');
    if (!(await page.getByText('REQ-00102').first().isVisible({ timeout: 2500 }).catch(() => false))) {
      await openReq(page, 'REQ-00050');
    }
    await snap(
      page,
      'track-invoice-docs',
      'Step 9 — Track invoice, Form 6, and Certificate on a completed job',
      [
        '1. Open a closed or advanced request (classroom often uses a demo REQ-).',
        '2. Expand Invoicing / Recycling / Closed sections as shown.',
        '3. Review invoice number, billing weight, and totals when visible.',
        '4. Locate Form 6 and Certificate of Destruction download controls.',
        '5. Confirm MRN number is NOT shown — factory goods receipt stays internal.',
      ].join('\n'),
      'From billing onward each invoice can progress independently. The request stage follows the least-advanced invoice.',
    );

    // Scroll Form 6 / CoD if present
    const f6 = page.getByText(/form\s*6/i).first();
    if (await f6.isVisible({ timeout: 2000 }).catch(() => false)) {
      await f6.scrollIntoViewIfNeeded().catch(() => {});
      await snap(
        page,
        'download-form6',
        'Step 10 — Download Form 6',
        [
          '1. On the invoice / recycling area, find Form 6.',
          '2. Download the Form 6 PDF when status is approved / available.',
          '3. Store it with your EHS / compliance records.',
          '4. If Form 6 is missing, Urbeno may still be processing or awaiting admin approval — ask your Urbeno contact.',
        ].join('\n'),
        'Form 6 is client-visible after Factory entry and (when required) Super Admin approval. You still never see MRN.',
      );
    }

    const codLabel = page.getByText(/certificate of destruction/i).first();
    if (await codLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
      await codLabel.scrollIntoViewIfNeeded().catch(() => {});
      await snap(
        page,
        'download-cod',
        'Step 11 — Download Certificate of Destruction (CoD)',
        [
          '1. Locate Certificate of Destruction on the request / invoice panel.',
          '2. Download the signed CoD PDF.',
          '3. Keep the portal file and any email attachment Urbeno sent.',
          '4. Payment must also be recorded before Review & Close unlocks.',
        ].join('\n'),
        'CoD without payment is not enough to close. Payment without CoD is not enough either.',
      );
    }

    // ── 10. Changes-requested loop (optional demo) ───────────
    if (trainingReq) {
      await logout(page, BASE);
      await signIn(page, BASE, ADMIN, PASSWORD);
      await openReq(page, trainingReq);
      const changesBtn = page.getByRole('button', { name: /request changes/i }).first();
      if (await changesBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await changesBtn.click();
        await page.getByLabel(/note to client/i).fill('Please confirm gate access hours and add the building name to Pickup Location.');
        await page.locator('.modal').getByRole('button', { name: /send back to client/i }).click();
        await waitToast(page, /changes requested/i);
        await page.waitForTimeout(600);

        await logout(page, BASE);
        await signIn(page, BASE, CLIENT, PASSWORD);
        await openReq(page, trainingReq);
        await snap(
          page,
          'changes-requested',
          'Step 12 — Changes requested by Urbeno',
          [
            '1. Open the request from My Requests when Urbeno sends it back.',
            '2. Read the Changes requested note carefully.',
            '3. Click Edit / update the fields named in the note.',
            '4. Enter Your response to Urbeno if asked.',
            '5. Click Save and resubmit.',
          ].join('\n'),
          'Answer every point in the note in one pass so the request is not returned again.',
        );

        const editLoc = page.getByLabel(/pickup location/i);
        if (await editLoc.isVisible({ timeout: 2000 }).catch(() => false)) {
          await editLoc.fill(`Bay A / Floor 2 — Gate 2 open 9am–6pm (${uniq})`);
        }
        const response = page.getByLabel(/your response/i);
        if (await response.isVisible({ timeout: 1500 }).catch(() => false)) {
          await response.fill('Updated pickup location and confirmed Gate 2 hours 9am–6pm.');
        }
        const resubmit = page.getByRole('button', { name: /save and resubmit/i }).first();
        if (await resubmit.isVisible({ timeout: 2000 }).catch(() => false)) {
          await snap(
            page,
            'resubmit-changes',
            'Step 13 — Edit and resubmit after changes requested',
            [
              '1. Update Pickup Location / notes / BoM as requested.',
              '2. Add a short response confirming what you fixed.',
              '3. Click Save and resubmit.',
              '4. Expected outcome: request returns to Urbeno awaiting acknowledgement. You still cannot Acknowledge yourself.',
            ].join('\n'),
            'Do not invent site details Urbeno did not ask for — only fix what the note requires.',
          );
          await resubmit.click();
          await waitToast(page, /updated|sent back/i);
          await page.waitForTimeout(800);
        }
      } else {
        await logout(page, BASE);
        await signIn(page, BASE, CLIENT, PASSWORD);
      }
    }

    // ── 11. Advance training request to closable + Review & Close
    if (trainingReq) {
      console.log('Advancing', trainingReq, 'for Review & Close demo…');
      await staffAdvanceToClosable(page, trainingReq, uniq);
      await openReq(page, trainingReq);
      await snap(
        page,
        'ready-to-close',
        'Step 14 — Ready to close (CoD + payment complete)',
        [
          '1. Refresh the request after Urbeno finishes Stages 2–8.',
          '2. Confirm Certificate of Destruction is present.',
          '3. Confirm payment is recorded (no outstanding balance).',
          '4. Look for the Review & Close control — it appears only when both conditions are met.',
        ].join('\n'),
        'If Review & Close is missing, payment or CoD is still outstanding. Contact Urbeno rather than forcing a close.',
      );

      const closeBtn = page.getByRole('button', { name: /review\s*&\s*close/i }).first();
      if (await closeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(600);
        await snap(
          page,
          'review-close-modal',
          'Step 15 — Review & Close modal (Stage 9)',
          [
            '1. Click Review & Close.',
            '2. Read the summary in the modal (invoice, certificate, payment).',
            '3. Click Acknowledge closure.',
            '4. Expected outcome: Invoice closed / Stage Closed. Home Completed count increases. Sustainability will include this weight after closure.',
          ].join('\n'),
          'Only your organisation’s Client Users close normal invoices. Client Read Only cannot close.',
        );
        await page.locator('.modal').getByRole('button', { name: /acknowledge closure/i }).click();
        await waitToast(page, /closed/i);
        await page.waitForTimeout(800);
        await snap(
          page,
          'request-closed',
          'Step 16 — Request closed',
          [
            '1. Confirm the stage badge shows Closed.',
            '2. Downloads for Form 6 / CoD remain available for your records.',
            '3. Open Home to see Completed / impact tiles update.',
          ].join('\n'),
          'Closed consignments feed Recycling Heroes and Sustainability. In-progress jobs do not.',
        );
      } else {
        console.warn('Review & Close not visible after staff advance — capturing detail context only');
      }
    }

    // ── 12. Heroes / Sustainability / Reports ────────────────
    await page.goto(BASE + '/heroes', { waitUntil: 'networkidle' });
    await snap(
      page,
      'heroes',
      'Step 17 — Recycling Heroes',
      [
        '1. Open Recycling Heroes.',
        '2. Review tonnage milestones and planting progress for your organisation.',
        '3. Use this view for CSR / ESG storytelling with closed recycled work.',
      ].join('\n'),
      'You do not manage Urbeno-wide planting controls from the client portal.',
    );

    await page.goto(BASE + '/impact', { waitUntil: 'networkidle' });
    await snap(
      page,
      'sustainability',
      'Step 18 — Sustainability impact',
      [
        '1. Open Sustainability.',
        '2. Review recycled weight, CO₂e avoided, landfill diverted, and related figures.',
        '3. Open How these numbers are built / methodology if offered.',
        '4. Download Impact PDF for board or EHS packs when available.',
      ].join('\n'),
      'Only closed (certified and acknowledged) consignments count — do not add in-flight pickups to board packs.',
    );

    await page.goto(BASE + '/reports', { waitUntil: 'networkidle' });
    await snap(
      page,
      'reports',
      'Step 19 — Reports and exports',
      [
        '1. Open Reports.',
        '2. Choose Request Summary, Invoice Register, Form 6 Log, Certificate Log, Sustainability, Heroes, or Device Serials as listed.',
        '3. Set FY / period filters.',
        '4. Export CSV or PDF for finance / EHS.',
        '5. Confirm there is NO MRN Register — that report is factory-only.',
      ].join('\n'),
      'Exports must contain only your organisation. Re-export after a batch of closures so CoD columns stay current.',
    );

    // ── 13. Profile / legal / sign-out ───────────────────────
    await page.goto(BASE + '/profile', { waitUntil: 'networkidle' });
    await redactProfilePii(page);
    await snap(
      page,
      'profile',
      'Step 20 — Profile and password',
      [
        '1. Open Profile from your avatar / name menu.',
        '2. Confirm Role is Client User and Organisation is correct.',
        '3. Change password anytime: Current → New (policy) → Confirm → Update.',
        '4. Confirm Two-factor authentication is NOT shown (staff-only).',
      ].join('\n'),
      'Client Read Only users see the same Profile pattern but cannot raise or close requests.',
    );

    const terms = page.getByRole('link', { name: /terms/i }).first();
    if (await terms.isVisible({ timeout: 2000 }).catch(() => false)) {
      await terms.click();
      await page.waitForLoadState('networkidle');
    } else {
      await page.goto(BASE + '/legal/terms', { waitUntil: 'networkidle' }).catch(() => {});
    }
    await snap(
      page,
      'legal-terms',
      'Step 21 — Terms of Use',
      [
        '1. Open Terms of Use from the footer or first-login gate.',
        '2. Read obligations before accepting on first login.',
        '3. You are not re-prompted unless Urbeno publishes a new version.',
      ].join('\n'),
      'Privacy Policy is accepted the same way on first login.',
    );

    await logout(page, BASE);
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'signed-out',
      'Step 22 — Sign out safely',
      [
        '1. Open your avatar menu and click Logout / Sign out.',
        '2. Confirm the Sign In screen appears.',
        '3. Close the browser on shared computers.',
      ].join('\n'),
      'Always sign out on shared workstations. Do not leave a client session open on a kiosk.',
    );
  });

  writeManifest(OUT, {
    role: 'client',
    roleLabel: 'Client User — Complete Process Flow',
    audience:
      'Client organisation requestors who raise pickups, track the e-waste lifecycle, download Form 6 / CoD, and close after payment',
    portal: 'https://tectrack.urbeno.in',
    version: '1',
    documentControl: 'Version 1 — Production (detailed process flow)',
    baseCaptured: BASE,
    steps,
  });
  console.log('Done.', steps.length, 'steps');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
