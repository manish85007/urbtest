import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('smoke', () => {
  test('admin can sign in and open masters', async ({ page }) => {
    await login(page, 'admin@urbeno.in');
    await page.getByRole('link', { name: 'Masters' }).click();
    await expect(page.getByRole('heading', { name: 'Master Data' })).toBeVisible();
    await expect(page.getByRole('button', { name: /New Client/ })).toBeVisible();
  });

  test('client can sign in and open new request form', async ({ page }) => {
    await login(page, 'ramesh@techcorp.in');
    await page.getByRole('link', { name: /New request/i }).click();
    await expect(page.getByRole('heading', { name: 'New Collection Request' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit Request' })).toBeVisible();
  });

  test('admin can open reports', async ({ page }) => {
    await login(page, 'admin@urbeno.in');
    await page.getByRole('link', { name: 'Reports' }).click();
    await expect(page.locator('.h1', { hasText: 'Reports' })).toBeVisible();
    await expect(page.getByText('Reporting Period')).toBeVisible();
    await expect(page.getByRole('button', { name: /Export CSV/ })).toBeVisible();
  });

  test('admin can open recycle heroes', async ({ page }) => {
    await login(page, 'admin@urbeno.in');
    await page.getByRole('link', { name: 'Recycle Heroes' }).click();
    await expect(page.locator('.h1', { hasText: 'Recycle Heroes' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Record Planting/ })).toBeVisible();
  });

  test('factory user can sign in and view requests', async ({ page }) => {
    await login(page, 'blr@urbeno.in');
    await page.getByRole('link', { name: 'Requests' }).click();
    await expect(page.getByRole('heading', { name: 'Requests' })).toBeVisible();
  });
});
