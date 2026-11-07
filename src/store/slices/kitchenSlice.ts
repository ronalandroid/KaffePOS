// src/store/slices/kitchenSlice.ts — kitchen orders, realtime subscription, and
// optimistic kitchen status updates with offline-queue fallback.
import {
  getKitchenOrders,
  subscribeKitchenEvents,
  updateKitchenItemStatus,
  updateKitchenOrderStatus,
} from '@/lib/backendApi';
import { enqueueOfflineOperation } from '@/lib/offlineQueue';
import type { KitchenOrder } from '@/types';
import type { AppSlice, KitchenSlice } from '../types';
import { saveKitchenToLS } from '../cache';
import { mergeKitchenOrder, sortKitchenOrders } from '../merge';
import { updateSyncIndicators } from '../sync';
import { initialState } from '../defaults';

// ── Kitchen realtime singletons (module-scoped, shared across the store) ──
let kitchenRealtimeCleanup: (() => void) | null = null;
let kitchenReconnectTimer: ReturnType<typeof setTimeout> | null = null;
const seenKitchenEventIds = new Set<string>();

export const createKitchenSlice: AppSlice<KitchenSlice> = (set, get) => ({
  kitchenOrders:         initialState.kitchenOrders,
  kitchenRealtimeStatus: initialState.kitchenRealtimeStatus,

  cleanup: () => {
    if (kitchenRealtimeCleanup) {
      kitchenRealtimeCleanup();
      kitchenRealtimeCleanup = null;
    }
    if (kitchenReconnectTimer) {
      clearTimeout(kitchenReconnectTimer);
      kitchenReconnectTimer = null;
    }
    seenKitchenEventIds.clear();
  },

  loadKitchenOrders: async (storeIdArg) => {
    const storeId = storeIdArg || get().storeId;
    if (!storeId) return;
    try {
      const response = await getKitchenOrders(storeId);
      const orders = sortKitchenOrders((response.items || []) as KitchenOrder[]);
      set({ kitchenOrders: orders });
      saveKitchenToLS(storeId, orders);
    } catch (error) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        set({ kitchenRealtimeStatus: 'offline' });
        return;
      }
      set({ kitchenRealtimeStatus: 'error' });
      throw error;
    }
  },

  connectKitchenRealtime: (storeIdArg) => {
    const storeId = storeIdArg || get().storeId;
    if (!storeId) return;
    if (kitchenRealtimeCleanup) return;

    kitchenRealtimeCleanup = subscribeKitchenEvents({
      storeId,
      onStatus: (status) => set({ kitchenRealtimeStatus: status }),
      onEvent: (event) => get().applyKitchenEvent(event),
      onError: () => {
        get().loadKitchenOrders(storeId).catch(() => {});
      },
    });
  },

  applyKitchenEvent: (event) => {
    const storeId = get().storeId;
    if (!storeId || event.store_id !== storeId) return;
    if (seenKitchenEventIds.has(event.id)) return;
    seenKitchenEventIds.add(event.id);
    if (seenKitchenEventIds.size > 500) {
      const oldest = seenKitchenEventIds.values().next().value;
      if (oldest) seenKitchenEventIds.delete(oldest);
    }

    if (event.type === 'snapshot_required') {
      get().loadKitchenOrders(storeId).catch(() => {});
      return;
    }

    const order = event.payload?.order || null;
    if (!order) {
      get().loadKitchenOrders(storeId).catch(() => {});
      return;
    }

    set((state) => {
      const nextOrders = mergeKitchenOrder(state.kitchenOrders, order);
      saveKitchenToLS(storeId, nextOrders);
      return { kitchenOrders: nextOrders };
    });
  },

  updateKitchenOrder: async (id, status, reason) => {
    const storeId = get().storeId;
    if (!storeId) throw new Error('Store belum dimuat.');
    if (!get().isOnline) {
      let optimisticOrder: KitchenOrder | null = null;
      set(s => {
        const nextOrders = s.kitchenOrders.map((order) => {
          if (order.id !== id) return order;
          optimisticOrder = {
            ...order,
            overall_status: status,
            status_version: (order.status_version || 0) + 1,
            updated_at: new Date().toISOString(),
          };
          return optimisticOrder;
        });
        saveKitchenToLS(storeId, nextOrders);
        return { kitchenOrders: nextOrders };
      });
      await enqueueOfflineOperation(storeId, {
        operation: 'kitchen.order.update',
        payload: { id, store_id: storeId, status, reason: reason ?? null },
        idempotencyKey: `kitchen-order:${id}:${status}:${Date.now()}`,
      });
      await updateSyncIndicators(storeId);
      if (optimisticOrder) return optimisticOrder;
      throw new Error('Order dapur tidak ditemukan.');
    }
    const data = await updateKitchenOrderStatus(id, {
      store_id: storeId,
      status,
      reason: reason ?? null,
    });
    const order = data as KitchenOrder;
    set(s => {
      const nextOrders = mergeKitchenOrder(s.kitchenOrders, order);
      saveKitchenToLS(storeId, nextOrders);
      return { kitchenOrders: nextOrders };
    });
    return order;
  },

  updateKitchenItem: async (id, status) => {
    const storeId = get().storeId;
    if (!storeId) throw new Error('Store belum dimuat.');
    if (!get().isOnline) {
      let optimisticOrder: KitchenOrder | null = null;
      set(s => {
        const nextOrders = s.kitchenOrders.map((order) => {
          const hasItem = order.items.some((item) => item.id === id);
          if (!hasItem) return order;
          optimisticOrder = {
            ...order,
            status_version: (order.status_version || 0) + 1,
            updated_at: new Date().toISOString(),
            items: order.items.map((item) => item.id === id
              ? { ...item, item_status: status, status_version: (item.status_version || 0) + 1, updated_at: new Date().toISOString() }
              : item),
          };
          return optimisticOrder;
        });
        saveKitchenToLS(storeId, nextOrders);
        return { kitchenOrders: nextOrders };
      });
      await enqueueOfflineOperation(storeId, {
        operation: 'kitchen.item.update',
        payload: { id, store_id: storeId, status },
        idempotencyKey: `kitchen-item:${id}:${status}:${Date.now()}`,
      });
      await updateSyncIndicators(storeId);
      if (optimisticOrder) return optimisticOrder;
      throw new Error('Item dapur tidak ditemukan.');
    }
    const data = await updateKitchenItemStatus(id, {
      store_id: storeId,
      status,
    });
    const order = data as KitchenOrder;
    set(s => {
      const nextOrders = mergeKitchenOrder(s.kitchenOrders, order);
      saveKitchenToLS(storeId, nextOrders);
      return { kitchenOrders: nextOrders };
    });
    return order;
  },
});
