import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

vi.mock('../../core', async () => {
  const actual = await vi.importActual('../../core');
  return {
    ...actual,
    pool: { query: vi.fn() },
    withTransaction: vi.fn(async (callback) => callback({ query: vi.fn(), release: vi.fn() })),
    assertStoreOwned: vi.fn(),
    normalizeTransaction: vi.fn((row) => row),
    transactionColumns: '*',
    inventoryColumns: '*',
    kitchenOrderColumns: '*',
    fetchKitchenOrder: vi.fn().mockResolvedValue(null),
    insertKitchenEvent: vi.fn(),
    createKitchenOrderFromTransaction: vi.fn().mockResolvedValue({ id: randomUUID() }),
    insertNotification: vi.fn(),
    log: vi.fn(),
    serializeError: vi.fn((e: unknown) => String(e)),
    toNumber: vi.fn((v: unknown) => Number(v)),
    buildUpdateClause: vi.fn().mockReturnValue({ clause: 'x = $1', values: ['v'] }),
  };
});

vi.mock('../../routes/challenges', () => ({
  checkChallengeCompletionForUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/stockEngine', () => ({
  convertRecipeQuantityToBase: vi.fn().mockReturnValue(0),
}));

import { withTransaction, assertStoreOwned, log } from '../../core';
import { checkChallengeCompletionForUser } from '../../routes/challenges';

describe('TransactionService', () => {
  const storeId = randomUUID();
  const userId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkout transaction atomicity', () => {
    it('commits the transaction even when challenge check throws', async () => {
      vi.mocked(checkChallengeCompletionForUser).mockRejectedValueOnce(new Error('challenge service down'));

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ id: randomUUID() }] })
          .mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      };
      vi.mocked(withTransaction).mockImplementationOnce(async (callback) => callback(mockClient as any));

      const { TransactionService } = await import('../TransactionService');

      const payload = {
        id: randomUUID(),
        store_id: storeId,
        items: [],
        subtotal: 10000,
        discount: 0,
        tax: 0,
        paid: 10000,
        cashier: 'Budi',
        method: 'cash',
        date: new Date().toISOString(),
      };

      const authUser = { id: userId, email: null };

      await expect(TransactionService.checkout(payload, authUser)).resolves.not.toThrow();
      expect(log).toHaveBeenCalledWith('warn', 'transaction.challenge_check_failed', expect.any(Object));
    });

    it('resolves with transaction data on successful checkout', async () => {
      const txId = randomUUID();
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ id: txId, store_id: storeId }] })
          .mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      };
      vi.mocked(withTransaction).mockImplementationOnce(async (callback) => callback(mockClient as any));

      const { TransactionService } = await import('../TransactionService');

      const payload = {
        id: txId,
        store_id: storeId,
        items: [],
        subtotal: 20000,
        discount: 0,
        tax: 0,
        paid: 20000,
        cashier: 'Ana',
        method: 'cash',
        date: new Date().toISOString(),
      };

      const result = await TransactionService.checkout(payload, { id: userId, email: null });
      expect(result).toBeDefined();
    });

    it('calls assertStoreOwned to verify store ownership before checkout', async () => {
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [{ id: 'existing-tx' }] })
          .mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      };
      vi.mocked(withTransaction).mockImplementationOnce(async (callback) => callback(mockClient as any));
      vi.mocked(assertStoreOwned).mockResolvedValue({ id: storeId } as any);

      const { TransactionService } = await import('../TransactionService');

      const payload = {
        id: randomUUID(),
        store_id: storeId,
        items: [],
        subtotal: 0,
        discount: 0,
        tax: 0,
        paid: 0,
        cashier: 'Budi',
        method: 'cash',
        date: new Date().toISOString(),
      };

      await TransactionService.checkout(payload, { id: userId, email: null });

      expect(assertStoreOwned).toHaveBeenCalledWith(mockClient, storeId, userId);
    });
  });

  describe('listTransactions', () => {
    it('returns empty list when no transactions exist', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      };
      vi.mocked(withTransaction).mockImplementationOnce(async (callback) => callback(mockClient as any));

      const { TransactionService } = await import('../TransactionService');
      const result = await TransactionService.listTransactions(storeId, userId, { limit: 50, offset: 0 });

      expect(result).toEqual([]);
      expect(assertStoreOwned).toHaveBeenCalledWith(mockClient, storeId, userId);
    });
  });

  describe('getStaffPerformance', () => {
    it('maps the SQL aggregate into personal and team lifetime buckets', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({
          rows: [{ personal_points: 80, personal_transactions: 5, team_points: 200, team_transactions: 12 }],
        }),
        release: vi.fn(),
      };
      vi.mocked(withTransaction).mockImplementationOnce(async (callback) => callback(mockClient as any));

      const { TransactionService } = await import('../TransactionService');
      const result = await TransactionService.getStaffPerformance(storeId, userId, 'Budi');

      expect(result).toEqual({
        personal: { points: 80, transactions: 5 },
        team: { points: 200, transactions: 12 },
      });
      expect(assertStoreOwned).toHaveBeenCalledWith(mockClient, storeId, userId);
    });

    it('returns zeroes when the store has no transactions', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [{ personal_points: 0, personal_transactions: 0, team_points: 0, team_transactions: 0 }] }),
        release: vi.fn(),
      };
      vi.mocked(withTransaction).mockImplementationOnce(async (callback) => callback(mockClient as any));

      const { TransactionService } = await import('../TransactionService');
      const result = await TransactionService.getStaffPerformance(storeId, userId, 'Nobody');

      expect(result).toEqual({ personal: { points: 0, transactions: 0 }, team: { points: 0, transactions: 0 } });
    });
  });
});
