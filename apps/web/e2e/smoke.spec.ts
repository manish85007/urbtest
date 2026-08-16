import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('smoke', () => {
  test('admin can sign in and open masters', async ({ page }) => {
    await login(page, 'admin@urbeno.in');
    await page.getByRole('link', { name: 'Masters' }).click();
    await expect(page.getByRole('heading', { name: 'Master data' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Add client' })).toBeVisible();
  });

  test('client can sign in and open new request form', async ({ page }) => {
    await login(page, 'ramesh@techcorp.in');
    await page.getByRole('link', { name: /New request/i }).click();
    await expect(page.getByRole('heading', { name: 'New pickup request' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit request' })).toBeVisible();
  });

  test('factory user can sign in and view requests', async ({ page }) => {
    await login(page, 'blr@urbeno.in');
    await page.getByRole('link', { name: 'Requests' }).click();
    await expect(page.getByRole('heading', { name: 'Requests' })).toBeVisible();
  });
});
