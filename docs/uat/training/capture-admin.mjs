/**
 * Capture Super Admin / Urbeno operations training screenshots.
 * Usage: BASE_URL=http://localhost:8080 node docs/uat/training/capture-admin.mjs
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
const EMAIL = process.env.TEST_EMAIL || 'admin@urbeno.in';
const PASSWORD = process.env.TEST_PASSWORD || 'demo';
const OUT = roleOutDir('admin');
const steps = [];

async function main() {
  clearShots(OUT);
  const snap = makeSnapper(OUT, steps);
  console.log('Admin training capture →', OUT);

  await withBrowser(async (page) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'login',
      'Step 1 — Sign in as Super Admin',
      '1. Open the portal URL.\n2. Enter your Urbeno admin email from the account notification.\n3. Enter your password and click Sign In.\n4. Complete two-factor authentication if enrolled.\n5. Accept Terms and Privacy on first login if prompted.',
      'Admin accounts can change masters data and reset user passwords. Protect the authenticator and never share the session.',
    );

    await signIn(page, BASE, EMAIL, PASSWORD, { alreadyOnLogin: true });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'dashboard',
      'Step 2 — Operations dashboard',
      '1. Confirm you see the Operations Dashboard.\n2. Review tiles such as New Requests, open work, and operational KPIs.\n3. Use full navigation: Dashboard, Requests, Recycling Heroes, Sustainability, Capacity, Masters, Reports, Audit, Compliance.\n4. Click New Requests (or equivalent) to start acknowledging Stage 1 work.',
      'Admins see all organisations. Treat client data as confidential even inside Urbeno.',
    );

    await page.goto(BASE + '/requests', { waitUntil: 'networkidle' });
    await snap(
      page,
      'requests',
      'Step 3 — Requests queue',
      '1. Open Requests.\n2. Filter or search for Stage 1 items awaiting acknowledgement.\n3. Open a request to Acknowledge, Request changes, Assign Vehicle, record Weighment, or Raise Invoice depending on stage.\n4. Keep unique suffixes on registration / invoice / e-way / certificate numbers during training re-runs.',
      'Walk one request through stages 2–5 carefully before handing to factory for MRN / Form 6.',
    );

    const reqLink = page.locator('a[href*="/requests/REQ-"]').first();
    if (await reqLink.isVisible({ timeout: 4000 }).catch(() => false)) {
      await reqLink.click();
      await page.waitForLoadState('networkidle');
      await snap(
        page,
        'request-detail',
        'Step 4 — Lifecycle actions on a request',
        '1. Open request detail and read the current stage.\n2. Stage 1: Acknowledge Request or Request changes (with a clear note to the client).\n3. Stage 3: Assign Vehicle (registration, driver, phone).\n4. Stage 4: Record weighment with slip photo + pickup photo; verify net = gross − tare.\n5. Stage 5: Raise Invoice — tax/total calculated, e-way bill required.\n6. Stage 8: Upload Certificate of Destruction after Form 6 is approved.\n7. Record Payment when funds arrive so the client can close.',
        'Weighment without both photos must be refused. Do not type tax totals manually when the system calculates them.',
      );
    }

    await page.goto(BASE + '/masters', { waitUntil: 'networkidle' });
    await snap(
      page,
      'masters',
      'Step 5 — Masters data administration',
      '1. Open Masters.\n2. Use tabs for Users, Clients, Sites, Factories, Categories, Lookups, Email as available.\n3. To help a user who cannot receive email OTPs: Users → Edit user → Reset / regenerate password → copy the temporary password and share it securely out-of-band.\n4. Create users carefully — welcome emails include temporary passwords.',
      'Never disable your own admin account. Prefer a throwaway user for password-lockout drills.',
    );

    // Try users tab if visible
    const usersTab = page.getByRole('button', { name: /^users$/i }).or(page.getByText(/^Users$/)).first();
    if (await usersTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await usersTab.click();
      await page.waitForTimeout(600);
      await snap(
        page,
        'masters-users',
        'Step 6 — Users and password reset',
        '1. Open the Users tab.\n2. Find the affected user and click Edit.\n3. Confirm role, organisation/factory scope, and Active status.\n4. Click Reset / regenerate password when email OTP is unavailable.\n5. Copy the temporary password shown and communicate it via a secure channel.\n6. Ask the user to sign in and change the password immediately.',
        'Password reset signs the user out of all sessions and clears lockouts. Audit logs record the action.',
      );
      await page.keyboard.press('Escape').catch(() => {});
    }

    await page.goto(BASE + '/capacity', { waitUntil: 'networkidle' });
    await snap(
      page,
      'capacity',
      'Step 7 — Capacity oversight',
      '1. Open Capacity.\n2. Review utilisation across factories and categories.\n3. Support factory teams when an override is justified and documented.\n4. Use capacity views before approving unusual Form 6 volumes.',
      'Overrides are audited. Prefer prevention (routing to another plant) over chronic overrides.',
    );

    await page.goto(BASE + '/reports', { waitUntil: 'networkidle' });
    await snap(
      page,
      'reports',
      'Step 8 — Operational reports',
      '1. Open Reports.\n2. Run Request Summary, Invoice Register, Sustainability, Heroes, and other admin reports.\n3. Export for client packs or internal reviews.\n4. Cross-check figures against a known closed REQ- during training.',
      'When preparing client-facing exports, ensure tenancy filters are correct.',
    );

    await page.goto(BASE + '/audit', { waitUntil: 'networkidle' });
    await snap(
      page,
      'audit',
      'Step 9 — Audit trail',
      '1. Open Audit.\n2. Filter by request id, actor, action, or date range.\n3. Confirm lifecycle events appear (ack, vehicle, weigh, invoice, MRN, recycle, certificate, payment, close).\n4. Use Audit during UAT sign-off to prove the chain of custody.',
      'If an expected event is missing, investigate before production sign-off.',
    );

    await page.goto(BASE + '/compliance', { waitUntil: 'networkidle' });
    await snap(
      page,
      'compliance',
      'Step 10 — Compliance registers',
      '1. Open Compliance.\n2. Review privacy, DSR, incidents, access reviews, and control status as available.\n3. Confirm factory and client users cannot open this area.\n4. Keep evidence packs ready for audits.',
      'Compliance is admin-only. A factory or client reaching this page is a Blocker.',
    );

    await page.goto(BASE + '/heroes', { waitUntil: 'networkidle' });
    await snap(
      page,
      'heroes',
      'Step 11 — Recycling Heroes administration',
      '1. Open Recycling Heroes.\n2. Review plantings and tonnage.\n3. Record planting when authorised (photos, location, counts).\n4. Ensure client views remain appropriately scoped.',
      'Planting records support sustainability storytelling — keep photo evidence.',
    );

    await page.goto(BASE + '/profile', { waitUntil: 'networkidle' });
    await redactProfilePii(page);
    await snap(
      page,
      'profile',
      'Step 12 — Admin profile, MFA, and letterhead',
      '1. Open Profile.\n2. Confirm Role is Urbeno Admin / Super Admin.\n3. Enrol or manage Two-factor authentication.\n4. Update password per policy when required.\n5. Edit Urbeno letterhead / company details if shown — these flow into Form 6 and MRN PDFs.',
      'Letterhead mistakes appear on legal PDFs. Double-check GST and address before saving.',
    );

    const signOut = page.getByRole('button', { name: /sign out|log out|logout/i }).first();
    if (await signOut.isVisible().catch(() => false)) {
      await signOut.click();
      await page.waitForTimeout(800);
      await snap(
        page,
        'signed-out',
        'Step 13 — Sign out',
        '1. Click Logout.\n2. Confirm Sign In appears.\n3. Lock your workstation if stepping away mid-session instead of leaving the portal open.',
        'Admin sessions can change production masters — treat them like production console access.',
      );
    }
  });

  writeManifest(OUT, {
    role: 'admin',
    roleLabel: 'Super Admin (Urbeno Operations)',
    audience: 'Urbeno administrators who run the lifecycle, Masters, Audit, and Compliance',
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
