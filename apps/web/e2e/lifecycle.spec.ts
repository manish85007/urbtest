import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { login, logout } from './helpers/auth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const photo = path.join(__dirname, 'fixtures', 'sample.jpg');
const pdf = path.join(__dirname, 'fixtures', 'sample.pdf');

test.describe('full lifecycle', () => {
  test('client → admin → factory walk stages 1–9', async ({ page }) => {
    const uniq = Date.now().toString().slice(-6);

    // Stage 1 — client raises request
    await login(page, 'ramesh@techcorp.in');
    await page.getByRole('link', { name: /New request/i }).click();
    await expect(page.getByRole('heading', { name: 'New Collection Request' })).toBeVisible();
    await page.getByLabel('Pickup Location').fill(`E2E bay ${uniq}`);
    await page.getByLabel('Approx. Weight (kg)').fill('75');
    await page.getByLabel('Approx. Quantity (units)').fill('12');
    await page.getByPlaceholder('Item description').fill(`E2E mixed waste ${uniq}`);
    await page.getByLabel('Notes').fill(`Playwright lifecycle ${uniq}`);
    await page.getByRole('button', { name: 'Submit Request' }).click();
    await expect(page.getByRole('heading', { name: /REQ-/ })).toBeVisible({ timeout: 15_000 });
    const heading = await page.getByRole('heading', { level: 1 }).textContent();
    const submissionId = heading?.match(/REQ-\d+/)?.[0];
    expect(submissionId).toBeTruthy();

    await logout(page);

    // Stage 2 — admin acknowledges
    await login(page, 'admin@urbeno.in');
    await page.goto(`/requests/${submissionId}`);
    await page.getByRole('button', { name: 'Acknowledge Request' }).click();
    await page.locator('.modal').getByRole('button', { name: 'Acknowledge' }).click();
    await expect(page.getByText('Request acknowledged.')).toBeVisible({ timeout: 10_000 });

    // Stage 3 — assign vehicle
    await page.getByRole('button', { name: 'Assign Vehicle' }).click();
    await page.getByLabel('Registration').fill(`KA-E2E-${uniq}`);
    await page.getByLabel('Driver name').fill('E2E Driver');
    await page.getByLabel('Driver phone').fill('9900112233');
    await page.locator('.modal').getByRole('button', { name: 'Assign vehicle' }).click();
    await expect(page.getByText('Vehicle assigned.')).toBeVisible({ timeout: 10_000 });

    // Stage 4 — weighment with photos
    await page.getByRole('button', { name: /Weigh/ }).click();
    const fileInputs = page.locator('.modal input[type="file"]');
    await fileInputs.nth(0).setInputFiles(photo);
    await fileInputs.nth(1).setInputFiles(photo);
    await expect(page.getByText(/seed|sample|\.jpg/i).first()).toBeVisible({ timeout: 15_000 });
    await page.getByLabel('Gross (kg)').fill('5200');
    await page.getByLabel('Tare (kg)').fill('5125');
    await page.getByLabel('Slip no.').fill(`WB-E2E-${uniq}`);
    await page.locator('.modal').getByRole('button', { name: 'Record weighment' }).click();
    await expect(page.getByText('Weighment recorded.')).toBeVisible({ timeout: 15_000 });

    // Stage 5 — raise invoice
    await page.getByRole('button', { name: 'Raise Invoice' }).click();
    await page.getByLabel('Invoice no.').fill(`INV-E2E-${uniq}`);
    await page.getByLabel('Taxable amount (₹)').fill('8500');
    await page.getByLabel('E-way bill no.').fill(`EWB-E2E-${uniq}`);
    await page.locator('.modal').getByRole('button', { name: 'Create invoice' }).click();
    await expect(page.getByText('Invoice created.')).toBeVisible({ timeout: 10_000 });

    await logout(page);

    // Stage 5–6 — factory MRN + recycling
    await login(page, 'blr@urbeno.in');
    await page.goto(`/requests/${submissionId}`);
    await page.getByRole('button', { name: 'Create MRN' }).click();
    await page.locator('.modal').getByRole('button', { name: 'Record goods receipt (MRN)' }).click();
    await expect(page.getByText('MRN created.')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Process & Issue Form 6' }).click();
    await expect(page.locator('#recy-form select').nth(1).locator('option')).not.toHaveCount(0);
    await page.locator('.modal').getByRole('button', { name: 'Issue Form 6' }).click();
    await expect(page.getByText('Recycling recorded.')).toBeVisible({ timeout: 15_000 });

    await logout(page);

    // Stage 7–9 — admin certificate, payment, close
    await login(page, 'admin@urbeno.in');
    await page.goto(`/requests/${submissionId}`);

    await page.locator('.inv-panel').getByRole('button', { name: 'Upload Certificate' }).click();
    await page.locator('.modal input[type="file"]').first().setInputFiles(pdf);
    await expect(page.locator('.modal').getByText(/sample|\.pdf/i).first()).toBeVisible({ timeout: 15_000 });
    await page.getByLabel('Certificate no.').fill(`DCOD-E2E-${uniq}`);
    await page.locator('.modal').getByRole('button', { name: /Upload.*certificate/i }).click();
    await expect(page.getByText('Certificate uploaded.')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: '+ Record Payment' }).click();
    await page.getByLabel('UTR / reference').fill(`UTR-E2E-${uniq}`);
    await page.locator('.modal').getByRole('button', { name: 'Record payment' }).click();
    await expect(page.getByText('Payment recorded.')).toBeVisible({ timeout: 10_000 });

    await logout(page);

    // Stage 9 — client acknowledges closure
    await login(page, 'ramesh@techcorp.in');
    await page.goto(`/requests/${submissionId}`);
    await page.getByRole('button', { name: 'Review & Close' }).click();
    await page.locator('.modal').getByRole('button', { name: 'Acknowledge closure' }).click();
    await expect(page.getByText('Invoice closed.')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.ok-msg.sm')).toContainText('Closed');
  });

  test('reject and client resubmit loop', async ({ page }) => {
    const uniq = Date.now().toString().slice(-6);

    await login(page, 'ramesh@techcorp.in');
    await page.getByRole('link', { name: /New request/i }).click();
    await page.getByLabel('Pickup Location').fill(`Reject test ${uniq}`);
    await page.getByLabel('Approx. Weight (kg)').fill('20');
    await page.getByLabel('Approx. Quantity (units)').fill('4');
    await page.getByPlaceholder('Item description').fill(`Reject mixed waste ${uniq}`);
    await page.getByRole('button', { name: 'Submit Request' }).click();
    await expect(page.getByRole('heading', { name: /REQ-/ })).toBeVisible();
    const submissionId = (await page.getByRole('heading', { level: 1 }).textContent())?.match(/REQ-\d+/)?.[0];
    expect(submissionId).toBeTruthy();

    await logout(page);
    await login(page, 'admin@urbeno.in');
    await page.goto(`/requests/${submissionId}`);
    await page.getByRole('button', { name: 'Request changes' }).click();
    await page.getByLabel('Note to client').fill('Please update pickup location details.');
    await page.locator('.modal').getByRole('button', { name: 'Send back to client' }).click();
    await expect(page.getByText('Changes requested from client.')).toBeVisible();

    await logout(page);
    await login(page, 'ramesh@techcorp.in');
    await page.goto(`/requests/${submissionId}`);
    await expect(page.getByText('Please update pickup location details.')).toBeVisible();
    await page.getByLabel('Pickup Location').fill(`Updated bay ${uniq}`);
    await page.locator('.modal').getByRole('button', { name: 'Save and resubmit' }).click();
    await expect(page.getByText('Request updated and sent back to Urbeno.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Acknowledge' })).not.toBeVisible();
  });
});
