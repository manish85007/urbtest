/**
 * Capture Factory Manager training screenshots.
 * Usage: BASE_URL=http://localhost:8080 node docs/uat/training/capture-factory.mjs
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
const EMAIL = process.env.TEST_EMAIL || 'blr@urbeno.in';
const PASSWORD = process.env.TEST_PASSWORD || 'demo';
const OUT = roleOutDir('factory');
const steps = [];

async function dismissModal(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(350);
}

async function main() {
  clearShots(OUT);
  const snap = makeSnapper(OUT, steps);
  console.log('Factory training capture →', OUT);

  await withBrowser(async (page) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'login',
      'Step 1 — Sign in as Factory Manager',
      [
        '1. Open https://tectrack.urbeno.in.',
        '2. Enter the factory account email issued by Urbeno (for example the Bengaluru or Kolar facility login).',
        '3. Enter your password and click Sign In.',
        '4. Complete MFA if enrolled (staff MFA applies to Factory).',
        '5. Accept Terms and Privacy on first login if prompted.',
      ].join('\n'),
      'Factory accounts are privileged. Set up two-factor authentication on Profile when Urbeno asks you to. Do not use a client login for factory work.',
    );

    await signIn(page, BASE, EMAIL, PASSWORD, { alreadyOnLogin: true });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'dashboard',
      'Step 2 — Factory dashboard',
      [
        '1. Confirm the heading shows a Factory / facility dashboard (e.g. URB-BLR).',
        '2. Review tiles for open work, capacity used, and payments if shown.',
        '3. Use navigation: Dashboard, Requests, Capacity, Reports.',
        '4. Confirm Masters, Audit, Compliance, Recycling Heroes, and Sustainability are NOT in the menu.',
        '5. Your lifecycle focus: after Super Admin raises the invoice → you Create MRN → Process Form 6 → monitor Capacity → run factory reports. Clients never see MRN numbers.',
      ].join('\n'),
      'If you can open Compliance or Masters, stop and report a Blocker — those are admin-only.',
    );

    await page.goto(BASE + '/requests', { waitUntil: 'networkidle' });
    await snap(
      page,
      'requests',
      'Step 3 — Requests ready for factory work',
      [
        '1. Open Requests.',
        '2. Find invoiced requests that need MRN (Stage 5) or Form 6 (Stage 6).',
        '3. Confirm there is no + New Request for factory users — clients and Super Admins raise requests.',
        '4. Confirm you do not Acknowledge, Assign Vehicle, Weigh, Raise Invoice, or Upload Certificate — those belong to Operations / Super Admin.',
        '5. Open an invoiced request to continue to goods receipt.',
        '6. Upstream (others): Client raised → Ops/Admin acknowledged → vehicle → weighment → invoice. Downstream: Admin approves Form 6 / uploads CoD; Client closes after payment.',
      ].join('\n'),
      'Seeded training data may include sample REQ numbers (e.g. invoiced demos). Prefer a live invoiced request for practice when available.',
    );

    // Prefer need_form6 demo, then CoD demo, then closed
    let opened = false;
    for (const id of ['REQ-00047', 'REQ-00048', 'REQ-00050']) {
      await page.goto(`${BASE}/requests/${id}`, { waitUntil: 'networkidle' });
      if (await page.getByText(id).first().isVisible({ timeout: 2500 }).catch(() => false)) {
        opened = true;
        break;
      }
    }
    if (!opened) {
      await page.goto(BASE + '/requests', { waitUntil: 'networkidle' });
      const reqLink = page.locator('a[href*="/requests/REQ-"]').first();
      if (await reqLink.isVisible({ timeout: 4000 }).catch(() => false)) {
        await reqLink.click();
        await page.waitForLoadState('networkidle');
        opened = true;
      }
    }

    if (opened) {
      await snap(
        page,
        'request-detail',
        'Step 4 — Open request detail for MRN / Form 6',
        [
          '1. On request detail, locate the invoice panel.',
          '2. When Stage is 5 (invoiced) and no MRN exists, look for Create MRN.',
          '3. After MRN exists, look for Process & Issue / Submit Form 6.',
          '4. Confirm you do NOT see Acknowledge, Raise Invoice, Record Payment, or Upload Certificate (admin / ops actions).',
          '5. Confirm clients will not see MRN numbers even though you create them here.',
          '6. After you submit Form 6, Super Admin may Approve & release before the client is notified.',
        ].join('\n'),
        'One MRN per invoice. Form 6 category split must equal billing weight exactly.',
      );

      const mrnBtn = page.getByRole('button', { name: /create mrn|edit mrn/i }).first();
      if (await mrnBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await mrnBtn.click();
        await page.waitForTimeout(700);
        await snap(
          page,
          'mrn-form',
          'Step 5 — Create MRN (goods receipt)',
          [
            '1. Click Create MRN (or Edit MRN if revising before Form 6).',
            '2. Confirm factory, received date (not a future date), and materials lines.',
            '3. Enter driver / manager / security officer signatures as required.',
            '4. Attach gate photo(s) and material photo(s).',
            '5. Submit to create the MRN number.',
            '6. Refresh — MRN details appear for factory; clients must still not see the MRN number.',
            '7. Next: Process Form 6 so category recovery equals billing weight.',
          ].join('\n'),
          'Do not invent categories at the gate — categories belong on Form 6. Photos are required for a valid receipt.',
        );
        await dismissModal(page);
      } else {
        console.warn('  skip mrn-form — Create/Edit MRN not visible');
      }

      const form6Btn = page
        .locator('button')
        .filter({ hasText: /Process & Submit Form 6|Process & Issue Form 6|Edit Form 6|Issue Form 6/i })
        .first();
      if (await form6Btn.isVisible({ timeout: 2500 }).catch(() => false)) {
        await form6Btn.click();
        await page.waitForTimeout(700);
        // Prefer historical processing date for Super Admin training context when field exists
        const procDate = page.locator('input[type="date"]').first();
        if (await procDate.isVisible({ timeout: 1500 }).catch(() => false)) {
          await procDate.fill('2026-06-01').catch(() => {});
        }
        await snap(
          page,
          'form6-form',
          'Step 5b — Process Form 6 / recycling',
          [
            '1. Click Process & Submit Form 6 for Review (Factory) or Process & Issue Form 6 (when admin covers).',
            '2. Enter category lines so the total equals billing weight exactly.',
            '3. Set Processing Date (not a future date). Super Admin may historical-backdate from 2026-04-01.',
            '4. Watch Capacity — near 80% warns; 100% authorised TPA blocks without an approved override.',
            '5. Submit. Super Admin approves when review is required; then Admin uploads Certificate of Destruction.',
            '6. Clients download approved Form 6 — they still never see MRN.',
          ].join('\n'),
          'Silent billing-weight deviations are not allowed. Escalate capacity overrides to Super Admin with a documented reason.',
        );
        await dismissModal(page);
      } else {
        console.warn('  skip form6-form — Form 6 action not visible on this request');
      }
    } else {
      console.warn('  skip request-detail — no request available');
    }

    await page.goto(BASE + '/capacity', { waitUntil: 'networkidle' });
    await snap(
      page,
      'capacity',
      'Step 6 — Monitor factory capacity',
      [
        '1. Open Capacity.',
        '2. Review category utilisation for your facility.',
        '3. Watch for warnings near 80% and blocks at 100% authorised TPA.',
        '4. If Form 6 would exceed capacity, you need an approved override reason — do not bypass silently.',
        '5. Use Capacity before issuing unusual Form 6 volumes; coordinate with Super Admin for routing to another plant when needed.',
      ].join('\n'),
      'Capacity protects regulatory limits. Escalate to Urbeno admin before forcing an override.',
    );

    await page.goto(BASE + '/reports', { waitUntil: 'networkidle' });
    await snap(
      page,
      'reports',
      'Step 7 — Factory reports',
      [
        '1. Open Reports.',
        '2. Run MRN Register, Form 6 Log, Device Serials, Certificate Log, or Capacity Utilisation as available to your role.',
        '3. Export CSV/PDF when needed for audits.',
        '4. Confirm period filters refresh figures correctly.',
        '5. Never forward MRN Register exports to clients — MRN is factory / staff chain-of-custody data.',
      ].join('\n'),
      'Factory reports may include MRN data that clients must never receive. Handle exports carefully.',
    );

    await page.goto(BASE + '/profile', { waitUntil: 'networkidle' });
    await redactProfilePii(page);
    await snap(
      page,
      'profile',
      'Step 8 — Profile, facilities, and two-factor',
      [
        '1. Open Profile.',
        '2. Confirm Role is Factory Manager and Facilities lists your plant (e.g. URB-BLR).',
        '3. Set up Two-factor authentication when required for privileged roles.',
        '4. Change password using the policy (10+ chars, upper, lower, digit) if Urbeno asks.',
      ].join('\n'),
      'Factory MFA is recommended/required by policy for privileged roles. Keep your authenticator device safe.',
    );

    const signOut = page.getByRole('button', { name: /sign out|log out|logout/i }).first();
    if (await signOut.isVisible().catch(() => false)) {
      await signOut.click();
      await page.waitForTimeout(800);
      await snap(
        page,
        'signed-out',
        'Step 9 — Sign out',
        [
          '1. Click Logout when finished.',
          '2. Confirm the Sign In screen appears.',
          '3. Never leave a signed-in factory session on a shared kiosk.',
        ].join('\n'),
        'Factory sessions can create legal documents (MRN / Form 6). Always sign out.',
      );
    } else {
      console.warn('  skip signed-out — Sign out control not visible');
    }
  });

  writeManifest(OUT, {
    role: 'factory',
    roleLabel: 'Factory Manager',
    audience: 'Facility staff who record goods receipt (MRN) and recycling (Form 6)',
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
