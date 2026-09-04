/**
 * Detailed Client User training screenshots — every major client screen + forms.
 * Usage: BASE_URL=http://localhost:8080 node docs/uat/training/capture-client.mjs
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
const EMAIL = process.env.TEST_EMAIL || 'ramesh@techcorp.in';
const PASSWORD = process.env.TEST_PASSWORD || 'demo';
const OUT = roleOutDir('client');
const steps = [];
const { pdf } = fixturePaths();

async function dismissModal(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(350);
}

async function main() {
  clearShots(OUT);
  const snap = makeSnapper(OUT, steps);
  const uniq = Date.now().toString().slice(-6);
  console.log('Detailed Client User capture →', OUT);

  await withBrowser(async (page) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'login',
      'Step 1 — Open the portal and sign in',
      [
        '1. Open https://tectrack.urbeno.in in Chrome, Edge, or Safari.',
        '2. Enter the email from your account notification.',
        '3. Enter your password (or temporary password from the welcome email).',
        '4. Click Sign In.',
        '5. On first login, accept Terms of Use and Privacy Policy.',
        '6. Change a temporary password immediately when prompted.',
      ].join('\n'),
      'Never share your password. Contact info@urbeno.in if locked out — do not email your password.',
    );
    await signIn(page, BASE, EMAIL, PASSWORD, { alreadyOnLogin: true });

    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'home',
      'Step 2 — Home dashboard',
      [
        '1. After sign-in you land on Home.',
        '2. Read the welcome line — your name and organisation.',
        '3. Review tiles: open requests, completed work, recycled kg, trees planted.',
        '4. Navigation: Home, My Requests, Recycling Heroes, Sustainability, Reports.',
        '5. Click + New Request when ready to raise a pickup.',
        '6. Your lifecycle: raise → Urbeno ack/vehicle/weigh/invoice → Factory MRN & Form 6 → Urbeno CoD → you download Form 6/CoD → you close after payment.',
      ].join('\n'),
      'You must NOT see Masters, Audit, Capacity, or Compliance. Figures are your organisation only.',
    );

    await page.goto(BASE + '/requests/new', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await page.getByLabel(/pickup location/i).fill(`Client training bay ${uniq}`);
    await page.getByLabel(/approx\.?\s*quantity/i).fill('10');
    await page.getByLabel(/approx\.?\s*weight/i).fill('50');
    const notes = page.getByLabel(/^notes$/i);
    if (await notes.isVisible().catch(() => false)) await notes.fill(`Client training ${uniq}`);
    const item = page.getByPlaceholder('Item description');
    if (await item.isVisible().catch(() => false)) await item.fill(`Laptops batch ${uniq}`);
    await snap(
      page,
      'new-request-form',
      'Step 3 — New collection request form (filled)',
      [
        '1. Click + New Request from Home or My Requests.',
        '2. Select Site (required) — only your organisation sites appear.',
        '3. Enter Pickup Location (building / floor / warehouse).',
        '4. Optionally enter Your PO / Reference.',
        '5. Confirm Pick Up Request Date (clients cannot historical-backdate like Super Admin).',
        '6. Enter Approx. Quantity (units) and Approx. Weight (kg).',
        '7. Add Notes for access instructions if needed.',
        '8. Optionally attach a Bill of Materials and/or add Line Items.',
        '9. Click Submit Request.',
      ].join('\n'),
      'Exact weight is captured later at weighment by Urbeno. Client Read Only users cannot raise requests.',
    );
    await page.getByRole('button', { name: /submit request/i }).click();
    await page.waitForTimeout(2000);
    const heading = await page.getByRole('heading', { level: 1 }).textContent().catch(() => '');
    const newId = String(heading || '').match(/REQ-[\w-]+/)?.[0];
    await snap(
      page,
      'request-submitted',
      'Step 4 — Request submitted (Stage 1)',
      [
        '1. Note the new REQ- number on the detail screen.',
        '2. Share it with Urbeno if staff need to advance the job.',
        '3. Stage shows awaiting acknowledgement.',
        '4. You cannot Acknowledge, Assign Vehicle, Weigh, Raise Invoice, Create MRN, or Upload Certificate.',
      ].join('\n'),
      `What happens next: Operations/Admin Acknowledge → Vehicle → Weigh → Invoice; Factory MRN → Form 6; Admin CoD; you Review & Close after payment.${newId ? ` Training REQ: ${newId}.` : ''}`,
    );

    await page.goto(BASE + '/requests', { waitUntil: 'networkidle' });
    await snap(
      page,
      'my-requests',
      'Step 5 — My Requests list',
      [
        '1. Open My Requests.',
        '2. Every row must belong to your organisation only.',
        '3. Use search/filters to find a REQ- number.',
        '4. Click a row to open detail and track stages 1–9.',
        '5. You must never see MRN numbers or another company\'s requests.',
      ].join('\n'),
      'If you see another company or an MRN number, stop and report a Blocker to Urbeno.',
    );

    // Prefer a closed / advanced sample for document downloads
    for (const id of ['REQ-00050', 'REQ-00048', newId].filter(Boolean)) {
      await page.goto(`${BASE}/requests/${id}`, { waitUntil: 'networkidle' });
      if (await page.getByText(id).first().isVisible({ timeout: 2500 }).catch(() => false)) {
        await snap(
          page,
          'request-detail',
          'Step 6 — Follow a request through the lifecycle',
          [
            '1. Read the stage badge and header (site, raised by, dates).',
            '2. Refresh as Urbeno advances vehicles, invoice, Form 6, and certificate.',
            '3. Confirm you do NOT see Create MRN, Acknowledge, Assign Vehicle, Weigh, Raise Invoice, or Upload Certificate.',
            '4. When Form 6 is approved, download Form 6 PDF if offered.',
            '5. When CoD is uploaded, download the certificate PDF.',
            '6. When certificate + payment are complete, use Review & Close.',
          ].join('\n'),
          'Clients close after certificate + payment. Client Read Only can download but cannot close.',
        );

        const f6 = page.getByRole('link', { name: /form\s*6/i }).or(page.getByRole('button', { name: /form\s*6/i })).first();
        if (await f6.isVisible({ timeout: 1500 }).catch(() => false)) {
          await f6.scrollIntoViewIfNeeded().catch(() => {});
          await snap(
            page,
            'form6-download',
            'Step 7 — Download Form 6 when available',
            [
              '1. On an advanced request, locate Form 6 on the invoice / documents area.',
              '2. Click Download / Form 6 PDF when approved.',
              '3. Store the PDF with your compliance records.',
              '4. You still must never see an MRN number.',
            ].join('\n'),
            'Form 6 appears after Factory processing and (when required) Super Admin approval.',
          );
        }

        const cod = page.getByRole('link', { name: /certificate|cod/i }).or(page.getByText(/certificate of destruction/i)).first();
        if (await cod.isVisible({ timeout: 1500 }).catch(() => false)) {
          await cod.scrollIntoViewIfNeeded().catch(() => {});
          await snap(
            page,
            'cod-download',
            'Step 8 — Certificate of Destruction available',
            [
              '1. Locate Certificate of Destruction on the request.',
              '2. Download the signed CoD PDF for your records.',
              '3. Payment must also be recorded before Review & Close unlocks.',
            ].join('\n'),
            'Keep CoD with your organisation audit pack.',
          );
        }

        const closeBtn = page.getByRole('button', { name: /review\s*&\s*close/i }).first();
        if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await closeBtn.click();
          await page.waitForTimeout(600);
          await snap(
            page,
            'review-close',
            'Step 9 — Review & Close modal',
            [
              '1. When CoD + payment are complete, click Review & Close.',
              '2. Read the summary in the modal.',
              '3. Click Acknowledge closure to finish Stage 9.',
            ].join('\n'),
            'Do not try Review & Close while payment is outstanding — the control stays hidden or refused.',
          );
          await dismissModal(page);
        }
        break;
      }
    }

    await page.goto(BASE + '/heroes', { waitUntil: 'networkidle' });
    await snap(
      page,
      'heroes',
      'Step 10 — Recycling Heroes',
      [
        '1. Open Recycling Heroes.',
        '2. Explore planting / tonnage views for your organisation.',
        '3. Closed recycled work feeds Heroes milestones.',
      ].join('\n'),
      'This is a read-focused client view.',
    );

    await page.goto(BASE + '/impact', { waitUntil: 'networkidle' });
    await snap(
      page,
      'sustainability',
      'Step 11 — Sustainability figures',
      [
        '1. Open Sustainability.',
        '2. Review recycled weight, CO2 avoided, and related impact.',
        '3. Open methodology notes if offered.',
        '4. Download Impact PDF when you need a shareable summary.',
      ].join('\n'),
      'In-progress requests do not inflate closed impact.',
    );

    await page.goto(BASE + '/reports', { waitUntil: 'networkidle' });
    await snap(
      page,
      'reports',
      'Step 12 — Reports and exports',
      [
        '1. Open Reports.',
        '2. Choose Request Summary, Invoice Register, Certificate Log, Form 6 Log, Sustainability, or Heroes.',
        '3. Set period filters and export CSV/PDF when available.',
        '4. Confirm there is no MRN Register — that is factory-only.',
      ].join('\n'),
      'Exports must contain only your organisation\'s rows.',
    );

    await page.goto(BASE + '/legal/terms', { waitUntil: 'networkidle' }).catch(() =>
      page.goto(BASE + '/', { waitUntil: 'networkidle' }),
    );
    const termsLink = page.getByRole('link', { name: /terms/i }).first();
    if (await termsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await termsLink.click();
      await page.waitForLoadState('networkidle');
    }
    await snap(
      page,
      'legal-terms',
      'Step 13 — Terms of Use',
      [
        '1. Open Terms of Use from the footer or first-login gate.',
        '2. Scroll through obligations before accepting on first login.',
      ].join('\n'),
      'You are not re-prompted unless Urbeno publishes a new version.',
    );

    await page.goto(BASE + '/profile', { waitUntil: 'networkidle' });
    await redactProfilePii(page);
    await snap(
      page,
      'profile',
      'Step 14 — Profile and password',
      [
        '1. Open Profile.',
        '2. Confirm Role is Client User and Organisation is correct.',
        '3. Change password: Current → New (10+ chars, upper, lower, digit) → Confirm → Update.',
        '4. Confirm Two-factor authentication is NOT shown for client users.',
      ].join('\n'),
      'Do not change shared training passwords unless Urbeno asks.',
    );

    await logout(page, BASE);
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await snap(
      page,
      'signed-out',
      'Step 15 — Sign out safely',
      [
        '1. Click Logout when finished.',
        '2. Confirm the Sign In screen appears.',
        '3. Close the browser tab on shared computers.',
      ].join('\n'),
      'Always sign out on shared machines.',
    );
  });

  writeManifest(OUT, {
    role: 'client',
    roleLabel: 'Client User (Requestor)',
    audience: 'Waste generator / client organisation users who raise, track, download documents, and close collection requests',
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
