/**
 * FnbService — Stateless Domain Service for POS Order & Warehouse PO Bounded Contexts.
 *
 * Handles Open Bills (Floor Plan, Move/Merge Table, Split Bill),
 * Supplier Purchase Orders (PO & Stock Receiving), and Cashier Shift Closings.
 * Publishes domain events to `domainEventBus` for cross-service cache invalidation
 * and audit choreography.
 */
import { randomUUID } from 'node:crypto';
import {
  ApiError,
  assertStoreOwned,
  toNumber,
  withTransaction,
} from '../core';
import { cache } from '../lib/cache';
import { domainEventBus } from '../architecture/eventBus';

export function normalizeOpenBill(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    store_id: String(row.store_id),
    table_number: row.table_number == null ? null : String(row.table_number),
    order_type: String(row.order_type ?? 'dine_in'),
    customer_name: row.customer_name == null ? null : String(row.customer_name),
    pax: Math.max(1, Math.round(toNumber(row.pax) || 1)),
    items: Array.isArray(row.items) ? row.items : [],
    subtotal: toNumber(row.subtotal),
    discount: toNumber(row.discount),
    discount_label: row.discount_label == null ? null : String(row.discount_label),
    tax: toNumber(row.tax),
    service_charge: toNumber(row.service_charge),
    total: toNumber(row.total),
    note: row.note == null ? null : String(row.note),
    cashier: row.cashier == null ? null : String(row.cashier),
    status: String(row.status ?? 'open'),
    created_at: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    updated_at: row.updated_at ? new Date(String(row.updated_at)).toISOString() : new Date().toISOString(),
  };
}

export function normalizePurchaseOrder(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    store_id: String(row.store_id),
    po_number: String(row.po_number ?? ''),
    supplier_name: String(row.supplier_name ?? ''),
    status: String(row.status ?? 'ordered'),
    items: Array.isArray(row.items) ? row.items : [],
    total_amount: toNumber(row.total_amount),
    notes: row.notes == null ? null : String(row.notes),
    ordered_at: row.ordered_at ? new Date(String(row.ordered_at)).toISOString() : new Date().toISOString(),
    received_at: row.received_at ? new Date(String(row.received_at)).toISOString() : null,
    created_by: row.created_by == null ? null : String(row.created_by),
    created_at: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    updated_at: row.updated_at ? new Date(String(row.updated_at)).toISOString() : new Date().toISOString(),
  };
}

export function normalizeShiftClosing(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    store_id: String(row.store_id),
    cashier_id: row.cashier_id == null ? null : String(row.cashier_id),
    cashier_name: String(row.cashier_name ?? 'Kasir'),
    opened_at: row.opened_at ? new Date(String(row.opened_at)).toISOString() : new Date().toISOString(),
    closed_at: row.closed_at ? new Date(String(row.closed_at)).toISOString() : new Date().toISOString(),
    opening_cash: toNumber(row.opening_cash),
    expected_cash: toNumber(row.expected_cash),
    actual_cash: toNumber(row.actual_cash),
    variance: toNumber(row.variance),
    total_sales: toNumber(row.total_sales),
    total_non_cash: toNumber(row.total_non_cash),
    cash_in: toNumber(row.cash_in),
    cash_out: toNumber(row.cash_out),
    transactions_count: Math.max(0, Math.round(toNumber(row.transactions_count))),
    notes: row.notes == null ? null : String(row.notes),
    created_at: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
  };
}

export class FnbService {
  static async listOpenBills(storeId: string, userId: string) {
    const cacheKey = `open-bills:${storeId}`;
    const cached = cache.get<ReturnType<typeof normalizeOpenBill>[]>(cacheKey);
    if (cached) return cached;

    const result = await withTransaction(async (client) => {
      await assertStoreOwned(client, storeId, userId);
      return client.query(
        'select * from public.open_bills where store_id = $1 and status = $2 order by updated_at desc',
        [storeId, 'open'],
      );
    });

    const items = result.rows.map(normalizeOpenBill);
    cache.set(cacheKey, items, 15_000);
    return items;
  }

  static async upsertOpenBill(payload: {
    id?: string | undefined;
    store_id: string;
    table_number?: string | null | undefined;
    order_type: string;
    customer_name?: string | null | undefined;
    pax: number;
    items: unknown[];
    subtotal: number;
    discount: number;
    discount_label?: string | null | undefined;
    tax: number;
    service_charge: number;
    total: number;
    note?: string | null | undefined;
    cashier?: string | null | undefined;
  }, userId: string) {
    const billId = payload.id ?? randomUUID();

    const row = await withTransaction(async (client) => {
      await assertStoreOwned(client, payload.store_id, userId);
      const result = await client.query(
        `
          insert into public.open_bills (
            id,
            store_id,
            table_number,
            order_type,
            customer_name,
            pax,
            items,
            subtotal,
            discount,
            discount_label,
            tax,
            service_charge,
            total,
            note,
            cashier,
            status,
            created_at,
            updated_at
          ) values (
            $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15, 'open', now(), now()
          )
          on conflict (id) do update set
            table_number = excluded.table_number,
            order_type = excluded.order_type,
            customer_name = excluded.customer_name,
            pax = excluded.pax,
            items = excluded.items,
            subtotal = excluded.subtotal,
            discount = excluded.discount,
            discount_label = excluded.discount_label,
            tax = excluded.tax,
            service_charge = excluded.service_charge,
            total = excluded.total,
            note = excluded.note,
            cashier = excluded.cashier,
            status = 'open',
            updated_at = now()
          returning *
        `,
        [
          billId,
          payload.store_id,
          payload.table_number ?? null,
          payload.order_type,
          payload.customer_name ?? null,
          payload.pax,
          JSON.stringify(payload.items),
          Math.round(payload.subtotal),
          Math.round(payload.discount),
          payload.discount_label ?? null,
          Math.round(payload.tax),
          Math.round(payload.service_charge),
          Math.round(payload.total),
          payload.note ?? null,
          payload.cashier ?? null,
        ],
      );
      return result.rows[0];
    });

    const normalized = normalizeOpenBill(row);
    domainEventBus.publish({
      name: 'open_bill.saved',
      boundedContext: 'pos-order-service',
      storeId: payload.store_id,
      actorId: userId,
      payload: { billId: normalized.id, tableNumber: normalized.table_number, total: normalized.total },
    });
    return normalized;
  }

  static async updateOpenBill(
    billId: string,
    payload: {
      store_id: string;
      table_number?: string | null | undefined;
      order_type?: string | undefined;
      customer_name?: string | null | undefined;
      pax?: number | undefined;
      items?: unknown[] | undefined;
      subtotal?: number | undefined;
      discount?: number | undefined;
      discount_label?: string | null | undefined;
      tax?: number | undefined;
      service_charge?: number | undefined;
      total?: number | undefined;
      note?: string | null | undefined;
      status?: string | undefined;
    },
    userId: string,
  ) {
    const row = await withTransaction(async (client) => {
      await assertStoreOwned(client, payload.store_id, userId);
      const current = await client.query(
        'select * from public.open_bills where id = $1 and store_id = $2 for update',
        [billId, payload.store_id],
      );
      if (!current.rows[0]) {
        throw new ApiError(404, 'Open bill tidak ditemukan.');
      }

      const existing = current.rows[0];
      const updated = await client.query(
        `
          update public.open_bills
          set
            table_number = $1,
            order_type = $2,
            customer_name = $3,
            pax = $4,
            items = $5::jsonb,
            subtotal = $6,
            discount = $7,
            discount_label = $8,
            tax = $9,
            service_charge = $10,
            total = $11,
            note = $12,
            status = $13,
            updated_at = now()
          where id = $14 and store_id = $15
          returning *
        `,
        [
          payload.table_number !== undefined ? payload.table_number : existing.table_number,
          payload.order_type ?? existing.order_type,
          payload.customer_name !== undefined ? payload.customer_name : existing.customer_name,
          payload.pax ?? existing.pax,
          JSON.stringify(payload.items ?? existing.items),
          Math.round(payload.subtotal ?? toNumber(existing.subtotal)),
          Math.round(payload.discount ?? toNumber(existing.discount)),
          payload.discount_label !== undefined ? payload.discount_label : existing.discount_label,
          Math.round(payload.tax ?? toNumber(existing.tax)),
          Math.round(payload.service_charge ?? toNumber(existing.service_charge)),
          Math.round(payload.total ?? toNumber(existing.total)),
          payload.note !== undefined ? payload.note : existing.note,
          payload.status ?? existing.status,
          billId,
          payload.store_id,
        ],
      );
      return updated.rows[0];
    });

    const normalized = normalizeOpenBill(row);
    domainEventBus.publish({
      name: 'open_bill.updated',
      boundedContext: 'pos-order-service',
      storeId: payload.store_id,
      actorId: userId,
      payload: { billId: normalized.id, status: normalized.status, tableNumber: normalized.table_number },
    });
    return normalized;
  }

  static async listPurchaseOrders(storeId: string, userId: string) {
    const result = await withTransaction(async (client) => {
      await assertStoreOwned(client, storeId, userId);
      return client.query(
        'select * from public.purchase_orders where store_id = $1 order by created_at desc limit 200',
        [storeId],
      );
    });
    return result.rows.map(normalizePurchaseOrder);
  }

  static async createPurchaseOrder(
    payload: {
      id?: string | undefined;
      store_id: string;
      po_number: string;
      supplier_name: string;
      status: 'draft' | 'ordered' | 'received' | 'cancelled';
      items: Array<{
        inventory_id: string;
        name: string;
        qty: number;
        unit: string;
        cost_per_unit: number;
      }>;
      total_amount: number;
      notes?: string | null | undefined;
    },
    actor: { id: string; email: string | null },
  ) {
    const poId = payload.id ?? randomUUID();

    const row = await withTransaction(async (client) => {
      await assertStoreOwned(client, payload.store_id, actor.id);

      const receivedAt = payload.status === 'received' ? new Date().toISOString() : null;
      const insertPo = await client.query(
        `
          insert into public.purchase_orders (
            id,
            store_id,
            po_number,
            supplier_name,
            status,
            items,
            total_amount,
            notes,
            ordered_at,
            received_at,
            created_by,
            created_at,
            updated_at
          ) values (
            $1, $2, $3, $4, $5, $6::jsonb, $7, $8, now(), $9::timestamptz, $10, now(), now()
          )
          returning *
        `,
        [
          poId,
          payload.store_id,
          payload.po_number,
          payload.supplier_name,
          payload.status,
          JSON.stringify(payload.items),
          Math.round(payload.total_amount),
          payload.notes ?? null,
          receivedAt,
          actor.email ?? actor.id,
        ],
      );

      if (payload.status === 'received') {
        for (const item of payload.items) {
          const invRes = await client.query(
            'select id, stock, cost_per_unit from public.inventory where id = $1 and store_id = $2 for update',
            [item.inventory_id, payload.store_id],
          );
          const inv = invRes.rows[0];
          if (!inv) continue;
          const stockBefore = toNumber(inv.stock);
          const stockAfter = stockBefore + item.qty;
          await client.query(
            'update public.inventory set stock = $1, cost_per_unit = $2, updated_at = now() where id = $3 and store_id = $4',
            [stockAfter, item.cost_per_unit > 0 ? item.cost_per_unit : toNumber(inv.cost_per_unit), inv.id, payload.store_id],
          );
        }
      }

      return insertPo.rows[0];
    });

    const normalized = normalizePurchaseOrder(row);
    domainEventBus.publish({
      name: payload.status === 'received' ? 'purchase_order.received' : 'purchase_order.created',
      boundedContext: 'inventory-po-service',
      storeId: payload.store_id,
      actorId: actor.id,
      payload: { poId: normalized.id, poNumber: normalized.po_number, status: normalized.status },
    });
    return normalized;
  }

  static async receivePurchaseOrder(poId: string, storeId: string, userId: string) {
    const row = await withTransaction(async (client) => {
      await assertStoreOwned(client, storeId, userId);

      const poRes = await client.query(
        'select * from public.purchase_orders where id = $1 and store_id = $2 for update',
        [poId, storeId],
      );
      const po = poRes.rows[0];
      if (!po) {
        throw new ApiError(404, 'Purchase Order tidak ditemukan.');
      }
      if (po.status === 'received') {
        return po;
      }

      const items = Array.isArray(po.items) ? po.items : [];
      for (const rawItem of items) {
        const inventoryId = String(rawItem?.inventory_id ?? '');
        const qty = Math.max(0, toNumber(rawItem?.qty));
        const costPerUnit = Math.max(0, toNumber(rawItem?.cost_per_unit));
        if (!inventoryId || qty <= 0) continue;

        const invRes = await client.query(
          'select id, stock, cost_per_unit from public.inventory where id = $1 and store_id = $2 for update',
          [inventoryId, storeId],
        );
        const inv = invRes.rows[0];
        if (!inv) continue;

        const stockBefore = toNumber(inv.stock);
        const stockAfter = stockBefore + qty;
        await client.query(
          'update public.inventory set stock = $1, cost_per_unit = $2, updated_at = now() where id = $3 and store_id = $4',
          [stockAfter, costPerUnit > 0 ? costPerUnit : toNumber(inv.cost_per_unit), inv.id, storeId],
        );
      }

      const updated = await client.query(
        'update public.purchase_orders set status = $1, received_at = now(), updated_at = now() where id = $2 and store_id = $3 returning *',
        ['received', poId, storeId],
      );
      return updated.rows[0];
    });

    const normalized = normalizePurchaseOrder(row);
    domainEventBus.publish({
      name: 'purchase_order.received',
      boundedContext: 'inventory-po-service',
      storeId,
      actorId: userId,
      payload: { poId: normalized.id, poNumber: normalized.po_number },
    });
    return normalized;
  }

  static async listShiftClosings(storeId: string, userId: string) {
    const result = await withTransaction(async (client) => {
      await assertStoreOwned(client, storeId, userId);
      return client.query(
        'select * from public.shift_closings where store_id = $1 order by closed_at desc limit 100',
        [storeId],
      );
    });
    return result.rows.map(normalizeShiftClosing);
  }

  static async createShiftClosing(
    payload: {
      id?: string | undefined;
      store_id: string;
      cashier_name: string;
      opened_at?: string | undefined;
      opening_cash: number;
      expected_cash: number;
      actual_cash: number;
      variance: number;
      total_sales: number;
      total_non_cash: number;
      cash_in: number;
      cash_out: number;
      transactions_count: number;
      notes?: string | null | undefined;
    },
    userId: string,
  ) {
    const shiftId = payload.id ?? randomUUID();

    const row = await withTransaction(async (client) => {
      await assertStoreOwned(client, payload.store_id, userId);
      const result = await client.query(
        `
          insert into public.shift_closings (
            id,
            store_id,
            cashier_id,
            cashier_name,
            opened_at,
            closed_at,
            opening_cash,
            expected_cash,
            actual_cash,
            variance,
            total_sales,
            total_non_cash,
            cash_in,
            cash_out,
            transactions_count,
            notes,
            created_at
          ) values (
            $1, $2, $3, $4, coalesce($5::timestamptz, now()), now(),
            $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now()
          )
          returning *
        `,
        [
          shiftId,
          payload.store_id,
          userId,
          payload.cashier_name,
          payload.opened_at ?? null,
          Math.round(payload.opening_cash),
          Math.round(payload.expected_cash),
          Math.round(payload.actual_cash),
          Math.round(payload.variance),
          Math.round(payload.total_sales),
          Math.round(payload.total_non_cash),
          Math.round(payload.cash_in),
          Math.round(payload.cash_out),
          payload.transactions_count,
          payload.notes ?? null,
        ],
      );
      return result.rows[0];
    });

    const normalized = normalizeShiftClosing(row);
    domainEventBus.publish({
      name: 'shift.closed',
      boundedContext: 'pos-order-service',
      storeId: payload.store_id,
      actorId: userId,
      payload: {
        shiftId: normalized.id,
        cashierName: normalized.cashier_name,
        variance: normalized.variance,
        totalSales: normalized.total_sales,
      },
    });
    return normalized;
  }
}
