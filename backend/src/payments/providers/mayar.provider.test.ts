import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';

const MAYAR_ENV = vi.hoisted(() => ({
  MAYAR_ENVIRONMENT: 'sandbox',
  MAYAR_API_KEY: 'mayar-test-api-key-jwt',
  MAYAR_WEBHOOK_TOKEN: 'mayar-webhook-secret-token',
  MAYAR_SANDBOX_BASE_URL: 'https://api.mayar.club',
  MAYAR_PRODUCTION_BASE_URL: 'https://api.mayar.id',
  MAYAR_CREATE_PAYMENT_PATH: '/hl/v2/payments/create',
  MAYAR_STATUS_PATH_PREFIX: '/hl/v2/payments',
  MAYAR_WEBHOOK_PATH: '/api/webhooks/mayar',
  MAYAR_REDIRECT_URL: 'https://kaffepos.my.id/settings?billing=mayar-return',
  MAYAR_PAYMENT_DUE_MINUTES: 60,
}));

vi.mock('../../core', () => ({
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
  log: vi.fn(),
  serializeError: (error: unknown) => String(error),
  env: MAYAR_ENV,
}));

import { MayarPaymentProvider } from './mayar.provider';

describe('MayarPaymentProvider', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('creates a single payment request via Mayar API v2 and returns paymentUrl + providerReference', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};
    let capturedBody = '';

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init) => {
        capturedUrl = String(url);
        capturedHeaders = init?.headers as Record<string, string>;
        capturedBody = String(init?.body);
        return new Response(
          JSON.stringify({
            statusCode: 200,
            messages: 'success',
            data: {
              id: '6f8c19ff-5b97-4792-aa89-d2a12797b356',
              transactionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              link: 'https://testingmayar.myr.id/pl/rqp9x2k7m3a',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    const provider = new MayarPaymentProvider();
    const result = await provider.createPayment({
      merchantOrderId: 'SUB-101',
      amount: 129000,
      productDetails: 'Langganan KaffePOS Signature',
      customerName: 'Budi Santoso',
      customerEmail: 'budi@example.com',
      customerPhone: '081234567890',
      paymentMethod: 'qris',
    });

    expect(capturedUrl).toBe('https://api.mayar.club/hl/v2/payments/create');
    expect(capturedHeaders.Authorization).toBe(`Bearer ${MAYAR_ENV.MAYAR_API_KEY}`);
    const parsed = JSON.parse(capturedBody);
    expect(parsed.amount).toBe(129000);
    expect(parsed.email).toBe('budi@example.com');
    expect(parsed.description).toContain('[SUB-101]');
    expect(parsed.extraData.merchantOrderId).toBe('SUB-101');
    expect(result.provider).toBe('mayar');
    expect(result.paymentUrl).toBe('https://testingmayar.myr.id/pl/rqp9x2k7m3a');
    expect(result.providerReference).toBe('6f8c19ff-5b97-4792-aa89-d2a12797b356');
    expect(result.internalStatus).toBe('pending');
  });

  it('retries without redirectUrl if Mayar API v2 rejects redirectUrl on payment requests', async () => {
    const calls: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        calls.push(body);
        if (calls.length === 1) {
          return new Response(
            JSON.stringify({
              statusCode: 400,
              messages: 'redirectUrl is not supported on payment requests and was not saved',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({
            statusCode: 200,
            messages: 'success',
            data: {
              id: 'mayar-id-2',
              link: 'https://testingmayar.myr.id/pl/retry-ok',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    const provider = new MayarPaymentProvider();
    const result = await provider.createPayment({
      merchantOrderId: 'SUB-102',
      amount: 49000,
      productDetails: 'Langganan Kopi Susu',
    });

    expect(calls).toHaveLength(2);
    expect(calls[0].redirectUrl).toBeDefined();
    expect(calls[1].redirectUrl).toBeUndefined();
    expect(result.paymentUrl).toBe('https://testingmayar.myr.id/pl/retry-ok');
  });

  it('verifies a payment.received webhook with x-callback-token and maps status to paid', async () => {
    const provider = new MayarPaymentProvider();
    const body = {
      event: { received: 'payment.received' },
      data: {
        id: 'webhook-evt-1',
        productId: '6f8c19ff-5b97-4792-aa89-d2a12797b356',
        productName: 'Langganan KaffePOS Signature [SUB-101]',
        status: true,
        amount: 129000,
        customerEmail: 'budi@example.com',
        updatedAt: '2026-11-08T00:00:00.000Z',
      },
    };

    const result = await provider.verifyCallback({
      body,
      rawBody: JSON.stringify(body),
      headers: { 'x-callback-token': MAYAR_ENV.MAYAR_WEBHOOK_TOKEN },
    });

    expect(result.signatureValid).toBe(true);
    expect(result.internalStatus).toBe('paid');
    expect(result.merchantOrderId).toBe('SUB-101');
    expect(result.providerReference).toBe('6f8c19ff-5b97-4792-aa89-d2a12797b356');
    expect(result.amount).toBe(129000);
  });

  it('also accepts HMAC-SHA256 webhook signature in x-mayar-signature', async () => {
    const provider = new MayarPaymentProvider();
    const body = {
      event: 'payment.received',
      data: {
        id: 'tx-1',
        amount: 49000,
        extraData: { merchantOrderId: 'KAF-ORDER-1' },
      },
    };
    const rawBody = JSON.stringify(body);
    const sig = createHmac('sha256', MAYAR_ENV.MAYAR_WEBHOOK_TOKEN).update(rawBody, 'utf8').digest('hex');

    const result = await provider.verifyCallback({
      body,
      rawBody,
      headers: { 'x-mayar-signature': sig },
    });

    expect(result.signatureValid).toBe(true);
    expect(result.internalStatus).toBe('paid');
    expect(result.merchantOrderId).toBe('KAF-ORDER-1');
  });

  it('rejects a webhook with an invalid token', async () => {
    const provider = new MayarPaymentProvider();
    const body = {
      event: 'payment.received',
      data: { id: 'tx-1', amount: 49000 },
    };

    const result = await provider.verifyCallback({
      body,
      rawBody: JSON.stringify(body),
      headers: { 'x-callback-token': 'wrong-token' },
    });

    expect(result.signatureValid).toBe(false);
  });

  it('checks transaction status via GET /hl/v2/payments/:id', async () => {
    let capturedUrl = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        capturedUrl = String(url);
        return new Response(
          JSON.stringify({
            statusCode: 200,
            messages: 'success',
            data: {
              id: '6f8c19ff-5b97-4792-aa89-d2a12797b356',
              amount: 129000,
              status: 'paid',
              description: 'Langganan Signature [SUB-101]',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    const provider = new MayarPaymentProvider();
    const status = await provider.checkTransactionStatus({
      merchantOrderId: 'SUB-101',
      providerReference: '6f8c19ff-5b97-4792-aa89-d2a12797b356',
    });

    expect(capturedUrl).toBe('https://api.mayar.club/hl/v2/payments/6f8c19ff-5b97-4792-aa89-d2a12797b356');
    expect(status.internalStatus).toBe('paid');
    expect(status.merchantOrderId).toBe('SUB-101');
    expect(status.amount).toBe(129000);
  });

  it('maps Mayar statuses to internal statuses accurately', () => {
    const provider = new MayarPaymentProvider();
    expect(provider.mapProviderStatus('paid')).toBe('paid');
    expect(provider.mapProviderStatus('settlement')).toBe('paid');
    expect(provider.mapProviderStatus(true)).toBe('paid');
    expect(provider.mapProviderStatus('unpaid')).toBe('pending');
    expect(provider.mapProviderStatus('pending')).toBe('pending');
    expect(provider.mapProviderStatus('closed')).toBe('cancelled');
    expect(provider.mapProviderStatus('expired')).toBe('expired');
    expect(provider.mapProviderStatus('failed')).toBe('failed');
    expect(provider.mapProviderStatus(false)).toBe('failed');
    expect(provider.mapProviderStatus('unknown_val')).toBe('unknown');
  });
});
