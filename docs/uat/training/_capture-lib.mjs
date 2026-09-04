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

async function readDemoCodeFromPage(page) {
  const demoLine = page.getByText(/Demo code:/i);
  if (await demoLine.isVisible({ timeout: 2000 }).catch(() => false)) {
    const line = (await demoLine.innerText()) || '';
    const m = line.match(/(\d{6})/);
    if (m) return m[1];
    const span = demoLine.locator('span.mono').first();
    if (await span.isVisible().catch(() => false)) {
      return ((await span.textContent()) || '').replace(/\D/g, '').slice(0, 6);
    }
  }
  const body = await page.locator('body').innerText().catch(() => '');
  const m = String(body).match(/Demo code:\s*(\d{6})/i);
  return m ? m[1] : '';
}

/** Complete forced MFA enrolment on UAT using email OTP when a demo code is shown. */
export async function enrolMfaIfNeeded(page) {
  const heading = page.getByRole('heading', { name: /two-factor authentication|set up two-factor/i });
  const gateText = page.getByText(/grace period has ended|enrol now to continue/i);
  const onGate =
    (await heading.isVisible({ timeout: 2500 }).catch(() => false)) ||
    (await gateText.isVisible({ timeout: 500 }).catch(() => false));
  if (!onGate) return false;

  const emailBtn = page.getByRole('button', { name: /email otp|use email otp/i });
  await emailBtn.waitFor({ state: 'visible', timeout: 5000 });
  const respPromise = page
    .waitForResponse(
      (r) => r.url().includes('/auth/mfa/start') && r.request().method() === 'POST',
      { timeout: 15000 },
    )
    .catch(() => null);
  await emailBtn.click();
  const resp = await respPromise;
  let code = '';
  if (resp) {
    try {
      const json = await resp.json();
      if (json?.demoCode) code = String(json.demoCode);
    } catch {
      /* ignore */
    }
  }
  await page.waitForTimeout(800);
  if (!code) code = await readDemoCodeFromPage(page);
  if (!code) {
    console.warn('MFA enrol: email OTP started but demo code not shown (is E2E_TEST / ALLOW_DEMO_OTP set?)');
    return false;
  }

  await page.locator('#mfa-force-email').fill(code);
  await page.getByRole('button', { name: /confirm and continue/i }).click();
  await page.waitForTimeout(1500);
  const still = await heading.isVisible({ timeout: 800 }).catch(() => false);
  if (still) {
    console.warn('MFA enrol: still on gate after confirm');
    return false;
  }
  return true;
}

/** Complete login-time MFA / 90-day email OTP when the UI shows a demo code. */
export async function completeLoginOtpIfNeeded(page) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const mfaInput = page.locator('#li-mfa, input[autocomplete="one-time-code"]').first();
    const otpPrompt = page.getByText(/six-digit|authenticator|emailed you|email verification/i);
    const needs =
      (await mfaInput.isVisible({ timeout: 1200 }).catch(() => false)) ||
      (await otpPrompt.isVisible({ timeout: 400 }).catch(() => false));
    if (!needs) return false;

    let code = await readDemoCodeFromPage(page);
    if (!code) {
      console.warn('Login OTP prompt visible but no demo code — capture may be limited');
      return false;
    }
    if (await mfaInput.isVisible().catch(() => false)) {
      await mfaInput.fill(code);
    } else {
      const anyOtp = page.locator('input[inputmode="numeric"]').last();
      await anyOtp.fill(code);
    }
    const signBtn = page.getByRole('button', { name: /sign in|log in|login|verify|continue/i }).first();
    await signBtn.click({ force: true });
    await page.waitForTimeout(1600);
  }
  return true;
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

  // Solve arithmetic login captcha when present (UAT/production challenge mode).
  const captchaLabel = page.locator('label[for="li-captcha"]');
  if (await captchaLabel.isVisible({ timeout: 2500 }).catch(() => false)) {
    const q = ((await captchaLabel.textContent()) || '').trim();
    const m = q.match(/(\d+)\s*([+\-×x*])\s*(\d+)/i);
    if (m) {
      const a = Number(m[1]);
      const op = m[2];
      const b = Number(m[3]);
      let ans = a + b;
      if (op === '-' ) ans = a - b;
      if (op === '×' || op === 'x' || op === '*') ans = a * b;
      await page.locator('#li-captcha').fill(String(ans));
      await page.waitForTimeout(200);
    }
  }

  const signBtn = page.getByRole('button', { name: /sign in|log in|login/i });
  await signBtn.waitFor({ state: 'visible', timeout: 10000 });
  // Captcha may keep the button disabled briefly until onChange fires.
  for (let i = 0; i < 20; i++) {
    if (await signBtn.isEnabled().catch(() => false)) break;
    await page.waitForTimeout(150);
  }
  await signBtn.click({ force: true });
  await page.waitForTimeout(1800);
  await completeLoginOtpIfNeeded(page);
  await acceptPoliciesIfNeeded(page);
  await enrolMfaIfNeeded(page);
  // Password must-reset gate — skip changing password during training captures.
  const mustReset = page.getByText(/set a new password|must change|change your password/i);
  if (await mustReset.isVisible({ timeout: 1500 }).catch(() => false)) {
    console.warn('Password reset gate visible — training capture may be limited for this account');
  }
  const stillMfa = page.getByText(/grace period has ended|set up two-factor/i);
  if (await stillMfa.isVisible({ timeout: 800 }).catch(() => false)) {
    console.warn('MFA enrol gate still visible after sign-in helpers');
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
  const browser = await chromium.launch({
    headless: true,
    // Prefer installed Google Chrome so captures work without `npx playwright install`.
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
  });
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

/** Shared e2e fixtures for weighment / MRN / CoD uploads during training captures. */
export function fixturePaths() {
  const fixtures = path.join(root, 'apps/web/e2e/fixtures');
  return {
    photo: path.join(fixtures, 'sample.jpg'),
    pdf: path.join(fixtures, 'sample.pdf'),
  };
}

export async function logout(page, base) {
  // Training captures often leave a modal open — dismiss before Logout.
  for (let i = 0; i < 3; i++) {
    const modal = page.locator('.modal-bg, .modal').first();
    if (!(await modal.isVisible({ timeout: 400 }).catch(() => false))) break;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  }
  const btn = page.getByRole('button', { name: /log\s*out|sign\s*out/i }).first();
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btn.click({ force: true });
    await page.waitForTimeout(900);
    return;
  }
  await page.goto(base + '/', { waitUntil: 'networkidle' }).catch(() => {});
}

export async function fillPhone(page, labelOrLocator, digits) {
  const field =
    typeof labelOrLocator === 'string'
      ? page.getByLabel(new RegExp(labelOrLocator, 'i')).first()
      : labelOrLocator;
  if (await field.isVisible({ timeout: 2000 }).catch(() => false)) {
    await field.fill(digits);
    return;
  }
  const phone = page.locator('input[inputmode="tel"], input[type="tel"]').first();
  if (await phone.isVisible().catch(() => false)) await phone.fill(digits);
}

export async function waitToast(page, text, timeout = 15000) {
  await page.getByText(text).first().waitFor({ state: 'visible', timeout }).catch(() => {});
}
