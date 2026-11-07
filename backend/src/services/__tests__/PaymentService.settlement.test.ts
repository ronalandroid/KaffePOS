/**
 * PaymentService settlement money-path tests — finalizePaidOrder + void.
 * These are the functions that deduct/restore stock and create/void the sale; they were at
 * 0% real coverage. Tests call the static methods directly with a mocked PoolClient.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

vi.mock('../../core', async () => {
  const actual = await vi.importActual('../../core');
  return { ...actual, log: vi.fn() };
});

import { PaymentService } from '../PaymentService';

const storeId = randomUUID();

function makeClient(queue: Array<{ rows: unknown[] }>) {
  const query = vi.fn();
  for (const result of queue) query.mockResolvedValueOnce(result);
  query.mockResolvedValue({ rows: [] });
  return { query, release: vi.fn() };
}

describe('PaymentService.finalizePaidOrder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is idempotent: a paid order already linked to a transaction is not re-finalized', async () => {
    const client = makeClient([]);
    const paymentOrder = { id: 'po-1', store_id: storeId, transaction_id: 'tx-existing' } as any;

    const result = await PaymentService.finalizePaidOrder(client as any, paymentOrder, { paidAt: new Date().toISOString() });

    expect(result.transactionId).toBe('tx-existing');
    expect((result as any).replayed).toBe(true);
    // Only the payment_orders status update runs — never a duplicate transaction insert.
    const insertedTx = client.query.mock.calls.some((c) => /insert into public\.transactions/i.test(String(c[0])));
    expect(insertedTx).toBe(false);
  });

  it('rejects a paid order with no items (no silent empty sale)', async () => {
    const client = makeClient([]);
    const paymentOrder = { id: 'po-2', store_id: storeId, transaction_id: null, items: [] } as any;

    await expect(
      PaymentService.finalizePaidOrder(client as any, paymentOrder, { paidAt: new Date().toISOString() }),
    ).rejects.toThrow();
  });
});

describe('PaymentService.voidCompletedOrderTransaction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is a no-op when the order has no transaction', async () => {
    const client = makeClient([]);
    const result = await PaymentService.voidCompletedOrderTransaction(
      client as any,
      { id: 'po-3', store_id: storeId, transaction_id: null } as any,
      'refund',
    );
    expect(result).toBeNull();
    expect(client.query).not.toHaveBeenCalled();
  });

  it('does not double-restore stock for an already-void transaction', async () => {
    const client = makeClient([{ rows: [{ id: 'tx-1', store_id: storeId, is_void: true }] }]);
    await PaymentService.voidCompletedOrderTransaction(
      client as any,
      { id: 'po-4', store_id: storeId, transaction_id: 'tx-1' } as any,
      'refund',
    );
    const restored = client.query.mock.calls.some((c) => /update public\.inventory set stock/i.test(String(c[0])));
    expect(restored).toBe(false);
  });

  it('restores stock by abs(qty_delta) for each sale audit row', async () => {
    const client = makeClient([
      { rows: [{ id: 'tx-1', store_id: storeId, is_void: false }] },        // lock transaction
      { rows: [{ inventory_id: 'inv-1', qty_delta: -3 }] },                  // sale audits
      { rows: [{ id: 'inv-1', store_id: storeId, stock: 10 }] },            // lock inventory
    ]);

    await PaymentService.voidCompletedOrderTransaction(
      client as any,
      { id: 'po-5', store_id: storeId, transaction_id: 'tx-1' } as any,
      'refund',
    );

    const restoreCall = client.query.mock.calls.find((c) => /update public\.inventory set stock/i.test(String(c[0])));
    expect(restoreCall).toBeDefined();
    // stockBefore 10 + abs(-3) = 13, restored onto inv-1
    expect(restoreCall![1]).toEqual([13, 'inv-1']);
  });
});
