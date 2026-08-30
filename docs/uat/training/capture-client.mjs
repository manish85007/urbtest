/**
 * Capture Client User training screenshots.
 * Usage: BASE_URL=http://localhost:8080 node docs/uat/training/capture-client.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  acceptPoliciesIfNeeded,
  clearShots,
  makeSnapper,
  redactProfilePii,
  roleOutDir,
  signIn,
  withBrowser,
  writeManifest,
} from './_capture-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const EMAIL = process.env.TEST_EMAIL || 'ramesh@techcorp.in';
const PASSWORD = process.env.TEST_PASSWORD || 'demo';
const OUT = roleOutDir('client');
const steps = [];

async function main() {
  clearShots(OUT);
  const snap = makeSnapper(OUT, steps);
  console.log('Client training capture →', OUT);

  await withBrowser(async (page) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'login',
      'Step 1 — Open the portal and sign in',
      '1. Open the portal URL provided by Urbeno in your browser (Chrome, Edge, or Safari recommended).\n2. Enter the email address from your account notification email.\n3. Enter the password issued to you (or the temporary password from your welcome email).\n4. Click Sign In.\n5. On first login, open Terms of Use and Privacy Policy, tick the acceptance box, then Accept.',
      'Never share your password. Use a private/incognito window if you also use other roles on the same computer. If Sign In fails, contact info@urbeno.in — do not email your password.',
    );

    await signIn(page, BASE, EMAIL, PASSWORD, { alreadyOnLogin: true });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'home',
      'Step 2 — Home dashboard overview',
      '1. After sign-in you land on Home.\n2. Read the welcome line — it should show your first name and organisation.\n3. Review the summary tiles: open requests, completed work, recycled kg, and trees planted.\n4. Use the top navigation: Home, My Requests, Recycling Heroes, Sustainability, Reports.\n5. Click + New Request when you are ready to raise a pickup.',
      'You should NOT see Masters, Audit, Capacity, or Compliance. Those areas are for Urbeno staff only. Your Home figures reflect your organisation only.',
    );

    const newBtn = page.getByRole('button', { name: /new request/i }).first();
    if (await newBtn.isVisible().catch(() => false)) {
      await newBtn.click();
      await page.waitForTimeout(700);
    }
    await snap(
      page,
      'new-request',
      'Step 3 — Raise a new collection request',
      '1. Click + New Request from Home or My Requests.\n2. Select Site (required) from the dropdown — only your organisation sites appear.\n3. Enter Pickup Location (building / floor / warehouse).\n4. Optionally enter Your PO / Reference.\n5. Confirm Pick Up Request Date.\n6. Enter Approx. Quantity (units) and Approx. Weight (kg). Exact weight is captured later at weighment.\n7. Add Notes if the team needs access instructions or a preferred window.\n8. Optionally attach a Bill of Materials (CSV/Excel/PDF) and/or add Line Items.\n9. Click Submit Request.\n10. Note the new REQ- number on the request detail screen — share it with Urbeno if staff need to advance the job.',
      'Leave required fields empty once to see validation messages, then fill them correctly. You cannot Acknowledge, Assign Vehicle, Weigh, or Raise Invoice — those are Urbeno actions.',
    );
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);

    await page.goto(BASE + '/requests', { waitUntil: 'networkidle' });
    await snap(
      page,
      'my-requests',
      'Step 4 — Track your requests list',
      '1. Open My Requests from the top navigation.\n2. Scan the list — every row should belong to your organisation.\n3. Use filters or search if available to find a specific REQ- number.\n4. Click a row to open request detail and see stage progress.',
      'You must never see another company\'s requests. If you do, stop and report it to Urbeno as a Blocker.',
    );

    const reqLink = page.locator('a[href*="/requests/REQ-"]').first();
    if (await reqLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await reqLink.click();
      await page.waitForLoadState('networkidle');
      await snap(
        page,
        'request-detail',
        'Step 5 — Follow a request through the lifecycle',
        '1. On request detail, find the stage badge (1–9) and header information (site, raised by, dates).\n2. As Urbeno advances the job, refresh to see vehicle, invoice, and certificate updates.\n3. Confirm you do NOT see Create MRN, Form 6 issue controls, or Upload Certificate.\n4. When certificate and payment are both complete, look for Review & Close.\n5. Open Review & Close → Acknowledge closure to finish Stage 9.',
        'Clients close the request after certificate + payment. Do not try Review & Close while payment is still outstanding — the system should refuse or hide the action.',
      );
    }

    await page.goto(BASE + '/heroes', { waitUntil: 'networkidle' });
    await snap(
      page,
      'heroes',
      'Step 6 — Recycling Heroes impact',
      '1. Open Recycling Heroes from the navigation.\n2. Explore planting / tonnage views for your organisation\'s contribution.\n3. Open any available detail cards or photos to understand the CSR story.',
      'This is a read-focused client view. Urbeno-wide planting controls may not appear for client users.',
    );

    await page.goto(BASE + '/impact', { waitUntil: 'networkidle' });
    await snap(
      page,
      'sustainability',
      'Step 7 — Sustainability figures',
      '1. Open Sustainability.\n2. Review recycled weight, CO2 avoided, and related impact for closed work.\n3. Open How these numbers are built / Methodology if offered.\n4. Download Impact PDF when you need a shareable summary for your organisation.',
      'In-progress requests do not inflate closed impact until the invoice is closed.',
    );

    await page.goto(BASE + '/reports', { waitUntil: 'networkidle' });
    await snap(
      page,
      'reports',
      'Step 8 — Run and export reports',
      '1. Open Reports.\n2. Choose a report type such as Request Summary, Invoice Register, Certificate Log, Sustainability, or Recycling Heroes.\n3. Set the period (FY / month) if a picker is shown.\n4. Run the report and Export CSV or PDF when available.\n5. Confirm there is no MRN Register — that report is for factory staff only.',
      'Exports must contain only your organisation\'s rows. Keep downloaded files confidential.',
    );

    await page.goto(BASE + '/legal/terms', { waitUntil: 'networkidle' });
    await snap(
      page,
      'legal-terms',
      'Step 9 — Read Terms of Use',
      '1. Open Terms of Use from the footer or the first-login acceptance gate.\n2. Scroll through the document so you understand obligations before accepting.\n3. Return to the portal via navigation or the browser back control.',
      'You will not be asked to re-accept unless Urbeno publishes a new version.',
    );

    await page.goto(BASE + '/profile', { waitUntil: 'networkidle' });
    await redactProfilePii(page);
    await snap(
      page,
      'profile',
      'Step 10 — Profile and change password',
      '1. Click your name / avatar → open profile (or go to /profile).\n2. Confirm Role is Client User and Organisation is correct.\n3. To change password: enter Current password, New password, Confirm new password.\n4. New password must be 10+ characters with upper-case, lower-case, and a digit.\n5. Click Update password.\n6. Confirm Two-factor authentication is NOT shown for client users.',
      'Do not change a shared training password unless Urbeno asks you to. Prefer N/A for password-change practice on shared accounts.',
    );

    const signOut = page.getByRole('button', { name: /sign out|log out|logout/i }).first();
    if (await signOut.isVisible().catch(() => false)) {
      await signOut.click();
      await page.waitForTimeout(900);
      await snap(
        page,
        'signed-out',
        'Step 11 — Sign out safely',
        '1. Click Logout in the top-right when you finish.\n2. Confirm you return to the Sign In screen.\n3. Close the browser tab if you are on a shared computer.',
        'Always sign out on shared machines. Policies are not re-prompted on the next visit unless updated.',
      );
    }
  });

  writeManifest(OUT, {
    role: 'client',
    roleLabel: 'Client User (Requestor)',
    audience: 'Waste generator / client organisation users who raise and close collection requests',
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
