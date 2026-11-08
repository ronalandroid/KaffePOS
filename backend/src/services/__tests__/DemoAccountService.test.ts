import { describe, expect, it, vi } from 'vitest';
import {
  DEMO_CASHIER_EMAIL,
  DEMO_DEFAULT_PASSWORD,
  DEMO_OWNER_EMAIL,
  ensureDemoAccountsSeeded,
  isDemoAccountEmail,
} from '../DemoAccountService';

describe('DemoAccountService', () => {
  it('correctly identifies demo account emails case-insensitively', () => {
    expect(isDemoAccountEmail('demo@kaffepos.my.id')).toBe(true);
    expect(isDemoAccountEmail('  DEMO@kaffepos.my.id ')).toBe(true);
    expect(isDemoAccountEmail('kasir@kaffepos.my.id')).toBe(true);
    expect(isDemoAccountEmail('KASIR@kaffepos.my.id')).toBe(true);
    expect(isDemoAccountEmail('other@kaffepos.my.id')).toBe(false);
    expect(isDemoAccountEmail('user@gmail.com')).toBe(false);
  });

  it('exports standard demo account credentials', () => {
    expect(DEMO_OWNER_EMAIL).toBe('demo@kaffepos.my.id');
    expect(DEMO_CASHIER_EMAIL).toBe('kasir@kaffepos.my.id');
    expect(DEMO_DEFAULT_PASSWORD).toBe('DemoPassword123');
  });

  it('seeds demo accounts and catalog idempotently via queries', async () => {
    const executedQueries: Array<{ query: string; params?: unknown[] }> = [];

    const mockClient: any = {
      query: vi.fn().mockImplementation((query: string, params?: unknown[]) => {
        executedQueries.push({ query: query.trim(), params });
        if (query.includes('count(*)::int as cnt from public.menu_items')) {
          return Promise.resolve({ rows: [{ cnt: 0 }] });
        }
        if (query.includes('from public.subscriptions where user_id = $1 and status = $2')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }),
    };

    await ensureDemoAccountsSeeded(mockClient);

    expect(mockClient.query).toHaveBeenCalled();
    const queryTexts = executedQueries.map((q) => q.query);

    // Verifies cleanup of previous collisions
    expect(queryTexts.some((q) => q.includes('delete from public.app_auth_credentials'))).toBe(true);
    expect(queryTexts.some((q) => q.includes('delete from public.profiles'))).toBe(true);

    // Verifies upserting owner & cashier profiles
    expect(queryTexts.some((q) => q.includes('insert into public.profiles'))).toBe(true);

    // Verifies upserting credentials
    expect(queryTexts.some((q) => q.includes('insert into public.app_auth_credentials'))).toBe(true);

    // Verifies store creation and cashier outlet assignment
    expect(queryTexts.some((q) => q.includes('insert into public.stores'))).toBe(true);
    expect(queryTexts.some((q) => q.includes('insert into public.cashier_outlet_assignments'))).toBe(true);

    // Verifies demo inventory, menu items, open bills, and purchase orders
    expect(queryTexts.some((q) => q.includes('insert into public.inventory'))).toBe(true);
    expect(queryTexts.some((q) => q.includes('insert into public.menu_items'))).toBe(true);
    expect(queryTexts.some((q) => q.includes('insert into public.open_bills'))).toBe(true);
    expect(queryTexts.some((q) => q.includes('insert into public.purchase_orders'))).toBe(true);
  });
});
