/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore, initStoreListeners } from '@/hooks/useStore';
import { checkoutTransaction } from '@/lib/backendApi';
import { clearOfflineOutbox, readOfflineOutbox, resetOfflineQueueRuntimeForTests } from '@/lib/offlineQueue';

// initStoreListeners() now wires the online/offline/visibility handlers that used
// to run at import time. These tests confirm the connectivity wiring and the
// offline-queue flush still behave exactly as before the slice refactor.

vi.mock('@/lib/opsMetrics', () => ({
  trackOpsEvent: vi.fn(),
}));

vi.mock('@/lib/backendApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/backendApi')>();
  return {
    ...actual,
    getMyChallengeProgress: vi.fn().mockResolvedValue({
      items: [],
      challenges: [],
      summary: { active_count: 0, completed_count: 0, reward_points: 0 },
    }),
    checkoutTransaction: vi.fn().mockResolvedValue({
      id: 'tx_listen',
      store_id: 'store_listen',
      items: [],
      subtotal: 10000,
      discount: 0,
      tax: 0,
      total: 10000,
      cogs: 0,
      paid: 10000,
      change: 0,
      method: 'Tunai',
      is_void: false,
      date: new Date().toISOString(),
    }),
  };
});

describe('store connectivity listeners (initStoreListeners)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    resetOfflineQueueRuntimeForTests();
    await clearOfflineOutbox('store_listen');
    useStore.setState({
      storeId: 'store_listen',
      isOnline: true,
      transactions: [],
      pendingSyncCount: 0,
      failedSyncCount: 0,
      syncStatus: 'online',
    });
    initStoreListeners();
  });

  it('marks the store offline when the window goes offline', () => {
    window.dispatchEvent(new Event('offline'));

    expect(useStore.getState().isOnline).toBe(false);
    expect(useStore.getState().syncStatus).toBe('offline');
  });

  it('reconnects and flushes the offline outbox when the window comes back online', async () => {
    useStore.setState({ isOnline: false, syncStatus: 'offline' });

    await useStore.getState().saveTransaction({
      id: 'tx_listen',
      items: [{ name: 'Coffee', qty: 1, price: 10000, subtotal: 10000, menu_item_id: 'item_1' }],
      subtotal: 10000,
      discount: 0,
      tax: 0,
      cogs: 0,
      paid: 10000,
      change: 0,
      method: 'Tunai',
      is_void: false,
      total: 10000,
      date: new Date().toISOString(),
    } as any);
    await expect(readOfflineOutbox('store_listen')).resolves.toHaveLength(1);

    window.dispatchEvent(new Event('online'));
    expect(useStore.getState().isOnline).toBe(true);

    // The online listener fires flushPending() (not awaited); wait for it to drain.
    await vi.waitFor(async () => {
      await expect(readOfflineOutbox('store_listen')).resolves.toEqual([]);
    });
    expect(checkoutTransaction).toHaveBeenCalledTimes(1);
  });
});
