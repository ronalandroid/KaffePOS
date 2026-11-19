import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';

const MAYAR_ENV = vi.hoisted(() => ({
  MAYAR_ENVIRONMENT: 'sandbox' as 'sandbox' | 'production',
  MAYAR_API_KEY: 'mayar-test-api-key-jwt' as string | undefined,
  MAYAR_WEBHOOK_TOKEN: 'mayar-webhook-secret-token' as string | undefined,
  MAYAR_SANDBOX_BASE_URL: 'https://api.mayar.io',
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

import { MayarPaymentProvider, webhookTokensMatch } from './mayar.provider';
import { mayarCircuitBreaker } from '../../architecture/circuitBreaker';

const PAYMENT_REQUEST_ID = '6f8c19ff-5b97-4792-aa89-d2a12797b356';
const TRANSACTION_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('MayarPaymentProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mayarCircuitBreaker.reset();
    MAYAR_ENV.MAYAR_ENVIRONMENT = 'sandbox';
    MAYAR_ENV.MAYAR_API_KEY = 'mayar-test-api-key-jwt';
    MAYAR_ENV.MAYAR_WEBHOOK_TOKEN = 'mayar-webhook-secret-token';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('createPayment', () => {
    it('creates a single payment request via Mayar API v2 with the API key', async () => {
      let capturedUrl = '';
      let capturedHeaders: Record<string, string> = {};
      let capturedBody: Record<string, any> = {};

      vi.stubGlobal(
        'fetch',
        vi.fn(async (url, init) => {
          capturedUrl = String(url);
          capturedHeaders = init?.headers as Record<string, string>;
          capturedBody = JSON.parse(String(init?.body));
          return jsonResponse({
            statusCode: 200,
            messages: 'success',
            data: { id: PAYMENT_REQUEST_ID, transactionId: TRANSACTION_ID, link: 'https://kaffepos.myr.id/pl/rqp9x2k7m3a' },
          });
        }),
      );

      const result = await new MayarPaymentProvider().createPayment({
        merchantOrderId: 'SUB-101',
        amount: 129000,
        productDetails: 'Langganan KaffePOS Signature',
        customerName: 'Budi Santoso',
        customerEmail: 'budi@example.com',
        customerPhone: '0812-3456-7890',
        paymentMethod: 'qris',
        metadata: { kind: 'subscription', plan: 'signature' },
      });

      expect(capturedUrl).toBe('https://api.mayar.io/hl/v2/payments/create');
      expect(capturedHeaders.Authorization).toBe('Bearer mayar-test-api-key-jwt');
      expect(capturedBody.amount).toBe(129000);
      expect(capturedBody.email).toBe('budi@example.com');
      expect(capturedBody.mobile).toBe('081234567890');
      expect(capturedBody.description).toContain('[SUB-101]');
      expect(capturedBody.redirectUrl).toBeUndefined();
      expect(capturedBody.extraData).toEqual({
        kind: 'subscription',
        plan: 'signature',
        merchantOrderId: 'SUB-101',
        orderId: 'SUB-101',
        source: 'kaffepos',
      });
      expect(result).toMatchObject({
        provider: 'mayar',
        paymentUrl: 'https://kaffepos.myr.id/pl/rqp9x2k7m3a',
        providerReference: PAYMENT_REQUEST_ID,
        providerTransactionId: TRANSACTION_ID,
        paymentMethod: 'qris',
        internalStatus: 'pending',
      });
    });

    it('uses the production host when MAYAR_ENVIRONMENT=production', async () => {
      MAYAR_ENV.MAYAR_ENVIRONMENT = 'production';
      let capturedUrl = '';
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url) => {
          capturedUrl = String(url);
          return jsonResponse({ statusCode: 200, data: { id: PAYMENT_REQUEST_ID, link: 'https://kaffepos.myr.id/pl/x' } });
        }),
      );

      await new MayarPaymentProvider().createPayment({ merchantOrderId: 'KAF-1', amount: 25000, productDetails: 'POS' });
      expect(capturedUrl).toBe('https://api.mayar.id/hl/v2/payments/create');
    });

    it('does not invent a phone number for payment requests', async () => {
      let capturedBody: Record<string, any> = {};
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url, init) => {
          capturedBody = JSON.parse(String(init?.body));
          return jsonResponse({ statusCode: 200, data: { id: PAYMENT_REQUEST_ID, link: 'https://kaffepos.myr.id/pl/x' } });
        }),
      );

      await new MayarPaymentProvider().createPayment({ merchantOrderId: 'KAF-2', amount: 25000, productDetails: 'POS' });
      expect(capturedBody.mobile).toBeUndefined();
      expect(capturedBody.email).toBe('customer@kaffepos.my.id');
    });

    it('retries without redirectUrl when Mayar refuses it on payment requests', async () => {
      const calls: Array<Record<string, unknown>> = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url, init) => {
          calls.push(JSON.parse(String(init?.body)));
          if (calls.length === 1) {
            return jsonResponse({ statusCode: 400, messages: 'redirectUrl is not supported on payment requests and was not saved' }, 400);
          }
          return jsonResponse({ statusCode: 200, data: { id: 'mayar-id-2', link: 'https://kaffepos.myr.id/pl/retry-ok' } });
        }),
      );

      const result = await new MayarPaymentProvider().createPayment({
        merchantOrderId: 'SUB-102',
        amount: 49000,
        productDetails: 'Langganan Kopi Susu',
        returnUrl: 'https://kaffepos.my.id/settings?billing=mayar-return',
      });

      expect(calls).toHaveLength(2);
      expect(calls[0].redirectUrl).toBe('https://kaffepos.my.id/settings?billing=mayar-return');
      expect(calls[1].redirectUrl).toBeUndefined();
      expect(result.paymentUrl).toBe('https://kaffepos.myr.id/pl/retry-ok');
    });

    it('adds a placeholder phone only when Mayar insists on mobile', async () => {
      const calls: Array<Record<string, unknown>> = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url, init) => {
          calls.push(JSON.parse(String(init?.body)));
          if (calls.length === 1) {
            return jsonResponse({ statusCode: 400, messages: 'Validation Error', data: ['mobile is required'] }, 400);
          }
          return jsonResponse({ statusCode: 200, data: { id: 'mayar-id-3', link: 'https://kaffepos.myr.id/pl/m' } });
        }),
      );

      await new MayarPaymentProvider().createPayment({ merchantOrderId: 'KAF-3', amount: 15000, productDetails: 'POS' });
      expect(calls).toHaveLength(2);
      expect(calls[0].mobile).toBeUndefined();
      expect(calls[1].mobile).toBe('081234567890');
    });

    it('surfaces a friendly error for duplicate requests (429)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => jsonResponse({ statusCode: 429, messages: 'Duplicate request detected. Please wait 1 minute before trying again.' }, 429)),
      );

      await expect(
        new MayarPaymentProvider().createPayment({ merchantOrderId: 'KAF-4', amount: 15000, productDetails: 'POS' }),
      ).rejects.toMatchObject({ status: 503, message: expect.stringContaining('Mayar menolak permintaan ganda') });
    });

    it('fails with 503 when the API key is rejected', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ statusCode: 401, messages: 'Unauthorized' }, 401)));
      await expect(
        new MayarPaymentProvider().createPayment({ merchantOrderId: 'KAF-5', amount: 15000, productDetails: 'POS' }),
      ).rejects.toMatchObject({ status: 503, message: 'Mayar create payment gagal (401).' });
    });

    it('refuses to call Mayar without an API key', async () => {
      MAYAR_ENV.MAYAR_API_KEY = undefined;
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      await expect(
        new MayarPaymentProvider().createPayment({ merchantOrderId: 'KAF-6', amount: 15000, productDetails: 'POS' }),
      ).rejects.toMatchObject({ status: 503 });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('verifyCallback (webhook token)', () => {
    const paidBody = {
      event: 'payment.received',
      data: {
        id: TRANSACTION_ID,
        transactionId: TRANSACTION_ID,
        productId: PAYMENT_REQUEST_ID,
        productType: 'payment_request',
        status: 'SUCCESS',
        transactionStatus: 'created',
        amount: 129000,
        customerEmail: 'budi@example.com',
        extraData: { merchantOrderId: 'SUB-101', orderId: 'SUB-101' },
        createdAt: 1768375011056,
        updatedAt: 1768375112056,
      },
    };

    it('accepts the X-Callback-Token header and maps payment.received to paid', async () => {
      const result = await new MayarPaymentProvider().verifyCallback({
        body: paidBody,
        headers: { 'X-Callback-Token': 'mayar-webhook-secret-token' },
      });

      expect(result.signatureValid).toBe(true);
      expect(result.eventType).toBe('payment.received');
      expect(result.internalStatus).toBe('paid');
      expect(result.merchantOrderId).toBe('SUB-101');
      expect(result.providerReference).toBe(PAYMENT_REQUEST_ID);
      expect(result.providerTransactionId).toBe(TRANSACTION_ID);
      expect(result.referenceCandidates).toEqual([PAYMENT_REQUEST_ID, TRANSACTION_ID]);
      expect(result.amount).toBe(129000);
      expect(result.paidAt).toBe(new Date(1768375112056).toISOString());
    });

    it('accepts the token from ?token= on the webhook URL', async () => {
      const result = await new MayarPaymentProvider().verifyCallback({
        body: paidBody,
        headers: {},
        query: { token: 'mayar-webhook-secret-token' },
      });
      expect(result.signatureValid).toBe(true);
    });

    it('accepts an Authorization: Bearer token and ignores edge whitespace', async () => {
      const result = await new MayarPaymentProvider().verifyCallback({
        body: paidBody,
        headers: { authorization: 'Bearer  mayar-webhook-secret-token\n' },
      });
      expect(result.signatureValid).toBe(true);
    });

    it('rejects a wrong token', async () => {
      const result = await new MayarPaymentProvider().verifyCallback({
        body: paidBody,
        headers: { 'x-callback-token': 'wrong-token' },
        query: { token: 'also-wrong' },
      });
      expect(result.signatureValid).toBe(false);
    });

    it('never accepts the API key as a webhook token', async () => {
      const result = await new MayarPaymentProvider().verifyCallback({
        body: paidBody,
        headers: { 'x-callback-token': 'mayar-test-api-key-jwt' },
      });
      expect(result.signatureValid).toBe(false);
    });

    it('rejects every webhook when MAYAR_WEBHOOK_TOKEN is not configured', async () => {
      MAYAR_ENV.MAYAR_WEBHOOK_TOKEN = undefined;
      const result = await new MayarPaymentProvider().verifyCallback({
        body: paidBody,
        headers: { 'x-callback-token': 'mayar-test-api-key-jwt' },
      });
      expect(result.signatureValid).toBe(false);
    });

    it('also accepts an HMAC-SHA256 of the raw body keyed with the token', async () => {
      const rawBody = JSON.stringify(paidBody);
      const hex = createHmac('sha256', 'mayar-webhook-secret-token').update(rawBody, 'utf8').digest('hex');
      const base64 = createHmac('sha256', 'mayar-webhook-secret-token').update(rawBody, 'utf8').digest('base64');
      const provider = new MayarPaymentProvider();

      const byHex = await provider.verifyCallback({ body: paidBody, rawBody, headers: { 'x-mayar-signature': hex.toUpperCase() } });
      const byBase64 = await provider.verifyCallback({ body: paidBody, rawBody, headers: { signature: `sha256=${base64}` } });
      expect(byHex.signatureValid).toBe(true);
      expect(byBase64.signatureValid).toBe(true);
    });

    it('rejects an HMAC computed with another key or over another body', async () => {
      const rawBody = JSON.stringify(paidBody);
      const wrongKey = createHmac('sha256', 'not-the-token').update(rawBody, 'utf8').digest('hex');
      const wrongBody = createHmac('sha256', 'mayar-webhook-secret-token').update('{"tampered":true}', 'utf8').digest('hex');
      const provider = new MayarPaymentProvider();

      expect((await provider.verifyCallback({ body: paidBody, rawBody, headers: { 'x-mayar-signature': wrongKey } })).signatureValid).toBe(false);
      expect((await provider.verifyCallback({ body: paidBody, rawBody, headers: { 'x-mayar-signature': wrongBody } })).signatureValid).toBe(false);
    });

    it('accepts a 128-character dashboard Web Token sent in X-Callback-Token', async () => {
      const webToken = 'ab'.repeat(64);
      MAYAR_ENV.MAYAR_WEBHOOK_TOKEN = `${webToken}\n`;
      const result = await new MayarPaymentProvider().verifyCallback({ body: paidBody, headers: { 'x-callback-token': webToken } });
      expect(result.signatureValid).toBe(true);
    });

    it('parses the nested event shape and boolean status', async () => {
      const result = await new MayarPaymentProvider().verifyCallback({
        body: {
          event: { received: 'payment.received' },
          data: {
            productId: PAYMENT_REQUEST_ID,
            productName: 'Budi',
            description: 'KaffePOS checkout KAF-1700000000000-ABCD1234 [KAF-1700000000000-ABCD1234]',
            status: true,
            amount: '25000',
          },
        },
        headers: { 'x-callback-token': 'mayar-webhook-secret-token' },
      });
      expect(result.internalStatus).toBe('paid');
      expect(result.merchantOrderId).toBe('KAF-1700000000000-ABCD1234');
      expect(result.amount).toBe(25000);
    });

    it('treats payment.reminder as pending and non-payment events as unknown', async () => {
      const provider = new MayarPaymentProvider();
      const headers = { 'x-callback-token': 'mayar-webhook-secret-token' };
      const reminder = await provider.verifyCallback({ body: { event: 'payment.reminder', data: { productId: PAYMENT_REQUEST_ID } }, headers });
      const membership = await provider.verifyCallback({ body: { event: 'membership.memberExpired', data: { id: 'm-1', status: 'SUCCESS' } }, headers });
      expect(reminder.internalStatus).toBe('pending');
      expect(membership.internalStatus).toBe('unknown');
    });

    it('compares tokens in constant time without leaking length', () => {
      expect(webhookTokensMatch('abc', 'abc')).toBe(true);
      expect(webhookTokensMatch('abc', 'abcd')).toBe(false);
      expect(webhookTokensMatch('', 'abc')).toBe(false);
    });
  });

  describe('checkTransactionStatus', () => {
    it('reads GET /hl/v2/payments/:id with the API key', async () => {
      let capturedUrl = '';
      let capturedAuth = '';
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url, init) => {
          capturedUrl = String(url);
          capturedAuth = (init?.headers as Record<string, string>).Authorization;
          return jsonResponse({
            statusCode: 200,
            messages: 'success',
            data: { id: PAYMENT_REQUEST_ID, amount: 129000, status: 'paid', description: 'Langganan Signature [SUB-101]', transactions: [] },
          });
        }),
      );

      const status = await new MayarPaymentProvider().checkTransactionStatus({
        merchantOrderId: 'SUB-101',
        providerReference: PAYMENT_REQUEST_ID,
      });

      expect(capturedUrl).toBe(`https://api.mayar.io/hl/v2/payments/${PAYMENT_REQUEST_ID}`);
      expect(capturedAuth).toBe('Bearer mayar-test-api-key-jwt');
      expect(status.internalStatus).toBe('paid');
      expect(status.merchantOrderId).toBe('SUB-101');
      expect(status.orderIdCandidates).toEqual(['SUB-101']);
      expect(status.amount).toBe(129000);
    });

    it('treats a paid entry in transactions[] as paid', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          jsonResponse({
            statusCode: 200,
            data: {
              id: PAYMENT_REQUEST_ID,
              amount: 25000,
              status: 'unpaid',
              transactions: [{ id: TRANSACTION_ID, status: 'paid', amount: 25000, updatedAt: 1768375112056 }],
            },
          }),
        ),
      );

      const status = await new MayarPaymentProvider().checkTransactionStatus({ merchantOrderId: 'KAF-1', providerReference: PAYMENT_REQUEST_ID });
      expect(status.internalStatus).toBe('paid');
      expect(status.providerTransactionId).toBe(TRANSACTION_ID);
      expect(status.paidAt).toBe(new Date(1768375112056).toISOString());
    });

    it('reports unpaid requests as pending', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ statusCode: 200, data: { id: PAYMENT_REQUEST_ID, amount: 25000, status: 'unpaid' } })));
      const status = await new MayarPaymentProvider().checkTransactionStatus({ merchantOrderId: 'KAF-1', providerReference: PAYMENT_REQUEST_ID });
      expect(status.internalStatus).toBe('pending');
      expect(status.paidAt).toBeNull();
    });

    it('requires a stored provider reference', async () => {
      await expect(new MayarPaymentProvider().checkTransactionStatus({ merchantOrderId: 'KAF-1' })).rejects.toMatchObject({ status: 409 });
    });

    it('maps 404 and 5xx responses to API errors', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ statusCode: 404, messages: 'not found' }, 404)));
      await expect(
        new MayarPaymentProvider().checkTransactionStatus({ merchantOrderId: 'KAF-1', providerReference: 'missing' }),
      ).rejects.toMatchObject({ status: 404 });

      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ statusCode: 503, messages: 'down' }, 503)));
      await expect(
        new MayarPaymentProvider().checkTransactionStatus({ merchantOrderId: 'KAF-1', providerReference: PAYMENT_REQUEST_ID }),
      ).rejects.toMatchObject({ status: 503 });
    });
  });

  it('maps Mayar statuses to internal statuses accurately', () => {
    const provider = new MayarPaymentProvider();
    expect(provider.mapProviderStatus('paid')).toBe('paid');
    expect(provider.mapProviderStatus('SUCCESS')).toBe('paid');
    expect(provider.mapProviderStatus('settlement')).toBe('paid');
    expect(provider.mapProviderStatus(true)).toBe('paid');
    expect(provider.mapProviderStatus('unpaid')).toBe('pending');
    expect(provider.mapProviderStatus('pending')).toBe('pending');
    expect(provider.mapProviderStatus('closed')).toBe('cancelled');
    expect(provider.mapProviderStatus('expired')).toBe('expired');
    expect(provider.mapProviderStatus('failed')).toBe('failed');
    expect(provider.mapProviderStatus(false)).toBe('failed');
    expect(provider.mapProviderStatus('unknown_val')).toBe('unknown');
    expect(provider.mapProviderStatus(null)).toBe('unknown');
  });
});
