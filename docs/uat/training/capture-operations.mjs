/**
 * Detailed Operations Manager training screenshots.
 * Usage: BASE_URL=http://localhost:8080 node docs/uat/training/capture-operations.mjs
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
const EMAIL = process.env.TEST_EMAIL || 'ops@urbeno.in';
const PASSWORD = process.env.TEST_PASSWORD || 'demo';
const OUT = roleOutDir('operations');
const steps = [];
const { photo } = fixturePaths();

async function dismissModal(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(350);
}

async function main() {
  clearShots(OUT);
  const snap = makeSnapper(OUT, steps);
  const uniq = Date.now().toString().slice(-6);
  console.log('Detailed Operations Manager capture →', OUT);

  await withBrowser(async (page) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'login',
      'Step 1 — Sign in as Operations Manager',
      [
        '1. Open https://tectrack.urbeno.in.',
        '2. Enter your @urbeno.in email.',
        '3. Enter password and Sign In; complete MFA if enrolled.',
        '4. Accept policies / reset temporary password when prompted.',
      ].join('\n'),
      'Operations accounts are Urbeno-only. Never share MFA codes.',
    );
    await signIn(page, BASE, EMAIL, PASSWORD, { alreadyOnLogin: true });

    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'dashboard',
      'Step 2 — Operations dashboard',
      [
        '1. Land on the Operations Dashboard.',
        '2. Review open requests, KPIs, and Acknowledge shortcuts.',
        '3. Navigation: Dashboard, Requests, Heroes, Sustainability, Capacity, Reports.',
        '4. Confirm Masters, Audit, Compliance are NOT visible.',
        '5. Focus path: Acknowledge → Assign Vehicle → Record Weighment → hand off billing/MRN/Form6/CoD.',
      ].join('\n'),
      'If Masters appears in your menu, stop and report a Blocker.',
    );

    await page.goto(BASE + '/requests', { waitUntil: 'networkidle' });
    await snap(
      page,
      'requests',
      'Step 3 — Requests queue',
      [
        '1. Open Requests.',
        '2. Filter/scan Stage 1 items awaiting acknowledgement.',
        '3. Open a request to Acknowledge or Request changes.',
        '4. After ack: Assign Vehicle and Record Weighment.',
        '5. You typically do not Raise Invoice, Create MRN, Issue Form 6, or Upload Certificate.',
      ].join('\n'),
      'Missing invoice/MRN/CoD buttons is expected — escalate to Super Admin / Factory.',
    );

    // Prefer awaiting-ack then ack-no-vehicle seeds
    let reqId = null;
    for (const id of ['REQ-00099', 'REQ-00046', 'REQ-00096', 'REQ-00097']) {
      await page.goto(`${BASE}/requests/${id}`, { waitUntil: 'networkidle' });
      if (await page.getByText(id).first().isVisible({ timeout: 2000 }).catch(() => false)) {
        reqId = id;
        break;
      }
    }
    if (!reqId) {
      await page.goto(BASE + '/requests', { waitUntil: 'networkidle' });
      const link = page.locator('a[href*="/requests/REQ-"]').first();
      if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
        await link.click();
        await page.waitForLoadState('networkidle');
        reqId = (await page.getByRole('heading', { level: 1 }).textContent())?.match(/REQ-[\w-]+/)?.[0];
      }
    }

    if (reqId) {
      await snap(
        page,
        'request-detail',
        'Step 4 — Request detail in your scope',
        [
          '1. Read stage badge, site, dates, and approx weight.',
          '2. Stage 1: Acknowledge Request or Request changes / Reject.',
          '3. After ack: Assign Vehicle (no Super Admin historical backdate from 2026-04-01).',
          '4. Record Weighment (date is today for Operations; both photo sets required).',
          '5. Acknowledge loading complete after every vehicle is weighed.',
        ].join('\n'),
        'If a button is missing, escalate — do not invent a workaround.',
      );

      const changes = page.getByRole('button', { name: /request changes/i }).first();
      if (await changes.isVisible({ timeout: 1500 }).catch(() => false)) {
        await changes.click();
        await page.waitForTimeout(500);
        await snap(
          page,
          'request-changes',
          'Step 5 — Request changes modal',
          [
            '1. Click Request changes when client data needs fixing.',
            '2. Enter a clear note to the client.',
            '3. Send back — client resubmits; do not invent missing site details.',
          ].join('\n'),
          'Prefer request changes for fixable issues; reserve reject for true cancellations.',
        );
        await dismissModal(page);
      }

      const ack = page.getByRole('button', { name: /acknowledge request/i }).first();
      if (await ack.isVisible({ timeout: 2000 }).catch(() => false)) {
        await ack.click();
        await page.waitForTimeout(500);
        await snap(
          page,
          'acknowledge',
          'Step 6 — Acknowledge Request modal',
          [
            '1. Click Acknowledge Request.',
            '2. Review summary (client, site, weight, requestor).',
            '3. Confirm Acknowledge — email uses the acknowledgement template.',
          ].join('\n'),
          'After acknowledgement the request moves toward vehicle assignment.',
        );
        await page.locator('.modal').getByRole('button', { name: /^acknowledge$/i }).click();
        await waitToast(page, /acknowledged/i);
        await page.waitForTimeout(800);
      }

      const assign = page.getByRole('button', { name: /assign vehicle|add vehicle/i }).first();
      if (await assign.isVisible({ timeout: 3000 }).catch(() => false)) {
        await assign.click();
        await page.waitForTimeout(600);
        await page.getByLabel(/registration/i).fill(`KAOP${uniq}`);
        await page.getByLabel(/driver name/i).fill('Ops Training Driver');
        await fillPhone(page, 'Driver phone', '9845001122');
        await page.locator('#vh-exp-time').fill('10:00');
        await snap(
          page,
          'assign-vehicle',
          'Step 7 — Assign Vehicle form',
          [
            '1. Click Assign Vehicle.',
            '2. Enter registration, type, logistics partner, driver, phone.',
            '3. Set expected pickup date & time (today or future — no historical backdate).',
            '4. Add team members if required, then Assign vehicle.',
          ].join('\n'),
          'Historical expected pickup from 2026-04-01 is Super Admin only.',
        );
        // Do not always submit if this pollutes too many vehicles — submit for realism
        await page.locator('.modal').getByRole('button', { name: /assign vehicle/i }).click();
        await waitToast(page, /vehicle assigned/i);
        await page.waitForTimeout(800);
      }

      const weigh = page.getByRole('button', { name: /weigh|record weighment/i }).first();
      if (await weigh.isVisible({ timeout: 3000 }).catch(() => false)) {
        await weigh.click();
        await page.waitForTimeout(700);
        const files = page.locator('.modal input[type="file"]');
        if ((await files.count()) >= 2) {
          await files.nth(0).setInputFiles(photo);
          await files.nth(1).setInputFiles(photo);
          await page.waitForTimeout(1000);
        }
        const slip = page.getByLabel(/slip/i).first();
        if (await slip.isVisible().catch(() => false)) await slip.fill(`WB-OPS-${uniq}`);
        const gross = page.getByLabel(/gross/i).first();
        const tare = page.getByLabel(/tare/i).first();
        if (await gross.isVisible().catch(() => false)) await gross.fill('4100');
        if (await tare.isVisible().catch(() => false)) await tare.fill('4000');
        await snap(
          page,
          'weighment-form',
          'Step 8 — Record Weighment form',
          [
            '1. Click Record Weighment / Weigh.',
            '2. Enter slip #, gross, tare — confirm net = gross − tare.',
            '3. Weighment date is today for Operations (no historical window).',
            '4. Attach slip photo(s) and pickup photo(s).',
            '5. Click Record weighment.',
          ].join('\n'),
          'Refuse weighment without both photo sets.',
        );
        await dismissModal(page);
      }

      const load = page.getByRole('button', { name: /acknowledge loading complete/i }).first();
      if (await load.isVisible({ timeout: 1500 }).catch(() => false)) {
        await snap(
          page,
          'loading-complete',
          'Step 9 — Acknowledge loading complete',
          [
            '1. After all vehicles are weighed, click Acknowledge loading complete.',
            '2. This unlocks Super Admin Raise Invoice.',
          ].join('\n'),
          'Do not leave consignments stuck awaiting loading acknowledgement.',
        );
      }
    }

    await page.goto(BASE + '/capacity', { waitUntil: 'networkidle' });
    await snap(
      page,
      'capacity',
      'Step 10 — Capacity view',
      [
        '1. Open Capacity.',
        '2. Review authorised category utilisation.',
        '3. Escalate override needs to Super Admin / Factory.',
      ].join('\n'),
      'Category master edits are Super Admin only.',
    );

    await page.goto(BASE + '/heroes', { waitUntil: 'networkidle' });
    await snap(
      page,
      'heroes',
      'Step 11 — Recycling Heroes',
      [
        '1. Open Recycling Heroes.',
        '2. Review organisation tonnage and planting milestones.',
        '3. Use period filters for client updates.',
      ].join('\n'),
      'Planting admin may be Super Admin only.',
    );

    await page.goto(BASE + '/impact', { waitUntil: 'networkidle' });
    await snap(
      page,
      'sustainability',
      'Step 12 — Sustainability',
      [
        '1. Open Sustainability.',
        '2. Review impact figures used in client conversations.',
      ].join('\n'),
      'Closed work drives impact totals.',
    );

    await page.goto(BASE + '/reports', { waitUntil: 'networkidle' });
    await snap(
      page,
      'reports',
      'Step 13 — Reports and exports',
      [
        '1. Open Reports.',
        '2. Run Request Summary, Invoice Register, Sustainability, Heroes, Serials as needed.',
        '3. Export CSV/PDF; handle multi-client rows securely.',
      ].join('\n'),
      'Do not forward MRN-only factory packs to clients.',
    );

    await page.goto(BASE + '/profile', { waitUntil: 'networkidle' });
    await redactProfilePii(page);
    await snap(
      page,
      'profile',
      'Step 14 — Profile, password, MFA',
      [
        '1. Open Profile.',
        '2. Confirm Role is Operations Manager.',
        '3. Change password per policy when asked.',
        '4. Enrol or manage MFA within the grace window.',
      ].join('\n'),
      'After MFA grace ends, enrolment is forced before continuing.',
    );

    await logout(page, BASE);
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'signed-out',
      'Step 15 — Sign out safely',
      [
        '1. Click Sign out / Logout.',
        '2. Confirm the login screen.',
        '3. Always sign out on shared devices.',
      ].join('\n'),
      'Operations sessions can acknowledge live client work.',
    );
  });

  writeManifest(OUT, {
    role: 'operations',
    roleLabel: 'Operations Manager',
    audience: 'Urbeno Operations Managers who acknowledge requests, assign vehicles, record weighment, and run reports',
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
