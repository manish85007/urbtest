/**
 * Capture Operations Manager training screenshots.
 * Focus: acknowledge → vehicle → weighment, plus capacity / reports / heroes / profile.
 * Usage: BASE_URL=http://localhost:8080 node docs/uat/training/capture-operations.mjs
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
const EMAIL = process.env.TEST_EMAIL || 'ops@urbeno.in';
const PASSWORD = process.env.TEST_PASSWORD || 'demo';
const OUT = roleOutDir('operations');
const steps = [];

async function dismissModal(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(350);
}

async function tryOpenRequest(page) {
  await page.goto(BASE + '/requests', { waitUntil: 'networkidle' });
  const preferred = ['REQ-00046', 'REQ-00047', 'REQ-00048'];
  for (const id of preferred) {
    await page.goto(`${BASE}/requests/${id}`, { waitUntil: 'networkidle' });
    if (await page.getByText(id).first().isVisible({ timeout: 2500 }).catch(() => false)) {
      return id;
    }
  }
  await page.goto(BASE + '/requests', { waitUntil: 'networkidle' });
  const link = page.locator('a[href*="/requests/REQ-"]').first();
  if (await link.isVisible({ timeout: 4000 }).catch(() => false)) {
    await link.click();
    await page.waitForLoadState('networkidle');
    return true;
  }
  return null;
}

async function main() {
  clearShots(OUT);
  const snap = makeSnapper(OUT, steps);
  console.log('Operations Manager training capture →', OUT);

  await withBrowser(async (page) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'login',
      'Step 1 — Sign in as Operations Manager',
      [
        '1. Open https://tectrack.urbeno.in in Chrome, Edge, or Safari.',
        '2. Enter your @urbeno.in email from the account notification.',
        '3. Enter your password and click Sign In.',
        '4. Complete MFA if enrolled (staff MFA applies to Operations).',
        '5. Accept Terms and Privacy on first login if prompted; set a new password if must-reset is required.',
      ].join('\n'),
      'Operations accounts are Urbeno-only. Never share MFA codes. Contact info@urbeno.in if locked out — do not put passwords in tickets.',
    );

    await signIn(page, BASE, EMAIL, PASSWORD, { alreadyOnLogin: true });

    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'dashboard',
      'Step 2 — Operations dashboard',
      [
        '1. Land on the Operations Dashboard.',
        '2. Review open requests, KPIs, and shortcuts into the queue (e.g. New Requests / awaiting acknowledgement).',
        '3. Confirm navigation: Dashboard, Requests, Recycling Heroes, Sustainability, Capacity, Reports.',
        '4. Confirm you do NOT see Masters, Audit, or Compliance — those are Super Admin / Auditor areas.',
        '5. Your focus path: Acknowledge → Assign Vehicle → Record Weighment, then hand off billing / MRN / Form 6 / CoD.',
      ].join('\n'),
      'You see all client organisations. Treat data as confidential. If Masters appears in your menu, stop and report a Blocker.',
    );

    await page.goto(BASE + '/requests', { waitUntil: 'networkidle' });
    await snap(
      page,
      'requests',
      'Step 3 — Work the requests queue',
      [
        '1. Open Requests.',
        '2. Filter or scan for Stage 1 / New items awaiting acknowledgement.',
        '3. Open a request, then Acknowledge or Request changes with a clear note to the client.',
        '4. After acknowledgement, Assign Vehicle when ready (registration, driver, phone, expected pickup).',
        '5. Record weighment with slip photo and pickup photo; confirm net = gross − tare.',
        '6. You typically do not Raise Invoice, Create MRN, Issue Form 6, or Upload Certificate — hand those to Super Admin / Factory.',
      ].join('\n'),
      'Missing invoice / MRN / CoD buttons is expected for Operations. Escalate billing and CoD to Super Admin; goods receipt to Factory.',
    );

    const opened = await tryOpenRequest(page);
    if (opened) {
      await snap(
        page,
        'request-detail',
        'Step 4 — Lifecycle actions in your scope',
        [
          '1. On request detail, read the stage badge and header (site, dates, approx weight).',
          '2. Stage 1: Acknowledge Request or Request changes / Reject when offered.',
          '3. After ack: Assign Vehicle — you cannot use Super Admin historical backdating from 2026-04-01.',
          '4. Stage 4: Record Weighment (weighment date is today for Operations; both photo sets required).',
          '5. Acknowledge loading complete after every vehicle is weighed.',
          '6. Refresh as Super Admin raises the invoice and Factory completes MRN / Form 6 / CoD.',
          '7. Use Queries only if your account has manage-queries (usually Super Admin only).',
        ].join('\n'),
        'If a button is missing, that action is outside Operations Manager permissions — escalate rather than inventing a workaround.',
      );

      const ack = page.getByRole('button', { name: /acknowledge request/i }).first();
      if (await ack.isVisible({ timeout: 2000 }).catch(() => false)) {
        await ack.click();
        await page.waitForTimeout(700);
        await snap(
          page,
          'acknowledge',
          'Step 4b — Acknowledge Request modal',
          [
            '1. Click Acknowledge Request.',
            '2. Review site, weight, units, and request date in the modal.',
            '3. Confirm Acknowledge — the client receives an acknowledgement email.',
            '4. Expected outcome: request moves to Vehicles & Weighment.',
          ].join('\n'),
          'Use Request changes with a clear note when client data is wrong — do not invent site details for them.',
        );
        await dismissModal(page);
      } else {
        console.warn('  skip acknowledge — Acknowledge Request not visible on this request');
      }

      const veh = page.getByRole('button', { name: /assign vehicle/i }).first();
      if (await veh.isVisible({ timeout: 2000 }).catch(() => false)) {
        await veh.click();
        await page.waitForTimeout(700);
        await snap(
          page,
          'assign-vehicle',
          'Step 4c — Assign Vehicle',
          [
            '1. Click Assign Vehicle.',
            '2. Enter registration, vehicle type, logistics partner, driver name, and phone.',
            '3. Set expected pickup date and time (or a quick slot).',
            '4. Add team members if required, then save.',
            '5. Historical backdating of expected pickup from 2026-04-01 is Super Admin only — Operations uses normal scheduling rules.',
          ].join('\n'),
          'Never invent a live registration plate. Prefer seeded training vehicles when practising re-runs.',
        );
        await dismissModal(page);
      } else {
        console.warn('  skip assign-vehicle — Assign Vehicle not visible');
      }

      const weigh = page.getByRole('button', { name: /record weighment|weigh \(/i }).first();
      if (await weigh.isVisible({ timeout: 2000 }).catch(() => false)) {
        await weigh.click();
        await page.waitForTimeout(700);
        await snap(
          page,
          'weighment',
          'Step 4d — Record Weighment',
          [
            '1. Click Record Weighment (or Weigh pending) on a vehicle.',
            '2. Enter slip number, gross kg, and tare kg — verify net = gross − tare.',
            '3. Weighment date for Operations is today (no Super Admin historical window).',
            '4. Attach weighment slip photo(s) and pickup photo(s).',
            '5. Submit, then Acknowledge loading complete when all vehicles are weighed.',
            '6. Hand off to Super Admin for Raise Invoice.',
          ].join('\n'),
          'Refuse weighment without both photo sets. Do not type invented weights.',
        );
        await dismissModal(page);
      } else {
        console.warn('  skip weighment — Record Weighment not visible (may already be weighed)');
      }
    } else {
      console.warn('  skip request-detail — no request available');
    }

    await page.goto(BASE + '/capacity', { waitUntil: 'networkidle' });
    await snap(
      page,
      'capacity',
      'Step 5 — Capacity view',
      [
        '1. Open Capacity.',
        '2. Review authorised category utilisation across factories.',
        '3. Note near-limit categories when planning pickups.',
        '4. Escalate override needs to Super Admin / Factory — do not bypass capacity silently.',
      ].join('\n'),
      'Capacity is read-focused for Operations; category master edits are Super Admin.',
    );

    await page.goto(BASE + '/reports', { waitUntil: 'networkidle' });
    await snap(
      page,
      'reports',
      'Step 6 — Reports and exports',
      [
        '1. Open Reports.',
        '2. Run Request Summary, Complete Request Summary, Invoice Register, Sustainability, Heroes, Serials as needed.',
        '3. Set FY / period filters.',
        '4. Export CSV or PDF when available.',
        '5. You may see multi-client rows — store exports securely and do not forward MRN-only factory packs to clients.',
      ].join('\n'),
      'Exports may contain multi-client data — handle under Urbeno confidentiality rules.',
    );

    await page.goto(BASE + '/heroes', { waitUntil: 'networkidle' });
    await snap(
      page,
      'heroes',
      'Step 7 — Recycling Heroes',
      [
        '1. Open Recycling Heroes.',
        '2. Review organisation tonnage and planting milestones.',
        '3. Use period filters to prepare client updates.',
        '4. Planting admin controls (if any) may be Super Admin only — escalate if you need a new planting record.',
      ].join('\n'),
      'Heroes views support client storytelling — keep photo evidence when you help Super Admin record plantings.',
    );

    await page.goto(BASE + '/profile', { waitUntil: 'networkidle' });
    await redactProfilePii(page);
    await snap(
      page,
      'profile',
      'Step 8 — Profile, password, and MFA',
      [
        '1. Open Profile.',
        '2. Confirm Role is Operations Manager.',
        '3. Change password using the policy (length + complexity) when Urbeno asks.',
        '4. Enrol or manage MFA within the grace window if prompted.',
        '5. Confirm you do not see Masters letterhead editors reserved for Super Admin.',
      ].join('\n'),
      'After the MFA grace period, staff must enrol before continuing. Keep your authenticator device safe.',
    );

    const signOut = page.getByRole('button', { name: /sign out|log out|logout/i }).first();
    if (await signOut.isVisible().catch(() => false)) {
      await signOut.click();
      await page.waitForTimeout(800);
      await snap(
        page,
        'signed-out',
        'Step 9 — Sign out safely',
        [
          '1. Open the account menu if needed.',
          '2. Click Sign out / Logout.',
          '3. Confirm you return to the login screen.',
          '4. Always sign out on shared devices.',
        ].join('\n'),
        'Operations sessions can acknowledge live client work — never leave them open on a kiosk.',
      );
    } else {
      console.warn('  skip signed-out — Sign out control not visible');
    }
  });

  writeManifest(OUT, {
    role: 'operations',
    roleLabel: 'Operations Manager',
    audience:
      'Urbeno Operations Managers who acknowledge requests, manage vehicles and weighments, and run reports',
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
