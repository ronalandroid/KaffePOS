import { defineConfig, devices } from '@playwright/test';

/**
 * Local-only E2E config. Not wired into `npm test`/CI: it needs a local Postgres
 * plus the backend + vite dev server that scripts/e2e-local.mjs orchestrates.
 * Run via: npm run test:e2e:local
 */
export default defineConfig({
  testDir: '.',
  timeout: 45_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_WEB_URL || 'http://localhost:4180',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
});
