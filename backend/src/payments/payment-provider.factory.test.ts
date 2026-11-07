import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mutable mock env so each test can flip the gateway flags.
const ENV = vi.hoisted(() => ({
  PAYMENT_INTEGRATION_ENABLED: 'true',
  PAYMENT_GATEWAY_PROVIDER: 'doku',
  DOKU_ENVIRONMENT: 'sandbox',
  DOKU_CLIENT_ID: 'BRN-0001-1234567890',
  DOKU_SECRET_KEY: 'SK-test-secret',
  DOKU_SANDBOX_BASE_URL: 'https://api-sandbox.doku.com',
  DOKU_PRODUCTION_BASE_URL: 'https://api.doku.com',
  DOKU_CHECKOUT_PATH: '/checkout/v1/payment',
  DOKU_STATUS_PATH_PREFIX: '/orders/v1/status',
  DOKU_NOTIFICATION_PATH: '/api/webhooks/doku',
  DOKU_CALLBACK_URL: 'https://kaffepos.my.id/settings?billing=doku-return',
  DOKU_PAYMENT_DUE_MINUTES: 60,
}));

vi.mock('../core', () => ({
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) { super(message); }
  },
  log: vi.fn(),
  serializeError: (error: unknown) => String(error),
  env: ENV,
}));

import { createPaymentProvider, getActivePaymentProviderName } from './payment-provider.factory';
import { DokuPaymentProvider } from './providers/doku.provider';
import { DisabledPaymentProvider } from './providers/disabled.provider';

describe('payment-provider factory', () => {
  beforeEach(() => {
    ENV.PAYMENT_INTEGRATION_ENABLED = 'true';
    ENV.PAYMENT_GATEWAY_PROVIDER = 'doku';
  });

  it('builds the DOKU provider for the doku name', () => {
    expect(createPaymentProvider('doku')).toBeInstanceOf(DokuPaymentProvider);
  });

  it('builds the disabled provider for the disabled name', () => {
    expect(createPaymentProvider('disabled')).toBeInstanceOf(DisabledPaymentProvider);
  });

  it('forces the disabled provider when PAYMENT_INTEGRATION_ENABLED is false', () => {
    ENV.PAYMENT_INTEGRATION_ENABLED = 'false';
    expect(getActivePaymentProviderName()).toBe('disabled');
    expect(createPaymentProvider()).toBeInstanceOf(DisabledPaymentProvider);
  });

  it('uses the configured DOKU gateway when integration is enabled', () => {
    ENV.PAYMENT_INTEGRATION_ENABLED = 'true';
    ENV.PAYMENT_GATEWAY_PROVIDER = 'doku';
    expect(getActivePaymentProviderName()).toBe('doku');
    expect(createPaymentProvider()).toBeInstanceOf(DokuPaymentProvider);
  });
});
