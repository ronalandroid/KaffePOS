import { describe, expect, it } from 'vitest';
import { buildEnhancedAiInsights } from './ai-insights';

function txn(overrides: Record<string, unknown> = {}) {
  return {
    id: `t-${Math.random().toString(36).slice(2)}`,
    total: 50_000,
    subtotal: 50_000,
    discount: 0,
    date: new Date().toISOString(),
    cashier: 'Andi',
    is_void: false,
    items: [{ name: 'Kopi Susu', qty: 2, price: 25_000 }],
    ...overrides,
  };
}

describe('buildEnhancedAiInsights', () => {
  it('returns the full insight payload shape for populated data', () => {
    const result = buildEnhancedAiInsights({
      storeId: 'store-1',
      storeName: 'Kopi Kita',
      transactions: Array.from({ length: 25 }, () => txn()),
      inventory: [{ name: 'Susu', stock: 3, min_stock: 5 }],
      menu: [{ name: 'Kopi Susu', price: 25_000, category: 'Coffee' }],
    });

    expect(result.storeId).toBe('store-1');
    expect(result.storeName).toBe('Kopi Kita');
    expect(result.fromCache).toBe(false);
    expect(typeof result.generatedAt).toBe('string');
    expect(Array.isArray(result.insights)).toBe(true);
    // Insights are capped at 5 and every entry carries the documented fields.
    expect(result.insights.length).toBeLessThanOrEqual(5);
    for (const insight of result.insights) {
      expect(insight).toMatchObject({
        id: expect.any(String),
        type: expect.any(String),
        title: expect.any(String),
        confidence: expect.any(Number),
      });
    }
    expect(result.kopiScore).toBeDefined();
    expect(result.charts).toBeDefined();
  });

  it('does not throw and still returns a payload when there are no transactions', () => {
    const result = buildEnhancedAiInsights({
      storeId: 'store-2',
      storeName: 'Warung Sepi',
      transactions: [],
      inventory: [],
      menu: [],
    });

    expect(result.storeId).toBe('store-2');
    expect(Array.isArray(result.insights)).toBe(true);
    expect(typeof result.summary).toBe('string');
  });

  it('ignores voided transactions when computing insights', () => {
    const base = {
      storeId: 'store-3',
      storeName: 'Kopi Void',
      inventory: [],
      menu: [],
    };
    const withVoids = buildEnhancedAiInsights({
      ...base,
      transactions: [txn({ total: 100_000 }), txn({ total: 999_999, is_void: true })],
    });
    const withoutVoids = buildEnhancedAiInsights({
      ...base,
      transactions: [txn({ total: 100_000 })],
    });

    // The voided 999,999 row must not inflate any revenue-derived metric.
    expect(withVoids.charts).toEqual(withoutVoids.charts);
  });
});
