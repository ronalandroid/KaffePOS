/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { buildInsightContext } from '@/lib/insightContext';
import type { Transaction, InventoryItem } from '@/types';

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 'x', store_id: 's', date: new Date().toISOString(), items: [],
  subtotal: 0, discount: 0, tax: 0, total: 0, cogs: 0, paid: 0, change: 0,
  method: 'Tunai', is_void: false, ...over,
} as unknown as Transaction);

const inv = (over: Partial<InventoryItem>): InventoryItem => ({
  id: 'i', store_id: 's', name: 'Susu', stock: 2, unit: 'L', min_stock: 5, cost_per_unit: 1000,
  ...over,
} as unknown as InventoryItem);

describe('buildInsightContext', () => {
  it('aggregates revenue, cogs, profit, margin and tx count over non-void sales', () => {
    const ctx = buildInsightContext({
      transactions: [
        tx({ total: 100000, cogs: 40000, method: 'QRIS' }),
        tx({ total: 50000, cogs: 20000, method: 'Tunai' }),
        tx({ total: 999999, cogs: 0, is_void: true }), // ignored
      ],
      inventory: [],
      expenses: [{ amount: 10000 } as any],
      storeName: 'Kopi Senja',
    });
    expect(ctx.totalRevenue).toBe(150000);
    expect(ctx.totalCogs).toBe(60000);
    expect(ctx.totalExpenses).toBe(10000);
    expect(ctx.netProfit).toBe(80000); // 150k - 60k - 10k
    expect(ctx.grossMargin).toBe(60);  // (150k-60k)/150k
    expect(ctx.txCount).toBe(2);
    expect(ctx.avgTrx).toBe(75000);
    expect(ctx.storeName).toBe('Kopi Senja');
  });

  it('ranks top menus by quantity from line items', () => {
    const ctx = buildInsightContext({
      transactions: [
        tx({ total: 30000, items: [{ name: 'Latte', qty: 2, price: 15000, subtotal: 30000 }] as any }),
        tx({ total: 18000, items: [{ name: 'Espresso', qty: 1, price: 18000, subtotal: 18000 }] as any }),
        tx({ total: 15000, items: [{ name: 'Latte', qty: 1, price: 15000, subtotal: 15000 }] as any }),
      ],
      inventory: [],
      storeName: 'Kopi Senja',
    });
    expect(ctx.topMenus[0]).toEqual({ name: 'Latte', qty: 3, revenue: 45000 });
  });

  it('lists low-stock items and payment mix percentages', () => {
    const ctx = buildInsightContext({
      transactions: [tx({ method: 'QRIS' }), tx({ method: 'QRIS' }), tx({ method: 'Tunai' }), tx({ method: 'Transfer' })],
      inventory: [inv({ name: 'Susu', stock: 2, min_stock: 5 }), inv({ name: 'Gula', stock: 99, min_stock: 5 })],
      storeName: 'Kopi Senja',
    });
    expect(ctx.lowStockItems.map((i) => i.name)).toEqual(['Susu']);
    const qris = ctx.paymentMix.find((p) => p.method === 'QRIS');
    expect(qris?.pct).toBe(50); // 2 of 4
  });

  it('returns safe zeroes for an empty store', () => {
    const ctx = buildInsightContext({ transactions: [], inventory: [], storeName: 'Kopi Senja' });
    expect(ctx.totalRevenue).toBe(0);
    expect(ctx.grossMargin).toBe(0);
    expect(ctx.avgTrx).toBe(0);
    expect(ctx.trendData).toHaveLength(7);
  });
});
