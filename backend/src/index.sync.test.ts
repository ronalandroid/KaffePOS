import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const indexSource = readFileSync(join(process.cwd(), 'backend/src/index.ts'), 'utf8');

describe('backend modular bootstrap sync', () => {
  const routeModules = [
    'health',
    'webhooks',
    'auth',
    'stores',
    'menu',
    'inventory',
    'finance',
    'kitchen',
    'transactions',
    'loyalty',
    'challenges',
    'subscriptions',
    'admin',
    'misc',
    'importLocalStorage',
  ];

  it('keeps all extracted route modules imported and mounted from bootstrap', () => {
    for (const moduleName of routeModules) {
      expect(indexSource).toContain(`./routes/${moduleName}`);
    }

    expect(indexSource).toContain('app.use(healthRouter)');
    expect(indexSource).toContain('app.use(webhooksRouter)');
    expect(indexSource).toContain('app.use(authRouter)');
    expect(indexSource).toContain("app.use('/api', authenticate)");
    expect(indexSource).toContain('app.use(storesRouter)');
    expect(indexSource).toContain('app.use(menuRouter)');
    expect(indexSource).toContain('app.use(inventoryRouter)');
    expect(indexSource).toContain('app.use(financeRouter)');
    expect(indexSource).toContain('app.use(kitchenRouter)');
    expect(indexSource).toContain('app.use(transactionsRouter)');
    expect(indexSource).toContain('app.use(loyaltyRouter)');
    expect(indexSource).toContain('app.use(challengesRouter)');
    expect(indexSource).toContain('app.use(subscriptionsRouter)');
    expect(indexSource).toContain('app.use(adminRouter)');
    expect(indexSource).toContain('app.use(miscRouter)');
    expect(indexSource).toContain('app.use(importLocalStorageRouter)');
    expect(indexSource).not.toMatch(/app\.(get|post|put|patch|delete)\s*\(/);
  });

  it('keeps a versioned API alias for future breaking-change safety', () => {
    expect(indexSource).toContain("app.use('/api/v1', rewriteApiV1Request, webhooksRouter, authRouter)");
    expect(indexSource).toContain("'/api/v1',\n  authenticate,\n  rewriteApiV1Request");
    expect(indexSource).toContain('rewriteApiV1Request');
  });

  it('uses the shared core database pool instead of creating a second pool', () => {
    expect(indexSource).toContain("import { pool } from './core/db';");
    expect(indexSource).not.toMatch(/new\s+Pool\s*\(/);
    expect(indexSource).not.toContain("import { Pool,");
  });

  it('uses the shared core ApiError and delegates to the centralized error handler', () => {
    expect(indexSource).toContain("import { ApiError, log, serializeError } from './core/errors';");
    expect(indexSource).not.toMatch(/class\s+ApiError\s+extends\s+Error/);
    // Error handling is delegated to the single centralized handler (structured codes + Sentry)
    // instead of an inline duplicate; the inline `error instanceof ApiError` block was removed.
    expect(indexSource).toContain("import { errorHandler } from './core/errorHandler';");
    expect(indexSource).toContain('app.use(errorHandler)');
  });

  it('uses the shared core env parser instead of keeping a second bootstrap schema', () => {
    expect(indexSource).toContain("import { env } from './core/env';");
    expect(indexSource).not.toMatch(/const\s+envSchema\s*=\s*z\.object/);
    expect(indexSource).not.toMatch(/const\s+env\s*=\s*envSchema\.parse/);
  });
});
