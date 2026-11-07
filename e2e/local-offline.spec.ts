import { test, expect } from '@playwright/test';

/**
 * Offline-access proof against the PRODUCTION build (service worker only
 * registers in prod). Orchestrated by scripts/e2e-offline-local.mjs:
 * fresh DB + backend + `vite preview` of a build with the API URL baked in.
 *
 * Flow: login online → reload so the service worker controls the page and
 * runtime-caches the app chunks → cut the network → reload → the shell must
 * still boot from cache with the stored session intact.
 */
const EMAIL = process.env.E2E_EMAIL || 'e2e-local@test.local';
const PASSWORD = process.env.E2E_PASSWORD || 'E2eLocal123!';

test('app boots and stays usable with the network fully offline', async ({ page, context }) => {
  await page.goto('/auth');
  const loginTab = page.getByRole('button', { name: 'Login', exact: true });
  if (await loginTab.isVisible().catch(() => false)) {
    await loginTab.click();
  }
  await page.locator('#auth-email').fill(EMAIL);
  await page.locator('#auth-pass').fill(PASSWORD);
  await page.getByRole('button', { name: /^Masuk$/ }).click();
  await expect(page.getByRole('navigation', { name: 'Navigasi utama' }).first()).toBeVisible({ timeout: 20_000 });

  // First load registers the SW; a reload puts the page under its control and
  // lets the runtime cache capture every chunk the shell needs.
  await page.waitForFunction(() => navigator.serviceWorker?.ready.then(() => true), null, { timeout: 15_000 });
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Navigasi utama' }).first()).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 15_000 });

  // Cut the network entirely — reload must be served from the SW cache and the
  // cached session must survive (AuthContext keeps it on network errors).
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Navigasi utama' }).first()).toBeVisible({ timeout: 25_000 });
  await expect(page).not.toHaveURL(/\/(auth|login)/);

  await context.setOffline(false);
});
