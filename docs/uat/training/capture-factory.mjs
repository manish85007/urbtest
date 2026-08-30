/**
 * Capture Factory Manager training screenshots.
 * Usage: BASE_URL=http://localhost:8080 node docs/uat/training/capture-factory.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
      '1. Open the portal URL.\n2. Enter the factory account email issued by Urbeno (for example the Bengaluru or Kolar facility login).\n3. Enter your password and click Sign In.\n4. Accept Terms and Privacy on first login if prompted.',
      'Factory accounts are privileged. Set up two-factor authentication on Profile when Urbeno asks you to. Do not use a client login for factory work.',
    );

    await signIn(page, BASE, EMAIL, PASSWORD, { alreadyOnLogin: true });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'dashboard',
      'Step 2 — Factory dashboard',
      '1. Confirm the heading shows a Factory / facility dashboard (e.g. URB-BLR).\n2. Review tiles for open work, capacity used, and payments if shown.\n3. Use navigation: Dashboard, Requests, Capacity, Reports.\n4. Confirm Masters, Audit, Compliance, Recycling Heroes, and Sustainability are NOT in the menu.',
      'If you can open Compliance or Masters, stop and report a Blocker — those are admin-only.',
    );

    await page.goto(BASE + '/requests', { waitUntil: 'networkidle' });
    await snap(
      page,
      'requests',
      'Step 3 — Requests ready for factory work',
      '1. Open Requests.\n2. Find invoiced requests that need MRN (Stage 5) or Form 6 (Stage 6).\n3. Confirm there is no + New Request for factory users — clients and admins raise requests.\n4. Open an invoiced request to continue to goods receipt.',
      'Seeded training data may include sample REQ numbers. Prefer a live invoiced request for practice.',
    );

    const reqLink = page.locator('a[href*="/requests/REQ-"]').first();
    if (await reqLink.isVisible({ timeout: 4000 }).catch(() => false)) {
      await reqLink.click();
      await page.waitForLoadState('networkidle');
      await snap(
        page,
        'request-detail',
        'Step 4 — Open request detail for MRN / Form 6',
        '1. On request detail, locate the invoice panel.\n2. When Stage is 5 (invoiced) and no MRN exists, look for Create MRN.\n3. After MRN exists, look for Process & Issue Form 6.\n4. Confirm you do NOT see Acknowledge, Raise Invoice, or Upload Certificate (admin actions).\n5. Confirm clients will not see MRN numbers even though you create them here.',
        'One MRN per invoice. Form 6 category split must equal billing weight exactly.',
      );

      // Try to open MRN modal if button exists
      const mrnBtn = page.getByRole('button', { name: /create mrn|mrn/i }).first();
      if (await mrnBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await mrnBtn.click();
        await page.waitForTimeout(700);
        await snap(
          page,
          'mrn-form',
          'Step 5 — Create MRN (goods receipt)',
          '1. Click Create MRN.\n2. Confirm factory, received date (not a future date), and materials lines.\n3. Enter driver / manager / security officer signatures as required.\n4. Attach gate photo(s) and material photo(s).\n5. Submit to create the MRN number.\n6. Refresh — MRN details appear for factory; clients must still not see the MRN number.',
          'Do not invent categories at the gate — categories belong on Form 6. Photos are required for a valid receipt.',
        );
        await page.keyboard.press('Escape').catch(() => {});
      }
    }

    await page.goto(BASE + '/capacity', { waitUntil: 'networkidle' });
    await snap(
      page,
      'capacity',
      'Step 6 — Monitor factory capacity',
      '1. Open Capacity.\n2. Review category utilisation for your facility.\n3. Watch for warnings near 80% and blocks at 100% authorised TPA.\n4. If Form 6 would exceed capacity, you need an approved override reason — do not bypass silently.',
      'Capacity protects regulatory limits. Escalate to Urbeno admin before forcing an override.',
    );

    await page.goto(BASE + '/reports', { waitUntil: 'networkidle' });
    await snap(
      page,
      'reports',
      'Step 7 — Factory reports',
      '1. Open Reports.\n2. Run MRN Register, Form 6 Log, Device Serials, Certificate Log, or Capacity Utilisation as available to your role.\n3. Export CSV/PDF when needed for audits.\n4. Confirm period filters refresh figures correctly.',
      'Factory reports may include MRN data that clients must never receive. Handle exports carefully.',
    );

    await page.goto(BASE + '/profile', { waitUntil: 'networkidle' });
    await redactProfilePii(page);
    await snap(
      page,
      'profile',
      'Step 8 — Profile, facilities, and two-factor',
      '1. Open Profile.\n2. Confirm Role is Factory Manager and Facilities lists your plant (e.g. URB-BLR).\n3. Set up Two-factor authentication when required for privileged roles.\n4. Change password using the policy (10+ chars, upper, lower, digit) if Urbeno asks.',
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
        '1. Click Logout when finished.\n2. Confirm the Sign In screen appears.\n3. Never leave a signed-in factory session on a shared kiosk.',
        'Factory sessions can create legal documents (MRN / Form 6). Always sign out.',
      );
    }
  });

  writeManifest(OUT, {
    role: 'factory',
    roleLabel: 'Factory Manager',
    audience: 'Facility staff who record goods receipt (MRN) and recycling (Form 6)',
    portal: 'https://uat.urbeno.in',
    baseCaptured: BASE,
    steps,
  });
  console.log('Done.', steps.length, 'steps');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
