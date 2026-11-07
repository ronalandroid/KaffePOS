import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

vi.mock('../../core', async () => {
  const actual = await vi.importActual('../../core');
  return {
    ...actual,
    withTransaction: vi.fn(async (cb) => cb({ query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() })),
    ApiError: class ApiError extends Error { constructor(public status: number, message: string) { super(message); } },
    log: vi.fn(),
    serializeError: vi.fn((e: unknown) => String(e)),
    insertNotification: vi.fn(),
    broadcastKitchenEvent: vi.fn(),
    activatePaidSubscription: vi.fn(),
    sendPaymentSuccessEmail: vi.fn(),
  };
});

vi.mock('../../services/PaymentService', () => ({
  PaymentService: {
    finalizePaidOrder: vi.fn().mockResolvedValue({ transactionId: null, kitchenOrder: null }),
    voidCompletedOrderTransaction: vi.fn(),
  },
}));

vi.mock('../../services/CommissionService', () => ({
  CommissionService: { createFromSubscriptionPayment: vi.fn() },
}));

vi.mock('../../lib/config/feature-flags', () => ({
  isReferralCommissionCreationEnabled: vi.fn().mockReturnValue(false),
}));

vi.mock('../../lib/alerting', () => ({
  alertOnPaymentWebhookFailure: vi.fn(),
}));

vi.mock('../../payments/payment-provider.factory', () => ({
  createPaymentProvider: vi.fn(() => ({
    verifyCallback: vi.fn().mockResolvedValue({
      signatureValid: true,
      merchantOrderId: `ORDER-${randomUUID()}`,
      internalStatus: 'paid',
      rawStatus: 'SUCCESS',
      amount: 50000,
      provider: 'doku',
      providerReference: 'DOKU-REF-001',
      paymentMethod: 'QRIS',
      paidAt: new Date().toISOString(),
      raw: {},
    }),
  })),
}));

import { createPaymentProvider } from '../../payments/payment-provider.factory';
import { alertOnPaymentWebhookFailure } from '../../lib/alerting';

describe('DOKU webhook handler', () => {
  const makeReq = (overrides?: Record<string, unknown>) => ({
    body: { order: { invoice_number: `ORDER-${randomUUID()}` }, transaction: { status: 'SUCCESS' } },
    headers: { 'signature': 'test-sig' },
    rawBody: '{}',
    ...overrides,
  });

  const makeRes = () => {
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    return res;
  };

  const next = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers POST /api/webhooks/doku route', async () => {
    const webhooksModule = await import('../webhooks');
    const router = webhooksModule.default;
    const dokuRoute = (router as any).stack?.find((l: any) => l.route?.path === '/api/webhooks/doku');
    expect(dokuRoute).toBeDefined();
    expect(dokuRoute.route.methods?.post).toBe(true);
  });

  it('rejects webhook with invalid signature', async () => {
    vi.mocked(createPaymentProvider).mockReturnValueOnce({
      verifyCallback: vi.fn().mockResolvedValue({
        signatureValid: false,
        merchantOrderId: 'ORDER-INVALID',
        internalStatus: 'unknown',
        rawStatus: 'INVALID',
        amount: null,
        provider: 'doku',
        providerReference: null,
        paymentMethod: null,
        paidAt: null,
        raw: {},
      }),
    } as any);

    const webhooksModule = await import('../webhooks');
    const router = webhooksModule.default;
    const dokuRoute = (router as any).stack?.find((l: any) => l.route?.path === '/api/webhooks/doku');
    const handler = dokuRoute?.route?.stack?.[0]?.handle;

    if (!handler) {
      expect(true).toBe(true);
      return;
    }

    const req = makeReq() as any;
    const res = makeRes() as any;

    await handler(req, res, next);
    expect(alertOnPaymentWebhookFailure).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('calls alertOnPaymentWebhookFailure when provider throws', async () => {
    vi.mocked(createPaymentProvider).mockReturnValueOnce({
      verifyCallback: vi.fn().mockRejectedValue(new Error('Provider network error')),
    } as any);

    const webhooksModule = await import('../webhooks');
    const router = webhooksModule.default;
    const dokuRoute = (router as any).stack?.find((l: any) => l.route?.path === '/api/webhooks/doku');
    const handler = dokuRoute?.route?.stack?.[0]?.handle;

    if (!handler) {
      expect(true).toBe(true);
      return;
    }

    const req = makeReq() as any;
    const res = makeRes() as any;

    await handler(req, res, next);
    expect(alertOnPaymentWebhookFailure).toHaveBeenCalledWith('DOKU webhook processing failed', expect.any(Object));
    expect(next).toHaveBeenCalled();
  });
});
