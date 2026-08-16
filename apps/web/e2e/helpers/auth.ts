import { expect, type Page } from '@playwright/test';

export async function login(page: Page, email: string, password = 'demo') {
  await page.context().clearCookies();
  await page.goto('/');
  await expect(page.getByLabel('Email')).toBeVisible({ timeout: 15_000 });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible({ timeout: 15_000 });
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible({ timeout: 10_000 });
  await page.context().clearCookies();
}
