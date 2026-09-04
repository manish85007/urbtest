/**
 * Detailed Factory Manager training screenshots.
 * Usage: BASE_URL=http://localhost:8080 node docs/uat/training/capture-factory.mjs
 */
import {
  clearShots,
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
const EMAIL = process.env.TEST_EMAIL || 'blr@urbeno.in';
const PASSWORD = process.env.TEST_PASSWORD || 'demo';
const OUT = roleOutDir('factory');
const steps = [];
const { photo } = fixturePaths();

async function dismissModal(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(350);
}

async function main() {
  clearShots(OUT);
  const snap = makeSnapper(OUT, steps);
  console.log('Detailed Factory Manager capture →', OUT);

  await withBrowser(async (page) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'login',
      'Step 1 — Sign in as Factory Manager',
      [
        '1. Open https://tectrack.urbeno.in.',
        '2. Enter the factory account email issued by Urbeno (e.g. Bengaluru / Kolar facility).',
        '3. Enter password and Sign In; complete MFA if enrolled.',
        '4. Accept Terms and Privacy on first login if prompted.',
      ].join('\n'),
      'Do not use a client login for factory work. MFA is required for privileged staff.',
    );
    await signIn(page, BASE, EMAIL, PASSWORD, { alreadyOnLogin: true });

    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'dashboard',
      'Step 2 — Factory dashboard',
      [
        '1. Confirm Factory / facility dashboard (e.g. URB-BLR).',
        '2. Review open work and capacity tiles.',
        '3. Navigation: Dashboard, Requests, Capacity, Reports.',
        '4. Confirm Masters, Audit, Compliance, Heroes, Sustainability are NOT in the menu.',
        '5. Focus: after Super Admin raises invoice → Create MRN → Process Form 6 → Capacity → reports.',
      ].join('\n'),
      'If you can open Compliance or Masters, stop and report a Blocker.',
    );

    await page.goto(BASE + '/requests', { waitUntil: 'networkidle' });
    await snap(
      page,
      'requests',
      'Step 3 — Requests ready for factory work',
      [
        '1. Open Requests.',
        '2. Find invoiced requests needing MRN or Form 6.',
        '3. Confirm there is no + New Request for factory users.',
        '4. Confirm you do not Acknowledge, Assign Vehicle, Weigh, Raise Invoice, or Upload Certificate.',
        '5. Upstream: Client → Ops/Admin ack → vehicle → weigh → invoice. Downstream: Admin Form 6 approval / CoD; Client closes.',
      ].join('\n'),
      'Prefer live invoiced requests for practice when available.',
    );

    // Prefer need_form6 / invoiced demos
    let opened = null;
    for (const id of ['REQ-00047', 'REQ-00048', 'REQ-00050']) {
      await page.goto(`${BASE}/requests/${id}`, { waitUntil: 'networkidle' });
      if (await page.getByText(id).first().isVisible({ timeout: 2500 }).catch(() => false)) {
        opened = id;
        break;
      }
    }

    if (opened) {
      await snap(
        page,
        'request-detail',
        'Step 4 — Request detail for MRN / Form 6',
        [
          '1. Open an invoiced request.',
          '2. Locate the invoice panel.',
          '3. When no MRN exists: Create MRN.',
          '4. After MRN: Process & Submit Form 6 for Review.',
          '5. Confirm you do NOT see Acknowledge, Raise Invoice, Record Payment, or Upload Certificate.',
          '6. Clients never see MRN numbers.',
        ].join('\n'),
        'One MRN per invoice. Form 6 category split must equal billing weight exactly.',
      );

      const mrnBtn = page.getByRole('button', { name: /create mrn|edit mrn/i }).first();
      if (await mrnBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
        await mrnBtn.click();
        await page.waitForTimeout(700);
        const sec = page.locator('#mr-sec');
        if (await sec.isVisible().catch(() => false) && !(await sec.inputValue()).trim()) {
          await sec.fill('Gate Security');
        }
        const files = page.locator('.modal input[type="file"]');
        if ((await files.count()) >= 2) {
          await files.nth(0).setInputFiles(photo);
          await files.nth(1).setInputFiles(photo);
          await page.waitForTimeout(1000);
        }
        await snap(
          page,
          'mrn-form',
          'Step 5 — Create / Edit MRN form',
          [
            '1. Click Create MRN (or Edit MRN before Form 6).',
            '2. Confirm factory, receiving date (not future), material lines matching billing weight.',
            '3. Enter driver / manager / security officer as required.',
            '4. Attach gate photo(s) and material photo(s).',
            '5. Click Record goods receipt (MRN).',
          ].join('\n'),
          'Do not invent categories at the gate — categories belong on Form 6.',
        );
        await dismissModal(page);
      } else {
        await snap(
          page,
          'mrn-status',
          'Step 5 — MRN status on invoice (already received)',
          [
            '1. When MRN already exists, review the MRN card / status on the invoice.',
            '2. Confirm receiving date and factory.',
            '3. Proceed to Form 6 when ready.',
            '4. Clients must still never see the MRN number.',
          ].join('\n'),
          'Seeded demos often already have MRN — use Create MRN on a fresh invoiced request in live training.',
        );
      }

      const form6Btn = page
        .locator('button')
        .filter({ hasText: /Process & Submit Form 6|Process & Issue Form 6|Edit Form 6/i })
        .first();
      if (await form6Btn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await form6Btn.click();
        await page.waitForTimeout(800);
        await snap(
          page,
          'form6-form',
          'Step 6 — Process Form 6 / recycling form',
          [
            '1. Click Process & Submit Form 6 for Review.',
            '2. Set Processing Date (today or earlier — not future).',
            '3. Enter category lines so totals equal billing weight exactly.',
            '4. Select vehicles on this Form 6; complete recovery fields.',
            '5. Watch Capacity (80% warn / 100% block).',
            '6. Submit for admin review. Super Admin Approves & releases before client download.',
          ].join('\n'),
          'Silent billing-weight deviations are refused. Escalate capacity overrides with a documented reason.',
        );
        await dismissModal(page);
      }

      // Scroll recycling panel if present
      const recycle = page.getByText(/recycling\s*\/\s*form 6/i).first();
      if (await recycle.isVisible({ timeout: 1500 }).catch(() => false)) {
        await recycle.scrollIntoViewIfNeeded().catch(() => {});
        await snap(
          page,
          'form6-panel',
          'Step 7 — Form 6 panel after entry',
          [
            '1. Review Form 6 number, review status, and category recovery lines.',
            '2. If pending admin review, wait for Super Admin Approve & release.',
            '3. After approval, Admin uploads Certificate of Destruction.',
          ].join('\n'),
          'Clients can download approved Form 6; they never see MRN.',
        );
      }
    }

    await page.goto(BASE + '/capacity', { waitUntil: 'networkidle' });
    await snap(
      page,
      'capacity',
      'Step 8 — Monitor factory capacity',
      [
        '1. Open Capacity.',
        '2. Review category utilisation for your facility.',
        '3. Watch warnings near 80% and blocks at 100% authorised TPA.',
        '4. Coordinate with Super Admin before unusual Form 6 volumes.',
      ].join('\n'),
      'Capacity protects regulatory limits — do not bypass silently.',
    );

    await page.goto(BASE + '/reports', { waitUntil: 'networkidle' });
    await snap(
      page,
      'reports',
      'Step 9 — Factory reports',
      [
        '1. Open Reports.',
        '2. Run MRN Register, Form 6 Log, Device Serials, Certificate Log, Capacity Utilisation as available.',
        '3. Export for audits.',
        '4. Never forward MRN Register exports to clients.',
      ].join('\n'),
      'MRN is factory / staff chain-of-custody data.',
    );

    await page.goto(BASE + '/profile', { waitUntil: 'networkidle' });
    await redactProfilePii(page);
    await snap(
      page,
      'profile',
      'Step 10 — Profile, facilities, MFA',
      [
        '1. Open Profile.',
        '2. Confirm Role is Factory Manager and Facilities lists your plant.',
        '3. Enrol Two-factor authentication when required.',
        '4. Change password per policy when Urbeno asks.',
      ].join('\n'),
      'Factory sessions create legal documents — keep MFA devices safe.',
    );

    await logout(page, BASE);
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'signed-out',
      'Step 11 — Sign out',
      [
        '1. Click Logout.',
        '2. Confirm Sign In appears.',
        '3. Never leave a factory session on a shared kiosk.',
      ].join('\n'),
      'Always sign out after MRN / Form 6 work.',
    );
  });

  writeManifest(OUT, {
    role: 'factory',
    roleLabel: 'Factory Manager',
    audience: 'Facility staff who record goods receipt (MRN) and recycling (Form 6), monitor capacity, and run factory reports',
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
