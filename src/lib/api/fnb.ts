/** Majoo F&B Suite endpoint catalog (Open Bills, Table Management, Purchase Orders, Shift Closings) with offline localStorage fallback. */
import { apiFetch } from './client';
import type {
  OpenBill,
  OpenBillItem,
  OrderType,
  PurchaseOrder,
  PurchaseOrderItem,
  ShiftClosing,
} from '@/types';

const OPEN_BILLS_STORAGE_PREFIX = 'kaffepos:fnb:open-bills:';
const PURCHASE_ORDERS_STORAGE_PREFIX = 'kaffepos:fnb:purchase-orders:';
const SHIFT_CLOSINGS_STORAGE_PREFIX = 'kaffepos:fnb:shift-closings:';

function readLocalList<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocalList<T>(key: string, items: T[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

export async function getOpenBills(storeId: string): Promise<{ items: OpenBill[] }> {
  const storageKey = `${OPEN_BILLS_STORAGE_PREFIX}${storeId}`;
  try {
    const response = await apiFetch<{ items: OpenBill[] }>(
      `/api/fnb/open-bills?storeId=${encodeURIComponent(storeId)}`,
    );
    writeLocalList(storageKey, response.items);
    return response;
  } catch {
    return {
      items: readLocalList<OpenBill>(storageKey).filter((bill) => bill.status === 'open'),
    };
  }
}

export async function upsertOpenBill(payload: {
  id?: string;
  store_id: string;
  table_number?: string | null;
  order_type: OrderType;
  customer_name?: string | null;
  pax: number;
  items: OpenBillItem[];
  subtotal: number;
  discount?: number;
  discount_label?: string | null;
  tax?: number;
  service_charge?: number;
  total: number;
  note?: string | null;
  cashier?: string | null;
}): Promise<OpenBill> {
  const storageKey = `${OPEN_BILLS_STORAGE_PREFIX}${payload.store_id}`;
  try {
    const saved = await apiFetch<OpenBill>('/api/fnb/open-bills', {
      method: 'POST',
      json: payload,
    });
    const current = readLocalList<OpenBill>(storageKey).filter((b) => b.id !== saved.id);
    writeLocalList(storageKey, [saved, ...current]);
    return saved;
  } catch {
    const now = new Date().toISOString();
    const fallback: OpenBill = {
      id: payload.id || crypto.randomUUID(),
      store_id: payload.store_id,
      table_number: payload.table_number ?? null,
      order_type: payload.order_type,
      customer_name: payload.customer_name ?? null,
      pax: payload.pax,
      items: payload.items,
      subtotal: payload.subtotal,
      discount: payload.discount ?? 0,
      discount_label: payload.discount_label ?? null,
      tax: payload.tax ?? 0,
      service_charge: payload.service_charge ?? 0,
      total: payload.total,
      note: payload.note ?? null,
      cashier: payload.cashier ?? 'Kasir',
      status: 'open',
      created_at: now,
      updated_at: now,
    };
    const current = readLocalList<OpenBill>(storageKey).filter((b) => b.id !== fallback.id);
    writeLocalList(storageKey, [fallback, ...current]);
    return fallback;
  }
}

export async function updateOpenBill(
  id: string,
  payload: {
    store_id: string;
    table_number?: string | null;
    order_type?: OrderType;
    customer_name?: string | null;
    pax?: number;
    items?: OpenBillItem[];
    subtotal?: number;
    discount?: number;
    discount_label?: string | null;
    tax?: number;
    service_charge?: number;
    total?: number;
    note?: string | null;
    status?: 'open' | 'paid' | 'cancelled' | 'merged';
  },
): Promise<OpenBill> {
  const storageKey = `${OPEN_BILLS_STORAGE_PREFIX}${payload.store_id}`;
  try {
    const updated = await apiFetch<OpenBill>(`/api/fnb/open-bills/${id}`, {
      method: 'PATCH',
      json: payload,
    });
    const current = readLocalList<OpenBill>(storageKey).map((b) => (b.id === id ? updated : b));
    writeLocalList(storageKey, current.filter((b) => b.status === 'open'));
    return updated;
  } catch {
    const current = readLocalList<OpenBill>(storageKey);
    const existing = current.find((b) => b.id === id);
    const now = new Date().toISOString();
    const updated: OpenBill = {
      id,
      store_id: payload.store_id,
      table_number: payload.table_number !== undefined ? payload.table_number : (existing?.table_number ?? null),
      order_type: payload.order_type ?? existing?.order_type ?? 'dine_in',
      customer_name: payload.customer_name !== undefined ? payload.customer_name : (existing?.customer_name ?? null),
      pax: payload.pax ?? existing?.pax ?? 1,
      items: payload.items ?? existing?.items ?? [],
      subtotal: payload.subtotal ?? existing?.subtotal ?? 0,
      discount: payload.discount ?? existing?.discount ?? 0,
      discount_label: payload.discount_label !== undefined ? payload.discount_label : (existing?.discount_label ?? null),
      tax: payload.tax ?? existing?.tax ?? 0,
      service_charge: payload.service_charge ?? existing?.service_charge ?? 0,
      total: payload.total ?? existing?.total ?? 0,
      note: payload.note !== undefined ? payload.note : (existing?.note ?? null),
      cashier: existing?.cashier ?? 'Kasir',
      status: payload.status ?? existing?.status ?? 'open',
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    const nextList = current.map((b) => (b.id === id ? updated : b)).filter((b) => b.status === 'open');
    writeLocalList(storageKey, nextList);
    return updated;
  }
}

export async function getPurchaseOrders(storeId: string): Promise<{ items: PurchaseOrder[] }> {
  const storageKey = `${PURCHASE_ORDERS_STORAGE_PREFIX}${storeId}`;
  try {
    const response = await apiFetch<{ items: PurchaseOrder[] }>(
      `/api/fnb/purchase-orders?storeId=${encodeURIComponent(storeId)}`,
    );
    writeLocalList(storageKey, response.items);
    return response;
  } catch {
    return { items: readLocalList<PurchaseOrder>(storageKey) };
  }
}

export async function createPurchaseOrder(payload: {
  id?: string;
  store_id: string;
  po_number: string;
  supplier_name: string;
  status?: 'draft' | 'ordered' | 'received' | 'cancelled';
  items: PurchaseOrderItem[];
  total_amount: number;
  notes?: string | null;
}): Promise<PurchaseOrder> {
  const storageKey = `${PURCHASE_ORDERS_STORAGE_PREFIX}${payload.store_id}`;
  try {
    const saved = await apiFetch<PurchaseOrder>('/api/fnb/purchase-orders', {
      method: 'POST',
      json: payload,
    });
    const current = readLocalList<PurchaseOrder>(storageKey).filter((po) => po.id !== saved.id);
    writeLocalList(storageKey, [saved, ...current]);
    return saved;
  } catch {
    const now = new Date().toISOString();
    const fallback: PurchaseOrder = {
      id: payload.id || crypto.randomUUID(),
      store_id: payload.store_id,
      po_number: payload.po_number,
      supplier_name: payload.supplier_name,
      status: payload.status ?? 'ordered',
      items: payload.items,
      total_amount: payload.total_amount,
      notes: payload.notes ?? null,
      ordered_at: now,
      received_at: payload.status === 'received' ? now : null,
      created_at: now,
      updated_at: now,
    };
    const current = readLocalList<PurchaseOrder>(storageKey).filter((po) => po.id !== fallback.id);
    writeLocalList(storageKey, [fallback, ...current]);
    return fallback;
  }
}

export async function receivePurchaseOrder(id: string, storeId: string): Promise<PurchaseOrder> {
  const storageKey = `${PURCHASE_ORDERS_STORAGE_PREFIX}${storeId}`;
  try {
    const updated = await apiFetch<PurchaseOrder>(`/api/fnb/purchase-orders/${id}/receive`, {
      method: 'POST',
      json: { store_id: storeId },
    });
    const current = readLocalList<PurchaseOrder>(storageKey).map((po) => (po.id === id ? updated : po));
    writeLocalList(storageKey, current);
    return updated;
  } catch {
    const now = new Date().toISOString();
    const current = readLocalList<PurchaseOrder>(storageKey);
    const existing = current.find((po) => po.id === id);
    if (!existing) throw new Error('PO tidak ditemukan');
    const updated: PurchaseOrder = {
      ...existing,
      status: 'received',
      received_at: now,
      updated_at: now,
    };
    writeLocalList(
      storageKey,
      current.map((po) => (po.id === id ? updated : po)),
    );
    return updated;
  }
}

export async function getShiftClosings(storeId: string): Promise<{ items: ShiftClosing[] }> {
  const storageKey = `${SHIFT_CLOSINGS_STORAGE_PREFIX}${storeId}`;
  try {
    const response = await apiFetch<{ items: ShiftClosing[] }>(
      `/api/fnb/shift-closings?storeId=${encodeURIComponent(storeId)}`,
    );
    writeLocalList(storageKey, response.items);
    return response;
  } catch {
    return { items: readLocalList<ShiftClosing>(storageKey) };
  }
}

export async function createShiftClosing(payload: {
  id?: string;
  store_id: string;
  cashier_name: string;
  opened_at?: string;
  opening_cash: number;
  expected_cash: number;
  actual_cash: number;
  variance: number;
  total_sales: number;
  total_non_cash: number;
  cash_in: number;
  cash_out: number;
  transactions_count: number;
  notes?: string | null;
}): Promise<ShiftClosing> {
  const storageKey = `${SHIFT_CLOSINGS_STORAGE_PREFIX}${payload.store_id}`;
  try {
    const saved = await apiFetch<ShiftClosing>('/api/fnb/shift-closings', {
      method: 'POST',
      json: payload,
    });
    const current = readLocalList<ShiftClosing>(storageKey).filter((s) => s.id !== saved.id);
    writeLocalList(storageKey, [saved, ...current]);
    return saved;
  } catch {
    const now = new Date().toISOString();
    const fallback: ShiftClosing = {
      id: payload.id || crypto.randomUUID(),
      store_id: payload.store_id,
      cashier_name: payload.cashier_name,
      opened_at: payload.opened_at ?? now,
      closed_at: now,
      opening_cash: payload.opening_cash,
      expected_cash: payload.expected_cash,
      actual_cash: payload.actual_cash,
      variance: payload.variance,
      total_sales: payload.total_sales,
      total_non_cash: payload.total_non_cash,
      cash_in: payload.cash_in,
      cash_out: payload.cash_out,
      transactions_count: payload.transactions_count,
      notes: payload.notes ?? null,
      created_at: now,
    };
    const current = readLocalList<ShiftClosing>(storageKey).filter((s) => s.id !== fallback.id);
    writeLocalList(storageKey, [fallback, ...current]);
    return fallback;
  }
}
