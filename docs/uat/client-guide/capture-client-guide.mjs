/**
 * Capture professional client-portal screenshots (no credentials in the guide).
 * Usage: node docs/uat/client-guide/capture-client-guide.mjs
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../../..');
const require = createRequire(path.join(root, 'package.json'));
const playwrightEntry = path.join(
  root,
  'node_modules/.pnpm/playwright@1.62.1/node_modules/playwright',
);
const { chromium } = require(playwrightEntry);

const OUT = path.join(__dirname, 'screenshots');
const BASE = process.env.BASE_URL || 'https://uat.urbeno.in';
const EMAIL = process.env.TEST_EMAIL || 'ramesh@techcorp.in';
const PASSWORD = process.env.TEST_PASSWORD || 'demo';

fs.mkdirSync(OUT, { recursive: true });

const steps = [];

async function snap(page, id, title, notes = '') {
  const file = `${String(steps.length + 1).padStart(2, '0')}-${id}.png`;
  const full = path.join(OUT, file);
  await page.waitForTimeout(500);
  await page.screenshot({ path: full, fullPage: true });
  steps.push({ id, title, notes, file });
  console.log('captured', file, '—', title);
}

async function acceptPoliciesIfNeeded(page) {
  const gate = page.getByText(/Accept policies to continue/i);
  if (await gate.isVisible({ timeout: 2500 }).catch(() => false)) {
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.check({ force: true }).catch(() => checkbox.click({ force: true }));
    }
    const acceptBtn = page.getByRole('button', { name: /accept/i }).first();
    if (await acceptBtn.isVisible().catch(() => false)) {
      await acceptBtn.click();
      await page.waitForTimeout(800);
    }
  }
}

async function main() {
  for (const f of fs.readdirSync(OUT)) {
    if (/\.(png|jpg|json)$/.test(f)) fs.unlinkSync(path.join(OUT, f));
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // Login — empty form only (no credentials on screen for the PDF)
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await snap(
    page,
    'login',
    'Open the portal and sign in',
    'Open the UAT portal URL provided by Urbeno. Enter the email and password issued to your organisation, then choose Sign In. On first use you may be asked to review and accept the Terms of Use and Privacy Policy before continuing.',
  );

  // Sign in for the rest of the walkthrough (credentials never shown in screenshots)
  await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.waitForTimeout(1500);
  await acceptPoliciesIfNeeded(page);
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  await snap(
    page,
    'home',
    'Home dashboard',
    'After sign-in you land on Home. Review open and completed request counts, sustainability figures, and recent activity. Use the top navigation (Home, My Requests, Recycling Heroes, Sustainability, Reports) to move around the client portal.',
  );

  // New Request early — as requested
  const newBtn = page.getByRole('button', { name: /new request/i }).first();
  if (await newBtn.isVisible().catch(() => false)) {
    await newBtn.click();
    await page.waitForTimeout(700);
  } else {
    await page.goto(BASE + '/requests', { waitUntil: 'networkidle' });
    const alt = page.getByRole('button', { name: /new request/i }).first();
    if (await alt.isVisible().catch(() => false)) await alt.click();
    await page.waitForTimeout(700);
  }
  await snap(
    page,
    'new-request',
    'Raise a new collection request',
    'Choose + New Request. Select your site, enter the pickup location, approximate quantity and weight, optional PO/reference and notes, and add line items or attach a Bill of Materials. Submit Request creates a new REQ- number at Stage 1 (awaiting Urbeno acknowledgement). Exact weights are captured later at weighment.',
  );
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(400);

  await page.goto(BASE + '/requests', { waitUntil: 'networkidle' });
  await snap(
    page,
    'my-requests',
    'My Requests list',
    'My Requests shows only your organisation’s collections. Open any row to track stage progress. You will not see other companies’ requests.',
  );

  const reqLink = page.locator('a[href*="/requests/REQ-"]').first();
  if (await reqLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await reqLink.click();
    await page.waitForLoadState('networkidle');
    await snap(
      page,
      'request-detail',
      'Track a request through the lifecycle',
      'Request detail shows stage progress, vehicle and invoice information when available, and certificate status. Client users do not create MRNs or Form 6 — those are factory and Urbeno actions. When the certificate is ready and payment is recorded, use Review & Close to complete Stage 9.',
    );
  }

  await page.goto(BASE + '/heroes', { waitUntil: 'networkidle' });
  await snap(
    page,
    'heroes',
    'Recycling Heroes',
    'Recycling Heroes shows planting and tonnage impact linked to responsible recycling. Explore the view for your organisation’s contribution.',
  );

  await page.goto(BASE + '/impact', { waitUntil: 'networkidle' });
  await snap(
    page,
    'sustainability',
    'Sustainability impact',
    'Sustainability summarises recycled weight, CO₂e avoided, and related impact for closed work. Open explanatory text or download the Impact PDF when offered.',
  );

  await page.goto(BASE + '/reports', { waitUntil: 'networkidle' });
  await snap(
    page,
    'reports',
    'Reports and exports',
    'Run Request Summary, Invoice Register, Certificate Log, Sustainability, and related client reports. Export CSV where available. Client users do not have an MRN Register — that report is for factory staff only.',
  );

  await page.goto(BASE + '/legal/terms', { waitUntil: 'networkidle' });
  await snap(
    page,
    'legal-terms',
    'Terms of Use',
    'Terms of Use are available from the footer and from the first-sign-in acceptance gate. Read them carefully before accepting policies.',
  );

  await page.goto(BASE + '/legal/privacy', { waitUntil: 'networkidle' });
  await snap(
    page,
    'legal-privacy',
    'Privacy Policy',
    'The Privacy Policy explains how personal and operational data are handled under applicable Indian law (including DPDPA). Support contact is listed on the page and in the portal footer.',
  );

  // Profile last
  await page.goto(BASE + '/profile', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.querySelectorAll('.tile-v').forEach((el) => {
      if ((el.textContent || '').includes('@')) el.textContent = 'your.name@company.com';
    });
    document.querySelectorAll('.card-ttl').forEach((el) => {
      if (/ramesh/i.test(el.textContent || '')) el.textContent = 'Client User';
    });
    document.querySelectorAll('.uav').forEach((el) => {
      el.textContent = 'CU';
    });
  });
  await snap(
    page,
    'profile',
    'Your profile and password',
    'Open your name or avatar → profile to confirm your role (Client User) and organisation. Use Change password to set a strong password (10+ characters with upper, lower, and a digit). Client accounts do not use two-factor authentication in this portal.',
  );

  const signOut = page.getByRole('button', { name: /sign out|log out|logout/i }).first();
  if (await signOut.isVisible().catch(() => false)) {
    await signOut.click();
    await page.waitForTimeout(900);
    await snap(
      page,
      'signed-out',
      'Sign out',
      'Choose Logout when you finish. You return to the sign-in screen. Policies are not re-prompted on the next visit unless Urbeno publishes an updated version.',
    );
  }

  fs.writeFileSync(
    path.join(OUT, 'manifest.json'),
    JSON.stringify({ base: BASE, steps }, null, 2),
  );
  await browser.close();
  console.log('Done.', steps.length, 'screenshots →', OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
