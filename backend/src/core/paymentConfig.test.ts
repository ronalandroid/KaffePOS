import { afterEach, describe, expect, it, vi } from 'vitest';

const PAYMENT_KEYS = [
  'PAYMENT_GATEWAY_PROVIDER',
  'PAYMENT_INTEGRATION_ENABLED',
  'SUBSCRIPTION_PAYMENT_MODE',
  'MAYAR_ENVIRONMENT',
  'MAYAR_API_KEY',
  'MAYAR_WEBHOOK_TOKEN',
  'MAYAR_CALLBACK_URL',
  'API_BASE_URL',
] as const;

const original = Object.fromEntries(PAYMENT_KEYS.map((key) => [key, process.env[key]]));

async function loadWithEnv(vars: Partial<Record<(typeof PAYMENT_KEYS)[number], string>>) {
  vi.resetModules();
  for (const key of PAYMENT_KEYS) {
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const envModule = await import('./env');
  const billing = await import('./billing');
  warn.mockRestore();
  return { ...envModule, ...billing };
}

afterEach(() => {
  for (const key of PAYMENT_KEYS) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
  vi.resetModules();
});

describe('Mayar payment configuration', () => {
  it('reads legacy DOKU settings as Mayar so existing deployments still boot', async () => {
    const mod = await loadWithEnv({ PAYMENT_GATEWAY_PROVIDER: 'doku', SUBSCRIPTION_PAYMENT_MODE: 'doku_sandbox' });
    expect(mod.env.PAYMENT_GATEWAY_PROVIDER).toBe('mayar');
    expect(mod.env.SUBSCRIPTION_PAYMENT_MODE).toBe('mayar_sandbox');
    expect(mod.envDeprecations).toEqual(expect.arrayContaining([
      expect.stringContaining('PAYMENT_GATEWAY_PROVIDER=doku'),
      expect.stringContaining('SUBSCRIPTION_PAYMENT_MODE=doku_sandbox'),
    ]));
  });

  it('defaults sandbox calls to the current Mayar sandbox host', async () => {
    const mod = await loadWithEnv({});
    expect(mod.env.PAYMENT_GATEWAY_PROVIDER).toBe('mayar');
    expect(mod.env.MAYAR_SANDBOX_BASE_URL).toBe('https://api.mayar.io');
    expect(mod.env.MAYAR_PRODUCTION_BASE_URL).toBe('https://api.mayar.id');
  });

  it('needs both the API key and the webhook token before online payment opens', async () => {
    const keyOnly = await loadWithEnv({ MAYAR_API_KEY: 'key', SUBSCRIPTION_PAYMENT_MODE: 'auto' });
    expect(keyOnly.isMayarConfigured()).toBe(false);
    expect(keyOnly.resolveSubscriptionPaymentConfig()).toMatchObject({ mode: 'manual', onlinePaymentAvailable: false });

    const both = await loadWithEnv({ MAYAR_API_KEY: 'key', MAYAR_WEBHOOK_TOKEN: 'token', SUBSCRIPTION_PAYMENT_MODE: 'auto' });
    expect(both.isMayarConfigured()).toBe(true);
    expect(both.resolveSubscriptionPaymentConfig()).toMatchObject({
      mode: 'mayar_sandbox',
      provider: 'mayar',
      onlinePaymentAvailable: true,
      commerciallyReady: false,
    });
  });

  it('is commercially ready only in Mayar production mode', async () => {
    const mod = await loadWithEnv({
      MAYAR_ENVIRONMENT: 'production',
      MAYAR_API_KEY: 'key',
      MAYAR_WEBHOOK_TOKEN: 'token',
      SUBSCRIPTION_PAYMENT_MODE: 'mayar_production',
    });
    expect(mod.resolveSubscriptionPaymentConfig()).toMatchObject({
      mode: 'mayar_production',
      environment: 'production',
      onlinePaymentAvailable: true,
      commerciallyReady: true,
    });
  });

  it('falls back to manual activation when sandbox mode is requested on a production key', async () => {
    const mod = await loadWithEnv({
      MAYAR_ENVIRONMENT: 'production',
      MAYAR_API_KEY: 'key',
      MAYAR_WEBHOOK_TOKEN: 'token',
      SUBSCRIPTION_PAYMENT_MODE: 'mayar_sandbox',
    });
    expect(mod.resolveSubscriptionPaymentConfig()).toMatchObject({ mode: 'manual', onlinePaymentAvailable: false });
  });

  it('builds the webhook URL from API_BASE_URL unless MAYAR_CALLBACK_URL is set', async () => {
    const derived = await loadWithEnv({ API_BASE_URL: 'https://api.kaffepos.my.id/' });
    expect(derived.getMayarWebhookUrl()).toBe('https://api.kaffepos.my.id/api/webhooks/mayar');

    const explicit = await loadWithEnv({ MAYAR_CALLBACK_URL: 'https://staging-api.kaffepos.my.id/api/webhooks/mayar' });
    expect(explicit.getMayarWebhookUrl()).toBe('https://staging-api.kaffepos.my.id/api/webhooks/mayar');
  });
});
