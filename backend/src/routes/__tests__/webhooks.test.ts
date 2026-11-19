import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  clientQuery: vi.fn(),
  tokenConfigured: vi.fn(() => true),
  verifyCallback: vi.fn(),
  checkTransactionStatus: vi.fn(),
}));

vi.mock('../../core', async () => {
  const actual = await vi.importActual('../../core');
  return {
    ...actual,
    pool: { query: mocks.poolQuery },
    withTransaction: vi.fn(async (cb) => cb({ query: mocks.clientQuery, release: vi.fn() })),
    ApiError: class ApiError extends Error { constructor(public status: number, message: string) { super(message); } },
    log: vi.fn(),
    serializeError: vi.fn((e: unknown) => String(e)),
    insertNotification: vi.fn(),
    broadcastKitchenEvent: vi.fn(),
    activatePaidSubscription: vi.fn().mockResolvedValue(null),
    sendPaymentSuccessEmail: vi.fn(),
    isMayarWebhookTokenConfigured: mocks.tokenConfigured,
  };
});

vi.mock('../../services/PaymentService', () => ({
  PaymentService: {
    finalizePaidOrder: vi.fn().mockResolvedValue({ transactionId: 'tx-1', kitchenOrder: null }),
    voidCompletedOrderTransaction: vi.fn(),
  },
}));

vi.mock('../../services/CommissionService', () => ({
  CommissionService: vi.fn(),
}));

vi.mock('../../lib/config/feature-flags', () => ({
  isReferralCommissionCreationEnabled: vi.fn().mockReturnValue(false),
}));

vi.mock('../../lib/alerting', () => ({
  alertOnPaymentWebhookFailure: vi.fn(),
}));

vi.mock('../../payments/payment-provider.factory', () => ({
  createPaymentProvider: vi.fn(() => ({
    providerName: 'mayar',
    verifyCallback: mocks.verifyCallback,
    checkTransactionStatus: mocks.checkTransactionStatus,
  })),
}));

import router from '../webhooks';
import { activatePaidSubscription } from '../../core';
import { PaymentService } from '../../services/PaymentService';
import { alertOnPaymentWebhookFailure } from '../../lib/alerting';

const PAYMENT_REQUEST_ID = '6f8c19ff-5b97-4792-aa89-d2a12797b356';

function findHandler(path: string, method: 'get' | 'post') {
  const layer = (router as any).stack?.find((l: any) => l.route?.path === path && l.route?.methods?.[method]);
  return layer?.route?.stack?.[0]?.handle as ((req: any, res: any, next: any) => Promise<void>) | undefined;
}

function webhookResult(overrides: Record<string, unknown> = {}) {
  return {
    provider: 'mayar',
    signatureValid: true,
    eventType: 'payment.received',
    merchantOrderId: 'KAF-1700000000000-ABCD1234',
    providerReference: PAYMENT_REQUEST_ID,
    providerTransactionId: 'trx-1',
    orderIdCandidates: ['KAF-1700000000000-ABCD1234'],
    referenceCandidates: [PAYMENT_REQUEST_ID, 'trx-1'],
    amount: 25000,
    paymentMethod: 'QRIS',
    rawStatus: 'SUCCESS',
    internalStatus: 'paid',
    paidAt: '2026-11-16T03:00:00.000Z',
    raw: { event: 'payment.received' },
    ...overrides,
  };
}

function confirmedResult(overrides: Record<string, unknown> = {}) {
  return {
    provider: 'mayar',
    signatureValid: true,
    eventType: 'status_check',
    merchantOrderId: 'KAF-1700000000000-ABCD1234',
    providerReference: PAYMENT_REQUEST_ID,
    orderIdCandidates: ['KAF-1700000000000-ABCD1234'],
    referenceCandidates: [PAYMENT_REQUEST_ID],
    amount: 25000,
    paymentMethod: 'MAYAR',
    rawStatus: 'paid',
    internalStatus: 'paid',
    paidAt: '2026-11-16T03:00:01.000Z',
    raw: { data: { status: 'paid' } },
    ...overrides,
  };
}

const posOrderRow = {
  id: 'po-1',
  merchant_order_id: 'KAF-1700000000000-ABCD1234',
  provider_reference: PAYMENT_REQUEST_ID,
  amount: 25000,
  status: 'pending',
};

const makeReq = (overrides: Record<string, unknown> = {}) => ({
  body: { event: 'payment.received', data: { productId: PAYMENT_REQUEST_ID } },
  headers: { 'x-callback-token': 'secret' },
  query: {},
  rawBody: '{}',
  ...overrides,
});

const makeRes = () => {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
};

describe('Mayar webhook route', () => {
  const handler = findHandler('/api/webhooks/mayar', 'post')!;

  beforeEach(() => {
    vi.clearAllMocks();
    for (const mock of [mocks.poolQuery, mocks.clientQuery, mocks.verifyCallback, mocks.checkTransactionStatus]) {
      mock.mockReset();
    }
    mocks.tokenConfigured.mockReturnValue(true);
    mocks.poolQuery.mockResolvedValue({ rows: [] });
    mocks.clientQuery.mockResolvedValue({ rows: [] });
  });

  it('registers GET + POST /api/webhooks/mayar and no DOKU route', () => {
    expect(findHandler('/api/webhooks/mayar', 'post')).toBeDefined();
    expect(findHandler('/api/webhooks/mayar', 'get')).toBeDefined();
    expect(findHandler('/api/webhooks/doku', 'post')).toBeUndefined();
  });

  it('reports whether the webhook token is configured on GET', async () => {
    const res = makeRes();
    await findHandler('/api/webhooks/mayar', 'get')!({}, res, vi.fn());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, provider: 'mayar', webhookTokenConfigured: true }));
  });

  it('answers 503 (so Mayar retries) when MAYAR_WEBHOOK_TOKEN is missing', async () => {
    mocks.tokenConfigured.mockReturnValue(false);
    const next = vi.fn();
    await handler(makeReq(), makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 503 }));
    expect(mocks.verifyCallback).not.toHaveBeenCalled();
  });

  it('rejects a webhook with an invalid token (401)', async () => {
    mocks.verifyCallback.mockResolvedValue(webhookResult({ signatureValid: false }));
    const next = vi.fn();
    await handler(makeReq(), makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
    expect(alertOnPaymentWebhookFailure).toHaveBeenCalledWith('Mayar webhook processing failed', expect.any(Object));
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });

  it('passes the query string to the provider for ?token= webhooks', async () => {
    mocks.verifyCallback.mockResolvedValue(webhookResult({ internalStatus: 'pending', eventType: 'payment.reminder' }));
    await handler(makeReq({ query: { token: 'secret' } }), makeRes(), vi.fn());
    expect(mocks.verifyCallback).toHaveBeenCalledWith(expect.objectContaining({ query: { token: 'secret' } }));
  });

  it('acknowledges non-payment events without touching orders', async () => {
    mocks.verifyCallback.mockResolvedValue(webhookResult({ eventType: 'membership.memberExpired', internalStatus: 'unknown' }));
    const res = makeRes();
    await handler(makeReq(), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ignored: true, reason: 'not_a_paid_event' }));
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });

  it('acknowledges paid events for orders KaffePOS does not know (e.g. dashboard test)', async () => {
    mocks.verifyCallback.mockResolvedValue(webhookResult());
    const res = makeRes();
    await handler(makeReq(), res, vi.fn());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ignored: true, reason: 'order_not_found' }));
    expect(mocks.checkTransactionStatus).not.toHaveBeenCalled();
  });

  it('settles a POS order only after Mayar confirms it via the API', async () => {
    mocks.verifyCallback.mockResolvedValue(webhookResult({ providerReference: 'payload-ref', referenceCandidates: ['payload-ref'] }));
    mocks.poolQuery.mockResolvedValueOnce({ rows: [posOrderRow] });
    mocks.checkTransactionStatus.mockResolvedValue(confirmedResult());
    mocks.clientQuery.mockResolvedValueOnce({
      rows: [{ ...posOrderRow, user_id: 'user-1', store_id: 'store-1', gross_amount: 25000, items: [], transaction_id: null }],
    });

    const res = makeRes();
    const next = vi.fn();
    await handler(makeReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    // Verified with the reference stored by KaffePOS, not the one in the payload.
    expect(mocks.checkTransactionStatus).toHaveBeenCalledWith({
      merchantOrderId: 'KAF-1700000000000-ABCD1234',
      providerReference: PAYMENT_REQUEST_ID,
      amount: 25000,
    });
    expect(PaymentService.finalizePaidOrder).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'paid', kind: 'pos' }));
  });

  it('refuses to settle when Mayar still reports the payment unpaid (409, Mayar retries)', async () => {
    mocks.verifyCallback.mockResolvedValue(webhookResult());
    mocks.poolQuery.mockResolvedValueOnce({ rows: [posOrderRow] });
    mocks.checkTransactionStatus.mockResolvedValue(confirmedResult({ internalStatus: 'pending', rawStatus: 'unpaid', paidAt: null }));

    const next = vi.fn();
    await handler(makeReq(), makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 409 }));
    expect(PaymentService.finalizePaidOrder).not.toHaveBeenCalled();
  });

  it('rejects an amount that differs from the order', async () => {
    mocks.verifyCallback.mockResolvedValue(webhookResult());
    mocks.poolQuery.mockResolvedValueOnce({ rows: [posOrderRow] });
    mocks.checkTransactionStatus.mockResolvedValue(confirmedResult({ amount: 1000 }));
    mocks.clientQuery.mockResolvedValueOnce({
      rows: [{ ...posOrderRow, user_id: 'user-1', store_id: 'store-1', gross_amount: 25000, items: [], transaction_id: null }],
    });

    const next = vi.fn();
    await handler(makeReq(), makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
    expect(PaymentService.finalizePaidOrder).not.toHaveBeenCalled();
  });

  it('acknowledges duplicates of an already settled order without calling Mayar', async () => {
    mocks.verifyCallback.mockResolvedValue(webhookResult());
    mocks.poolQuery.mockResolvedValueOnce({ rows: [{ ...posOrderRow, status: 'completed' }] });

    const res = makeRes();
    await handler(makeReq(), res, vi.fn());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ duplicate: true, kind: 'pos' }));
    expect(mocks.checkTransactionStatus).not.toHaveBeenCalled();
  });

  it('activates a subscription session after API confirmation', async () => {
    mocks.verifyCallback.mockResolvedValue(webhookResult({ merchantOrderId: 'MAYAR-SIGM-abcd1234-xyz', orderIdCandidates: ['MAYAR-SIGM-abcd1234-xyz'], amount: 129000 }));
    mocks.poolQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: 'sess-1', merchant_order_id: 'MAYAR-SIGM-abcd1234-xyz', provider_reference: PAYMENT_REQUEST_ID, amount: 129000, status: 'pending', subscription_id: null }],
      });
    mocks.checkTransactionStatus.mockResolvedValue(confirmedResult({ merchantOrderId: 'MAYAR-SIGM-abcd1234-xyz', amount: 129000 }));
    mocks.clientQuery.mockResolvedValueOnce({
      rows: [{ id: 'sess-1', user_id: 'user-1', plan: 'signature', billing_cycle: 'monthly', amount: 129000, merchant_order_id: 'MAYAR-SIGM-abcd1234-xyz', subscription_id: null }],
    });

    const res = makeRes();
    const next = vi.fn();
    await handler(makeReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(activatePaidSubscription).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: 'user-1', plan: 'signature', paymentAmount: 129000 }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'paid', kind: 'subscription' }));
  });

  it('does not trust a payload reference unless Mayar links it back to the same order', async () => {
    mocks.verifyCallback.mockResolvedValue(webhookResult({ providerReference: 'other-paid-request' }));
    mocks.poolQuery.mockResolvedValueOnce({ rows: [{ ...posOrderRow, provider_reference: null }] });
    mocks.checkTransactionStatus.mockResolvedValue(confirmedResult({ orderIdCandidates: ['KAF-SOMEONE-ELSE'] }));

    const next = vi.fn();
    await handler(makeReq(), makeRes(), next);
    expect(mocks.checkTransactionStatus).toHaveBeenCalledWith(expect.objectContaining({ providerReference: 'other-paid-request' }));
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 409 }));
    expect(PaymentService.finalizePaidOrder).not.toHaveBeenCalled();
  });

  it('lets Mayar retry when the confirmation call fails', async () => {
    mocks.verifyCallback.mockResolvedValue(webhookResult());
    mocks.poolQuery.mockResolvedValueOnce({ rows: [posOrderRow] });
    mocks.checkTransactionStatus.mockRejectedValue(Object.assign(new Error('Mayar check status gagal (502).'), { status: 503 }));

    const next = vi.fn();
    await handler(makeReq(), makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 503 }));
    expect(PaymentService.finalizePaidOrder).not.toHaveBeenCalled();
  });
});
