/**
 * Detailed Super Admin day-to-day guide (Masters / Audit / Compliance + lifecycle forms).
 * For the end-to-end mock transaction walkthrough prefer capture-lifecycle-admin.mjs.
 * Usage: BASE_URL=http://localhost:8080 node docs/uat/training/capture-admin.mjs
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
  withBrowser,
  writeManifest,
} from './_capture-lib.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:8080';
const EMAIL = process.env.TEST_EMAIL || 'admin@urbeno.in';
const PASSWORD = process.env.TEST_PASSWORD || 'demo';
const OUT = roleOutDir('admin');
const steps = [];
const { photo, pdf } = fixturePaths();

async function dismissModal(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(350);
}

async function openFirst(page, ids) {
  for (const id of ids) {
    await page.goto(`${BASE}/requests/${id}`, { waitUntil: 'networkidle' });
    if (await page.getByText(id).first().isVisible({ timeout: 2000 }).catch(() => false)) return id;
  }
  return null;
}

async function main() {
  clearShots(OUT);
  const snap = makeSnapper(OUT, steps);
  const uniq = Date.now().toString().slice(-6);
  console.log('Detailed Super Admin (admin pack) capture →', OUT);

  await withBrowser(async (page) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'login',
      'Step 1 — Sign in as Super Admin',
      [
        '1. Open https://tectrack.urbeno.in.',
        '2. Enter your Super Admin email and password.',
        '3. Complete MFA if enrolled; accept policies on first login.',
      ].join('\n'),
      'Protect MFA. Super Admin can backdate historical dates from 2026-04-01 across the lifecycle.',
    );
    await signIn(page, BASE, EMAIL, PASSWORD, { alreadyOnLogin: true });

    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'dashboard',
      'Step 2 — Super Admin dashboard',
      [
        '1. Review KPIs, Acknowledge queue, and work queues.',
        '2. Full nav: Dashboard, Requests, Heroes, Sustainability, Capacity, Masters, Reports, Audit, Compliance.',
        '3. For a full mock walkthrough with every form filled, use the Super Admin Lifecycle Training Guide PDF.',
      ].join('\n'),
      'You see every organisation — treat data as confidential.',
    );

    await page.goto(BASE + '/requests', { waitUntil: 'networkidle' });
    await snap(
      page,
      'requests',
      'Step 3 — Requests queue',
      [
        '1. Open Requests and scan stages 1–9.',
        '2. Open Stage 1 to Acknowledge; open later stages for invoice / CoD.',
        '3. Keep unique suffixes on registration / invoice / e-way / certificate numbers in training re-runs.',
      ].join('\n'),
      'Walk one request carefully before bulk practice.',
    );

    // Stage 1 acknowledge
    const s1 = await openFirst(page, ['REQ-00099', 'REQ-00096', 'REQ-00097']);
    if (s1) {
      await snap(
        page,
        'stage1-detail',
        'Step 4 — Stage 1 request detail',
        [
          '1. Open a Stage 1 request.',
          '2. Read site, approx weight, notes, BoM.',
          '3. Acknowledge, Request changes, or Reject.',
        ].join('\n'),
        'Do not invent missing client site details.',
      );
      const ack = page.getByRole('button', { name: /acknowledge request/i }).first();
      if (await ack.isVisible({ timeout: 2000 }).catch(() => false)) {
        await ack.click();
        await page.waitForTimeout(500);
        await snap(
          page,
          'acknowledge',
          'Step 5 — Acknowledge Request modal',
          [
            '1. Click Acknowledge Request.',
            '2. Review modal summary and confirm.',
          ].join('\n'),
          'Acknowledgement email uses the Request Acknowledgement template.',
        );
        await dismissModal(page);
      }
    }

    // Vehicle assign with backdate on ack-ready request
    const vehReq = await openFirst(page, ['REQ-00046', 'REQ-00095', 'REQ-00098']);
    if (vehReq) {
      const assign = page.getByRole('button', { name: /assign vehicle|add vehicle/i }).first();
      if (await assign.isVisible({ timeout: 2500 }).catch(() => false)) {
        await assign.click();
        await page.waitForTimeout(600);
        await page.getByLabel(/registration/i).fill(`KAAD${uniq}`).catch(() => {});
        await page.locator('#vh-exp-date').fill('2026-05-12').catch(() => {});
        await snap(
          page,
          'assign-vehicle',
          'Step 6 — Assign Vehicle (historical backdate)',
          [
            '1. Click Assign Vehicle.',
            '2. Enter registration, driver, phone, expected pickup.',
            '3. Super Admin historical expected pickup from 2026-04-01 when the hint appears.',
          ].join('\n'),
          'Operations cannot use the historical window.',
        );
        await dismissModal(page);
      }
    }

    // Weighment / invoice / CoD contexts from advanced seeds
    const invReq = await openFirst(page, ['REQ-00047', 'REQ-00048', 'REQ-00050']);
    if (invReq) {
      await snap(
        page,
        'request-invoiced',
        'Step 7 — Invoiced / advanced request detail',
        [
          '1. Open an invoiced or closed demo request.',
          '2. Review vehicles, weighment evidence, invoices, MRN/Form 6/CoD cards.',
          '3. Use Raise Invoice / Record Payment / Upload Certificate when those controls appear on live work.',
        ].join('\n'),
        'See the Lifecycle Training Guide for a filled Raise Invoice / Payment / CoD walkthrough on a fresh mock REQ.',
      );

      const raise = page.getByRole('button', { name: /raise invoice|add invoice/i }).first();
      if (await raise.isVisible({ timeout: 2000 }).catch(() => false)) {
        await raise.click();
        await page.waitForTimeout(600);
        await snap(
          page,
          'raise-invoice',
          'Step 8 — Raise / Add Invoice form',
          [
            '1. Click Raise Invoice or Add Invoice.',
            '2. Enter invoice number, dates, taxable amount, tax rate, e-way, billing weight.',
            '3. Historical invoice dates from 2026-04-01 when the backdate hint appears.',
          ].join('\n'),
          'Totals calculate automatically — do not type tax manually.',
        );
        await dismissModal(page);
      }

      const pay = page.getByRole('button', { name: /record payment/i }).first();
      if (await pay.isVisible({ timeout: 2000 }).catch(() => false)) {
        await pay.click();
        await page.waitForTimeout(500);
        await snap(
          page,
          'record-payment',
          'Step 9 — Record Payment form',
          [
            '1. Click + Record Payment.',
            '2. Enter UTR, amount, mode, payment date (historical window for Super Admin).',
          ].join('\n'),
          'Client close requires payment + CoD.',
        );
        await dismissModal(page);
      }

      const cod = page.getByRole('button', { name: /upload certificate/i }).first();
      if (await cod.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cod.click();
        await page.waitForTimeout(500);
        await page.locator('.modal input[type="file"]').first().setInputFiles(pdf).catch(() => {});
        await snap(
          page,
          'upload-certificate',
          'Step 10 — Upload Certificate form',
          [
            '1. Click Upload Certificate after Form 6 approval.',
            '2. Enter unique certificate number and date; attach signed PDF.',
          ].join('\n'),
          'Never reuse certificate numbers.',
        );
        await dismissModal(page);
      }

      const form6 = page.locator('button').filter({ hasText: /Form 6|Approve/i }).first();
      if (await form6.isVisible({ timeout: 1500 }).catch(() => false)) {
        await form6.scrollIntoViewIfNeeded().catch(() => {});
        await snap(
          page,
          'form6-admin',
          'Step 11 — Form 6 / admin review area',
          [
            '1. Review Recycling / Form 6 on the invoice.',
            '2. Approve & release when Factory submitted for review.',
            '3. Download Form 6 PDF for the audit pack.',
          ].join('\n'),
          'Do not upload CoD before Form 6 is approved.',
        );
      }
    }

    await page.goto(BASE + '/capacity', { waitUntil: 'networkidle' });
    await snap(page, 'capacity', 'Step 12 — Capacity oversight', '1. Open Capacity.\n2. Review utilisation and support documented overrides.', 'Overrides are audited.');

    await page.goto(BASE + '/heroes', { waitUntil: 'networkidle' });
    await snap(page, 'heroes', 'Step 13 — Recycling Heroes', '1. Open Recycling Heroes.\n2. Review plantings and tonnage.\n3. Record planting when authorised.', 'Keep photo evidence.');

    await page.goto(BASE + '/impact', { waitUntil: 'networkidle' });
    await snap(page, 'sustainability', 'Step 14 — Sustainability', '1. Open Sustainability.\n2. Review impact figures for client packs.', 'Closed work drives totals.');

    await page.goto(BASE + '/reports', { waitUntil: 'networkidle' });
    await snap(
      page,
      'reports',
      'Step 15 — Reports',
      '1. Open Reports.\n2. Run operational and compliance reports.\n3. Export with correct tenancy filters.',
      'Store multi-client exports securely.',
    );

    await page.goto(BASE + '/masters', { waitUntil: 'networkidle' });
    await snap(
      page,
      'masters',
      'Step 16 — Masters',
      '1. Open Masters.\n2. Tabs: Users, Clients, Sites, Factories, Categories, Lookups, Email, Company.\n3. Prefer deactivate over delete for referenced sites.',
      'Letterhead feeds Form 6 and MRN PDFs.',
    );

    const usersTab = page.getByRole('button', { name: /^users$/i }).or(page.getByText(/^Users$/)).first();
    if (await usersTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await usersTab.click();
      await page.waitForTimeout(500);
    }
    await snap(
      page,
      'masters-users',
      'Step 17 — Users & roles',
      [
        '1. Open Users.',
        '2. Roles include Client Read Only and Auditor.',
        '3. Reset passwords out-of-band; resets are audited.',
      ].join('\n'),
      'Staff/auditor emails must be @urbeno.in.',
    );

    const clientsTab = page.getByRole('button', { name: /^clients/i }).or(page.getByText(/^Clients/)).first();
    if (await clientsTab.isVisible({ timeout: 1500 }).catch(() => false)) {
      await clientsTab.click();
      await page.waitForTimeout(500);
      await snap(
        page,
        'masters-clients',
        'Step 18 — Clients & sites',
        '1. Open Clients & Sites.\n2. Create/edit clients (4-letter codes).\n3. Deactivate sites rather than deleting.',
        'Reserved prefixes like URB / ADM / SYS / TEST are refused.',
      );
    }

    await page.goto(BASE + '/audit', { waitUntil: 'networkidle' });
    await snap(
      page,
      'audit',
      'Step 19 — Audit trail',
      '1. Open Audit.\n2. Filter by REQ-, actor, action, date.\n3. Confirm lifecycle events for chain of custody.',
      'Missing events block production sign-off.',
    );

    await page.goto(BASE + '/compliance', { waitUntil: 'networkidle' });
    await snap(
      page,
      'compliance',
      'Step 20 — Compliance',
      '1. Open Compliance.\n2. Review registers and control status.\n3. Confirm non-admin roles cannot open this area.',
      'Factory/client reaching Compliance is a Blocker.',
    );

    await page.goto(BASE + '/profile', { waitUntil: 'networkidle' });
    await redactProfilePii(page);
    await snap(
      page,
      'profile',
      'Step 21 — Profile, MFA, letterhead',
      '1. Open Profile.\n2. Manage MFA and password.\n3. Edit letterhead/company details if shown.',
      'Letterhead mistakes appear on legal PDFs.',
    );

    await logout(page, BASE);
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(page, 'signed-out', 'Step 22 — Sign out', '1. Logout.\n2. Confirm Sign In.\n3. Lock workstation if stepping away.', 'Treat admin sessions like production console access.');
  });

  writeManifest(OUT, {
    role: 'admin',
    roleLabel: 'Super Admin',
    audience: 'Urbeno Super Admins — day-to-day Masters, Audit, Compliance, and lifecycle controls (pair with the Complete Lifecycle guide)',
    portal: 'https://tectrack.urbeno.in',
    version: '1',
    documentControl: 'Version 1 — Production (detailed)',
    baseCaptured: BASE,
    steps,
  });
  console.log('Done.', steps.length, 'steps');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
