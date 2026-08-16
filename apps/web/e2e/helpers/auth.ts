import { expect, type Page } from '@playwright/test';

export async function login(page: Page, email: string, password = 'demo') {
  await page.context().clearCookies();
  await page.goto('/');
  await expect(page.getByLabel('Email')).toBeVisible({ timeout: 15_000 });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible({ timeout: 15_000 });
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible({ timeout: 10_000 });
  await page.context().clearCookies();
}
