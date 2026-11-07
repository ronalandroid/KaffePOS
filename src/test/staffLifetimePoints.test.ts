import { describe, it, expect } from 'vitest';
import { buildStaffPersonalProfileStats } from '@/lib/gamification';
import type { Profile, Transaction } from '@/types';

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 'x', store_id: 's', date: new Date().toISOString(), items: [],
  subtotal: 0, discount: 0, tax: 0, total: 0, cogs: 0, paid: 0, change: 0,
  method: 'Tunai', cashier: 'Budi', is_void: false, ...over,
} as unknown as Transaction);

const budi = { display_name: 'Budi' } as unknown as Profile;

describe('buildStaffPersonalProfileStats — server lifetime points override', () => {
  it('uses the server lifetime points for points/level instead of the local windowed sum', () => {
    const local = buildStaffPersonalProfileStats({
      transactions: [tx({ cashier: 'Budi', total: 10000 })], profile: budi, scope: 'personal',
    });
    const withServer = buildStaffPersonalProfileStats({
      transactions: [tx({ cashier: 'Budi', total: 10000 })], profile: budi, scope: 'personal', lifetimePoints: 5000,
    });
    expect(local.points).toBeLessThan(100);          // one small sale → ~10 local points
    expect(withServer.points).toBe(5000);            // server full-history total wins
    expect(withServer.level).toBeGreaterThanOrEqual(local.level);
  });

  it('still adds challenge bonus points on top of the server lifetime total', () => {
    const stats = buildStaffPersonalProfileStats({
      transactions: [], profile: budi, scope: 'personal', lifetimePoints: 1000, bonusPoints: 250,
    });
    expect(stats.points).toBe(1250);
  });

  it('falls back to the local sum when no server lifetime points are provided', () => {
    const stats = buildStaffPersonalProfileStats({
      transactions: [tx({ cashier: 'Budi', total: 60000, method: 'QRIS' })], profile: budi, scope: 'personal',
    });
    // 10 base + 8 upsell (>=50k) + 2 QRIS = 20, no override
    expect(stats.points).toBe(20);
  });
});
