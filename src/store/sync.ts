// src/store/sync.ts — offline queue engine + connectivity listeners.
// These helpers drive store state via the composed `useStore` singleton. The
// import of `useStore` from './index' is circular, but every reference happens
// inside a function body (call-time), never at module-evaluation time, so the
// binding is always initialised before it is read.
import { useStore } from './index';
import {
  checkoutTransaction,
  createCashFlow,
  createCashRegister,
  createExpense,
  createInventoryItem,
  createMenuItem,
  createStockUnitConversion,
  deleteStockUnitConversion,
  getMyChallengeProgress,
  addLoyaltyStamp,
  redeemLoyaltyReward,
  removeExpense,
  removeInventoryItem,
  removeMenuItem,
  updateCashRegisterEntry,
  updateInventoryItem,
  updateKitchenItemStatus,
  updateKitchenOrderStatus,
  updateMenuItem,
  updateStockUnitConversion,
  updateStore,
} from '@/lib/backendApi';
import {
  deriveConnectivityMode,
  getOfflineOutboxSummary,
  OFFLINE_OUTBOX_EVENT,
  processOfflineOutbox,
} from '@/lib/offlineQueue';
import { getPendingWritesKey } from '@/utils/sessionIsolation';
import { persistCache, saveChallengesToLS, saveKitchenToLS, saveSettingsToLS } from './cache';
import { mergeKitchenOrder } from './merge';
import { markInserted } from './dedupe';
import type { KitchenOrder, KitchenOrderStatus, StoreSettings, Transaction } from '@/types';

// ── Offline queue (persisted ke localStorage agar survive app restart) ──
interface PendingWrite { table: string; op: 'insert'|'update'|'delete'; data: Record<string, unknown>; id?: string }

const activeFlushStores = new Set<string>();

export function getPendingWrites(storeId: string | null): PendingWrite[] {
  if (!storeId) return [];
  try { return JSON.parse(localStorage.getItem(getPendingWritesKey(storeId)) || '[]'); } catch { return []; }
}
function savePendingWrites(storeId: string | null, writes: PendingWrite[]) {
  if (!storeId) return;
  try {
    localStorage.setItem(getPendingWritesKey(storeId), JSON.stringify(writes));
  } catch (e) {
    // localStorage full / quota exceeded (common on Android WebView with large datasets).
    // Surfacing this matters: a swallowed failure means offline writes the cashier believes
    // were saved are silently dropped on the next app restart.
    console.error('[KaffePOS] pending_writes.persist_failed', { storeId, count: writes.length, error: e });
  }
}
export function addPendingWrite(storeId: string | null, pw: PendingWrite) {
  const writes = getPendingWrites(storeId);
  writes.push(pw);
  savePendingWrites(storeId, writes);
  if (storeId) void updateSyncIndicators(storeId);
}

export async function updateSyncIndicators(storeId: string | null, options: { syncing?: boolean; lastSyncSucceeded?: boolean } = {}) {
  if (!storeId) return;
  const outbox = await getOfflineOutboxSummary(storeId);
  const legacyCount = getPendingWrites(storeId).length;
  const summary = {
    total: outbox.total + legacyCount,
    pending: outbox.pending + legacyCount,
    syncing: outbox.syncing,
    failed: outbox.failed,
    conflicted: outbox.conflicted,
    resolved: outbox.resolved,
  };
  const state = useStore.getState();
  const isSyncing = options.syncing ?? state.syncing;
  const modeInput = {
    isOnline: state.isOnline,
    isSyncing,
    summary,
    ...(options.lastSyncSucceeded === undefined ? {} : { lastSyncSucceeded: options.lastSyncSucceeded }),
  };
  useStore.setState({
    pendingSyncCount: summary.total,
    failedSyncCount: summary.failed + summary.conflicted,
    syncStatus: deriveConnectivityMode(modeInput),
  });
}

export async function flushPending() {
  const storeId = useStore.getState().storeId;
  if (!storeId) return;
  if (activeFlushStores.has(storeId)) return;
  activeFlushStores.add(storeId);
  try {
  const writes = getPendingWrites(storeId);
  const outboxSummary = await getOfflineOutboxSummary(storeId);
  if (writes.length === 0 && outboxSummary.total === 0) {
    await updateSyncIndicators(storeId);
    return;
  }
  useStore.setState({ syncing: true, syncStatus: 'syncing' });
  await updateSyncIndicators(storeId, { syncing: true });

  await processOfflineOutbox(storeId, {
    'transaction.create': async (item) => {
      const data = await checkoutTransaction(item.payload);
      const savedTx = data as Transaction;
      markInserted(savedTx.id);
      useStore.setState((state) => ({
        transactions: state.transactions.some(t => t.id === savedTx.id)
          ? state.transactions.map(t => t.id === savedTx.id ? savedTx : t)
          : [savedTx, ...state.transactions.filter(t => t.id !== item.payload.id)],
      }));
      if (savedTx.kitchen_order) {
        useStore.setState((state) => {
          const nextOrders = mergeKitchenOrder(state.kitchenOrders, savedTx.kitchen_order as KitchenOrder);
          saveKitchenToLS(storeId, nextOrders);
          return { kitchenOrders: nextOrders };
        });
      }
      persistCache(storeId, useStore.getState().menu, useStore.getState().inventory, useStore.getState().transactions, useStore.getState().expenses, useStore.getState().cashFlow, useStore.getState().cashRegister);
      try {
        const progressResponse = await getMyChallengeProgress(storeId);
        useStore.setState({
          activeChallenges: progressResponse.challenges || [],
          challengeProgress: progressResponse.items || [],
        });
        saveChallengesToLS(storeId, progressResponse.challenges || [], progressResponse.items || []);
      } catch { /* challenge progress will refresh on next load */ }
    },
    'loyalty.stamp.create': async (item) => {
      await addLoyaltyStamp(item.payload as {
        store_id: string;
        passport_id?: string;
        customer_name?: string | null;
        customer_phone?: string;
        transaction_id?: string | null;
        transaction_amount: number;
        note?: string | null;
        idempotency_key?: string | null;
      });
    },
    'loyalty.redemption.create': async (item) => {
      await redeemLoyaltyReward(item.payload as {
        store_id: string;
        passport_id: string;
        reward_id: string;
        transaction_id?: string | null;
        transaction_amount: number;
        idempotency_key?: string | null;
      });
    },
    'kitchen.order.update': async (item) => {
      const data = await updateKitchenOrderStatus(String(item.payload.id), {
        store_id: storeId,
        status: item.payload.status as KitchenOrderStatus,
        reason: typeof item.payload.reason === 'string' ? item.payload.reason : null,
      });
      const order = data as KitchenOrder;
      useStore.setState((state) => {
        const nextOrders = mergeKitchenOrder(state.kitchenOrders, order);
        saveKitchenToLS(storeId, nextOrders);
        return { kitchenOrders: nextOrders };
      });
    },
    'kitchen.item.update': async (item) => {
      const data = await updateKitchenItemStatus(String(item.payload.id), {
        store_id: storeId,
        status: item.payload.status as KitchenOrderStatus,
      });
      const order = data as KitchenOrder;
      useStore.setState((state) => {
        const nextOrders = mergeKitchenOrder(state.kitchenOrders, order);
        saveKitchenToLS(storeId, nextOrders);
        return { kitchenOrders: nextOrders };
      });
    },
    'store.settings.update': async (item) => {
      const updated = await updateStore(storeId, item.payload);
      saveSettingsToLS(storeId, updated as StoreSettings);
      useStore.setState({ storeSettings: updated as StoreSettings });
    },
  });

  const remaining: PendingWrite[] = [];
  for (const pw of writes) {
    try {
      if (pw.table === 'menu_items') {
        if (pw.op === 'insert') await createMenuItem(pw.data);
        if (pw.op === 'update' && pw.id) await updateMenuItem(pw.id, pw.data);
        if (pw.op === 'delete' && pw.id) await removeMenuItem(pw.id);
      } else if (pw.table === 'inventory') {
        if (pw.op === 'insert') await createInventoryItem(pw.data);
        if (pw.op === 'update' && pw.id) await updateInventoryItem(pw.id, pw.data);
        if (pw.op === 'delete' && pw.id) await removeInventoryItem(pw.id);
      } else if (pw.table === 'inventory_unit_conversions') {
        if (pw.op === 'insert') await createStockUnitConversion(pw.data);
        if (pw.op === 'update' && pw.id) await updateStockUnitConversion(pw.id, pw.data);
        if (pw.op === 'delete' && pw.id) await deleteStockUnitConversion(pw.id);
      } else if (pw.table === 'expenses') {
        if (pw.op === 'insert') await createExpense(pw.data);
        if (pw.op === 'delete' && pw.id) await removeExpense(pw.id);
      } else if (pw.table === 'cash_flow') {
        if (pw.op === 'insert') await createCashFlow(pw.data);
      } else if (pw.table === 'cash_register') {
        if (pw.op === 'insert') await createCashRegister(pw.data);
        if (pw.op === 'update' && pw.id) await updateCashRegisterEntry(pw.id, pw.data);
      } else if (pw.table === 'stores') {
        if (pw.op === 'update' && pw.id) await updateStore(pw.id, pw.data);
      }
    } catch (e) {
      // Log which offline write failed so a permanently-failing item isn't silently
      // requeued forever with no diagnostic trail.
      console.error('[KaffePOS] pending_write.flush_failed', { table: pw.table, op: pw.op, id: pw.id, error: e });
      remaining.push(pw);
    }
  }
  savePendingWrites(storeId, remaining);
  const finalOutbox = await getOfflineOutboxSummary(storeId);
  const hasFailures = remaining.length > 0 || finalOutbox.failed > 0 || finalOutbox.conflicted > 0;
  useStore.setState({
    syncing: false,
    pendingSyncCount: finalOutbox.total + remaining.length,
    failedSyncCount: finalOutbox.failed + finalOutbox.conflicted,
    syncStatus: hasFailures ? 'sync_failed' : 'sync_success',
  });
  if (!hasFailures) {
    setTimeout(() => {
      const current = useStore.getState();
      if (current.storeId === storeId && current.syncStatus === 'sync_success') {
        useStore.setState({ syncStatus: current.isOnline ? 'online' : 'offline' });
      }
    }, 3000);
  }
  } finally {
    activeFlushStores.delete(storeId);
  }
}

// ── Connectivity + visibility listeners ───────────────────────────
// Previously attached at module import time; now invoked explicitly once from
// src/main.tsx via initStoreListeners() to remove import-time side effects.
let listenersInitialised = false;

export function initStoreListeners() {
  if (typeof window === 'undefined') return;
  if (listenersInitialised) return;
  listenersInitialised = true;

  window.addEventListener('online', () => {
    useStore.setState({ isOnline: true, syncStatus: 'reconnecting' });
    flushPending();
  });
  window.addEventListener('offline', () => {
    useStore.setState({ isOnline: false, syncStatus: 'offline' });
  });
  window.addEventListener(OFFLINE_OUTBOX_EVENT, (event) => {
    const currentStoreId = useStore.getState().storeId;
    const detail = (event as CustomEvent<{ storeId?: string }>).detail;
    if (!currentStoreId || (detail?.storeId && detail.storeId !== currentStoreId)) return;
    void updateSyncIndicators(currentStoreId);
  });
  let visibilityDebounce: ReturnType<typeof setTimeout> | null = null;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (visibilityDebounce) clearTimeout(visibilityDebounce);
      visibilityDebounce = setTimeout(() => {
        // LS_MENU and LS_INV are intentionally not used here as loadCache handles it
        const state = useStore.getState();
        const storeId = state.storeId;
        const loadAll = state.loadAll;
        if (storeId) {
          flushPending().then(() => loadAll(storeId));
        }
        visibilityDebounce = null;
      }, 2000);
    }
  });
}
