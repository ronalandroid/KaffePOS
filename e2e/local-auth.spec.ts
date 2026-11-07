import { test, expect } from '@playwright/test';

/**
 * Critical-flow browser E2E against the locally orchestrated stack
 * (fresh Postgres + backend dist + vite dev server — see scripts/e2e-local.mjs).
 * The test account is created and email-verified by the orchestrator.
 */
const EMAIL = process.env.E2E_EMAIL || 'e2e-local@test.local';
const PASSWORD = process.env.E2E_PASSWORD || 'E2eLocal123!';

test('landing hero loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1').first()).toBeVisible();
});

test('user can log in through the UI and reach the app shell', async ({ page }) => {
  await page.goto('/auth');

  // Make sure the form is in login mode (the page shows Login/Daftar toggles).
  const loginTab = page.getByRole('button', { name: 'Login', exact: true });
  if (await loginTab.isVisible().catch(() => false)) {
    await loginTab.click();
  }

  await page.locator('#auth-email').fill(EMAIL);
  await page.locator('#auth-pass').fill(PASSWORD);
  await page.getByRole('button', { name: /^Masuk$/ }).click();

  // Successful login lands on the authenticated shell with the main navigation.
  await expect(
    page.getByRole('navigation', { name: 'Navigasi utama' }).first(),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page).not.toHaveURL(/\/(auth|login)/);
});

test('wrong password stays on the auth page with an error', async ({ page }) => {
  await page.goto('/auth');
  const loginTab = page.getByRole('button', { name: 'Login', exact: true });
  if (await loginTab.isVisible().catch(() => false)) {
    await loginTab.click();
  }

  await page.locator('#auth-email').fill(EMAIL);
  await page.locator('#auth-pass').fill('SalahTotal999!');
  await page.getByRole('button', { name: /^Masuk$/ }).click();

  // The app normalises /auth to a per-mode path (/login), so accept both.
  await expect(page).toHaveURL(/\/(auth|login)/);
  await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 15_000 });
});
