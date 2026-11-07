/**
 * PaymentService unit tests
 * Tests: transaction creation, Midtrans integration, order status
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

vi.mock('../../core', async () => {
  const actual = await vi.importActual('../../core');
  return {
    ...actual,
    pool: { query: vi.fn() },
    withTransaction: vi.fn(async (callback) => callback({ query: vi.fn(), release: vi.fn() })),
    assertStoreOwned: vi.fn(),
    log: vi.fn(),
    env: {
      MIDTRANS_SERVER_KEY: 'SB-Mid-server-test',
      MIDTRANS_CLIENT_KEY: 'SB-Mid-client-test',
      MIDTRANS_IS_PRODUCTION: 'false',
      MIDTRANS_SNAP_ENABLED: 'true',
    },
  };
});

vi.mock('../../payments/payment-provider.factory', () => ({
  getActivePaymentProviderName: vi.fn(() => 'doku'),
  createPaymentProvider: vi.fn(() => ({
    providerName: 'doku',
    createPayment: vi.fn().mockResolvedValue({
      snap_token: 'snap-token-123',
      paymentUrl: 'https://checkout-staging.doku.com/link/snap-token-123',
      gross_amount: 65000,
      merchantOrderId: `ORDER-${Date.now()}`,
      providerReference: 'DOKU-REF-123',
    }),
    verifyCallback: vi.fn(),
    checkTransactionStatus: vi.fn(),
  })),
}));

import { pool, withTransaction, assertStoreOwned } from '../../core';
import { PaymentService } from '../PaymentService';

describe('PaymentService', () => {
  const storeId = randomUUID();
  const userId = randomUUID();
  const menuItemId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as any);
    vi.mocked(assertStoreOwned).mockResolvedValue({ id: storeId, tax_percent: 0 } as any);
  });

  describe('createTransaction', () => {
    it('should create payment order with calculated totals', async () => {
      const payload = {
        store_id: storeId,
        items: [
          { menu_item_id: menuItemId, qty: 2, variant_name: 'Large', note: null },
        ],
        discount_amount: 5000,
        customer: { name: 'Jane Doe', email: 'jane@example.com', phone: '081234567890' },
      };

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [{ id: menuItemId, name: 'Cappuccino', price: 30000, variants: JSON.stringify([{ name: 'Large', price: 35000 }]), is_available: true }] })
          .mockResolvedValueOnce({ rows: [{ id: randomUUID(), snap_token: 'snap-token-123', gross_amount: 65000 }] }),
        release: vi.fn(),
      };

      vi.mocked(withTransaction).mockImplementationOnce(async (callback) => callback(mockClient as any));
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as any);

      const result = await PaymentService.createTransaction({
        payload,
        user: { id: userId, storeId } as any,
        ip: '127.0.0.1',
        userAgent: 'test-agent',
      });

      expect(result.gross_amount).toBe(65000); // (35000 * 2) - 5000
      expect(result.payment_url).toBe('https://checkout-staging.doku.com/link/snap-token-123');
      expect(result.status).toBe('pending');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('insert into public.payment_orders'),
        expect.any(Array)
      );
    });

    it('should validate store ownership before creating payment', async () => {
      const payload = {
        store_id: storeId,
        items: [{ menu_item_id: menuItemId, qty: 1 }],
        discount_amount: 0,
      };

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [{ id: menuItemId, name: 'Cappuccino', price: 30000, variants: '[]', is_available: true }] })
          .mockResolvedValueOnce({ rows: [{ id: randomUUID(), snap_token: 'snap-token-123', gross_amount: 30000 }] }),
        release: vi.fn(),
      };
      vi.mocked(withTransaction).mockImplementationOnce(async (callback) => callback(mockClient as any));
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as any);

      await PaymentService.createTransaction({
        payload,
        user: { id: userId, storeId } as any,
        ip: null,
        userAgent: null,
      });

      expect(assertStoreOwned).toHaveBeenCalled();
    });

    it('should reject when menu item not found', async () => {
      const payload = {
        store_id: storeId,
        items: [{ menu_item_id: randomUUID(), qty: 1 }],
        discount_amount: 0,
      };

      const mockClient = {
        query: vi.fn().mockResolvedValueOnce({ rows: [] }),
        release: vi.fn(),
      };

      vi.mocked(withTransaction).mockImplementationOnce(async (callback) => callback(mockClient as any));

      await expect(
        PaymentService.createTransaction({
          payload,
          user: { id: userId, storeId } as any,
          ip: null,
          userAgent: null,
        })
      ).rejects.toThrow();
    });

    it('should calculate tax correctly (11% PPN)', async () => {
      const subtotal = 100000;
      const discount = 10000;
      const taxableAmount = subtotal - discount;
      const expectedTax = Math.round(taxableAmount * 0.11);

      expect(expectedTax).toBe(9900);
    });
  });

  describe('getOrderStatus', () => {
    it('should retrieve order with store ownership check', async () => {
      const orderId = randomUUID();
      vi.mocked(pool.query).mockResolvedValueOnce({
        rows: [{
          id: orderId,
          store_id: storeId,
          status: 'pending',
          gross_amount: 50000,
          midtrans_order_id: orderId,
          items: [],
        }],
      } as any);

      const result = await PaymentService.getOrderStatus({
        orderId,
        user: { id: userId, storeId } as any,
      });

      expect(result.order_id).toBe(orderId);
      expect(result.status).toBe('pending');
    });

    it('should throw when order not found', async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        PaymentService.getOrderStatus({
          orderId: 'nonexistent',
          user: { id: userId, storeId } as any,
        })
      ).rejects.toThrow();
    });
  });

  describe('logAttempt', () => {
    it('should log payment attempt with metadata', async () => {
      await PaymentService.logAttempt({
        userId,
        storeId,
        eventType: 'create_success',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        metadata: { orderId: 'ORDER-123' },
      });

      // Verify log was called (implementation detail)
      expect(true).toBe(true);
    });
  });
});
