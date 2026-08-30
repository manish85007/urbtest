/**
 * Shared Playwright helpers for role training captures.
 * Credentials are used only to sign in — never shown in screenshots.
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

export { chromium };

export function roleOutDir(role) {
  const dir = path.join(__dirname, role, 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function clearShots(outDir) {
  for (const f of fs.readdirSync(outDir)) {
    if (/\.(png|jpg|json)$/.test(f)) fs.unlinkSync(path.join(outDir, f));
  }
}

export async function acceptPoliciesIfNeeded(page) {
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

export async function signIn(page, base, email, password, { alreadyOnLogin = false } = {}) {
  if (!alreadyOnLogin) {
    await page.goto(base + '/', { waitUntil: 'networkidle' });
  }
  const emailBox = page.locator('input[type="email"], input[name="email"], input[autocomplete="username"]').first();
  await emailBox.waitFor({ state: 'visible', timeout: 20000 });
  await emailBox.fill('');
  await emailBox.fill(email);
  const passBox = page.locator('input[type="password"]').first();
  await passBox.fill(password);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.waitForTimeout(1800);
  await acceptPoliciesIfNeeded(page);
  const mfa = page.getByText(/six-digit|authenticator|verification code/i);
  if (await mfa.isVisible({ timeout: 1500 }).catch(() => false)) {
    console.warn('MFA prompt visible — training capture may be limited for this account');
  }
}

export function makeSnapper(outDir, steps) {
  return async function snap(page, id, title, howTo = '', tips = '') {
    const file = `${String(steps.length + 1).padStart(2, '0')}-${id}.png`;
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(outDir, file), fullPage: true });
    steps.push({ id, title, howTo, tips, file });
    console.log('  captured', file, '—', title);
  };
}

export async function redactProfilePii(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.tile-v').forEach((el) => {
      if ((el.textContent || '').includes('@')) el.textContent = 'your.name@company.com';
    });
    document.querySelectorAll('.card-ttl').forEach((el) => {
      const t = el.textContent || '';
      if (/@|kumar|jain|babu|ramesh|manish|suresh/i.test(t) && t.length < 40) {
        el.textContent = 'Your Name';
      }
    });
    document.querySelectorAll('.uav').forEach((el) => {
      el.textContent = 'YU';
    });
  });
}

export async function withBrowser(fn) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  try {
    await fn(page);
  } finally {
    await browser.close();
  }
}

export function writeManifest(outDir, data) {
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(data, null, 2));
}
