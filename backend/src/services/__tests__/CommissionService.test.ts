import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

vi.mock('../../core', async () => {
  const actual = await vi.importActual('../../core');
  return { ...actual, log: vi.fn() };
});

import { CommissionService } from '../CommissionService';

describe('CommissionService', () => {
  let db: { query: ReturnType<typeof vi.fn> };
  const referrerUserId = randomUUID();
  const referredUserId = randomUUID();
  const referralRegistrationId = randomUUID();
  const paymentId = randomUUID();

  beforeEach(() => {
    db = { query: vi.fn() };
    vi.clearAllMocks();
  });

  it('should create customer referral credit from first paid subscription', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: referralRegistrationId, referrer_user_id: referrerUserId, referred_user_id: referredUserId, referral_type: 'customer_referral', status: 'registered', first_payment_at: null }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: randomUUID(), amount: 150000, type: 'referral_credit', status: 'pending' }] });

    const service = new CommissionService(db as any);
    const result = await service.createFromPayment({
      userId: referredUserId,
      paymentId,
      grossAmount: 99000,
      paidAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      orderId: 'ORDER-1',
    });

    expect(result.created).toBe(true);
    expect(result.commission.amount).toBe(150000);
    expect(result.commission.type).toBe('referral_credit');
  });

  it('should calculate affiliate cash commission by commission rate', async () => {
    const affiliateProfileId = randomUUID();
    db.query
      .mockResolvedValueOnce({ rows: [{ id: referralRegistrationId, referrer_user_id: referrerUserId, referred_user_id: referredUserId, referral_type: 'affiliate', status: 'registered', first_payment_at: null }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: affiliateProfileId, status: 'active', commission_rate: 20 }] })
      .mockResolvedValueOnce({ rows: [{ id: randomUUID(), amount: 19800, type: 'affiliate_cash', rate: 20, status: 'pending' }] });

    const service = new CommissionService(db as any);
    const result = await service.createFromPayment({
      userId: referredUserId,
      paymentId,
      grossAmount: 99000,
      paidAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      orderId: 'ORDER-2',
    });

    expect(result.created).toBe(true);
    expect(result.commission.amount).toBe(19800);
    expect(result.commission.type).toBe('affiliate_cash');
  });

  it('should skip duplicate commission for same payment', async () => {
    const existingCommission = { id: randomUUID(), payment_id: paymentId };
    db.query
      .mockResolvedValueOnce({ rows: [{ id: referralRegistrationId, referrer_user_id: referrerUserId, referred_user_id: referredUserId, referral_type: 'customer_referral', status: 'paid', first_payment_at: null }] })
      .mockResolvedValueOnce({ rows: [existingCommission] });

    const service = new CommissionService(db as any);
    const result = await service.createFromPayment({
      userId: referredUserId,
      paymentId,
      grossAmount: 99000,
      paidAt: new Date().toISOString(),
      orderId: 'ORDER-DUP',
    });

    expect(result.created).toBe(false);
    expect(result.reason).toBe('commission_exists');
  });

  it('should reject self-referral commission', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: referralRegistrationId, referrer_user_id: referredUserId, referred_user_id: referredUserId, referral_type: 'customer_referral', status: 'registered' }] });

    const service = new CommissionService(db as any);
    const result = await service.createFromPayment({
      userId: referredUserId,
      paymentId,
      grossAmount: 99000,
      paidAt: new Date().toISOString(),
      orderId: 'ORDER-SELF',
    });

    expect(result.created).toBe(false);
    expect(result.reason).toBe('self_referral');
  });

  it('markPaid rejects commission that is not approved', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'comm-1', status: 'pending', eligible_at: null }] });

    const service = new CommissionService(db as any);
    await expect(service.markPaid('comm-1', null, null)).rejects.toThrow('Hanya komisi approved');
    // Only the SELECT FOR UPDATE ran — no update query was issued.
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('markPaid rejects payout before the holdback window (eligible_at in the future)', async () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.query.mockResolvedValueOnce({ rows: [{ id: 'comm-2', status: 'approved', eligible_at: future }] });

    const service = new CommissionService(db as any);
    await expect(service.markPaid('comm-2', null, null)).rejects.toThrow('masa tunggu');
    // Guard fires before the update — cash is not released early.
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('markPaid settles an approved commission once the holdback has elapsed', async () => {
    const past = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'comm-3', status: 'approved', eligible_at: past }] })
      .mockResolvedValueOnce({ rows: [{ id: 'comm-3', status: 'paid', payout_reference: 'PO-9' }] });

    const service = new CommissionService(db as any);
    const result = await service.markPaid('comm-3', 'note', 'PO-9');

    expect(result.status).toBe('paid');
    expect(db.query).toHaveBeenCalledTimes(2);
  });
});
