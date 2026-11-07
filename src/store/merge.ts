// src/store/merge.ts — pure sort/merge/id helpers shared across store slices.
import type { KitchenOrder } from '@/types';

export function makeUniqueTransactionId(preferredId?: string, existingIds: string[] = []) {
  const baseId = preferredId?.trim() || `trx_${Date.now()}`;
  if (!existingIds.includes(baseId)) return baseId;
  const isoCleanupPattern = ['[', '-', ':', '.', 'T', 'Z', ']'].join('');
  const suffix = new Date().toISOString().replace(new RegExp(isoCleanupPattern, 'g'), '').slice(-8);
  let nextId = `${baseId}-${suffix}`;
  let attempt = 1;
  while (existingIds.includes(nextId)) {
    nextId = `${baseId}-${suffix}-${attempt}`;
    attempt += 1;
  }
  return nextId;
}

export function sortByDateDesc<T extends { date?: string; created_at?: string }>(items: T[]) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.date || a.created_at || 0).getTime();
    const bTime = new Date(b.date || b.created_at || 0).getTime();
    return bTime - aTime;
  });
}

export function mergeById<T extends { id: string; date?: string; created_at?: string }>(
  remoteItems: T[],
  localItems: T[],
) {
  const merged = new Map<string, T>();

  for (const item of localItems) {
    merged.set(item.id, item);
  }
  for (const item of remoteItems) {
    merged.set(item.id, item);
  }

  return sortByDateDesc(Array.from(merged.values()));
}

export function sortKitchenOrders(orders: KitchenOrder[]) {
  return [...orders].sort((a, b) => {
    const statusWeight: Record<string, number> = { pending: 0, preparing: 1, ready: 2, served: 3, completed: 3, cancelled: 4 };
    const statusDiff = (statusWeight[a.overall_status] ?? 9) - (statusWeight[b.overall_status] ?? 9);
    if (statusDiff !== 0) return statusDiff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export function isKitchenOrderNewer(next: KitchenOrder, current?: KitchenOrder) {
  if (!current) return true;
  if ((next.status_version ?? 0) !== (current.status_version ?? 0)) {
    return (next.status_version ?? 0) >= (current.status_version ?? 0);
  }
  return new Date(next.updated_at || next.created_at).getTime() >= new Date(current.updated_at || current.created_at).getTime();
}

export function mergeKitchenOrder(orders: KitchenOrder[], order: KitchenOrder) {
  const existing = orders.find((entry) => entry.id === order.id);
  if (existing && !isKitchenOrderNewer(order, existing)) {
    return orders;
  }
  const merged = existing
    ? orders.map((entry) => entry.id === order.id ? order : entry)
    : [order, ...orders];
  const active = merged.filter((entry) => !['served', 'completed', 'cancelled'].includes(entry.overall_status));
  return sortKitchenOrders(active);
}
