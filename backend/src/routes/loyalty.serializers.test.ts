import { describe, expect, it } from 'vitest';
import {
  deriveTier,
  normalizePhone,
  serializeCustomerFromPassportRow,
  serializeReward,
} from './loyalty.serializers';

describe('loyalty serializers', () => {
  describe('deriveTier', () => {
    it('returns regular below every threshold', () => {
      expect(deriveTier({ lifetimeSpend: 0, totalStamps: 0, totalPoints: 0 })).toBe('regular');
      expect(deriveTier({ lifetimeSpend: 499_999, totalStamps: 15, totalPoints: 4_999 })).toBe('regular');
    });

    it('promotes to kopi_lover when any mid threshold is met', () => {
      expect(deriveTier({ lifetimeSpend: 500_000, totalStamps: 0, totalPoints: 0 })).toBe('kopi_lover');
      expect(deriveTier({ lifetimeSpend: 0, totalStamps: 16, totalPoints: 0 })).toBe('kopi_lover');
      expect(deriveTier({ lifetimeSpend: 0, totalStamps: 0, totalPoints: 5_000 })).toBe('kopi_lover');
    });

    it('promotes to vvip when any top threshold is met', () => {
      expect(deriveTier({ lifetimeSpend: 2_000_000, totalStamps: 0, totalPoints: 0 })).toBe('vvip');
      expect(deriveTier({ lifetimeSpend: 0, totalStamps: 48, totalPoints: 0 })).toBe('vvip');
      expect(deriveTier({ lifetimeSpend: 0, totalStamps: 0, totalPoints: 20_000 })).toBe('vvip');
    });
  });

  describe('normalizePhone', () => {
    it('strips non-digits and preserves a leading +', () => {
      expect(normalizePhone(' +62 812-3456-7890 ')).toBe('+6281234567890');
      expect(normalizePhone('0812 3456 7890')).toBe('081234567890');
      expect(normalizePhone('(021) 555.1234')).toBe('0215551234');
    });
  });

  describe('serializeCustomerFromPassportRow', () => {
    it('maps passport fields onto the customer shape (visits from stamps, name from customer_name)', () => {
      const customer = serializeCustomerFromPassportRow({
        id: 'p1',
        store_id: 's1',
        customer_name: 'Andi',
        customer_phone: '081234567890',
        tier: 'kopi_lover',
        total_points: 1200,
        total_stamps: 7,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-02-01T00:00:00.000Z',
      });

      expect(customer).toMatchObject({
        id: 'p1',
        store_id: 's1',
        name: 'Andi',
        phone: '081234567890',
        tier: 'kopi_lover',
        total_points: 1200,
        total_visits: 7,
      });
    });

    it('falls back to a safe tier and clamps negative counters', () => {
      const customer = serializeCustomerFromPassportRow({
        id: 'p2',
        store_id: 's1',
        customer_name: null,
        customer_phone: '',
        tier: 'not-a-real-tier',
        total_points: -50,
        total_stamps: -3,
      });

      expect(customer.tier).toBe('regular');
      expect(customer.total_points).toBe(0);
      expect(customer.total_visits).toBe(0);
      expect(customer.name).toBeNull();
    });
  });

  describe('serializeReward', () => {
    it('catches an unknown reward type and clamps negative values', () => {
      const reward = serializeReward({
        id: 'r1',
        store_id: 's1',
        name: 'Free Latte',
        type: 'bogus_type',
        reward_value: -10,
        points_cost: -5,
        stamps_cost: 8,
      });

      expect(reward.type).toBe('discount_amount');
      expect(reward.reward_value).toBe(0);
      expect(reward.points_cost).toBe(0);
      expect(reward.points_or_stamps_needed).toBe(8);
    });
  });
});
