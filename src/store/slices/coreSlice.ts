/* eslint-disable @typescript-eslint/no-explicit-any */
// src/store/slices/coreSlice.ts — store session lifecycle: bootstrap loading
// (loadAll), challenges, store settings, custom categories, and full reset.
import { clearStoredAuthSession, markExplicitSignOut } from '@/lib/authSession';
import {
  ApiError,
  getCashFlow,
  getCashRegister,
  getExpenses,
  getInventory,
  getKitchenOrders,
  getMenuItems,
  getMyChallengeProgress,
  getStockUnitConversions,
  getStores,
  getTransactions,
  updateStore,
} from '@/lib/backendApi';
import { enqueueOfflineOperation } from '@/lib/offlineQueue';
import {
  clearIndexedDbCache,
  clearSessionStorage,
  redirectToLogin,
} from '@/utils/sessionIsolation';
import type {
  CashFlowEntry, CashRegister, Expense, InventoryItem,
  KitchenOrder, MenuItem, StockUnitConversion, StoreSettings, Transaction,
} from '@/types';
import type { AppSlice, CoreSlice } from '../types';
import {
  getPersistedThemeState,
  loadCache,
  loadChallengesFromLS,
  loadCheckoutDraft,
  persistCache,
  saveChallengesToLS,
  saveKitchenToLS,
  saveSettingsToLS,
} from '../cache';
import { mergeById, sortKitchenOrders } from '../merge';
import { recentlyInserted } from '../dedupe';
import { updateSyncIndicators } from '../sync';
import { getLiveConnectivity, initialState } from '../defaults';

// Dedupes concurrent loadAll() calls per store id (one in-flight promise each).
const loadAllPromises = new Map<string, Promise<void>>();

export const createCoreSlice: AppSlice<CoreSlice> = (set, get) => ({
  storeId:           initialState.storeId,
  storeSettings:     initialState.storeSettings,
  activeChallenges:  initialState.activeChallenges,
  challengeProgress: initialState.challengeProgress,
  customCats:        initialState.customCats,
  loading:           initialState.loading,

  setStoreId: (id) => set({ storeId: id }),

  loadAll: async (storeId: string) => {
    const existingLoad = loadAllPromises.get(storeId);
    if (existingLoad) {
      return existingLoad;
    }

    const run = (async () => {
      const cache = loadCache(storeId);
      const challengeCache = loadChallengesFromLS(storeId);
      const { cart: cachedCart, discount: cachedDiscount } = loadCheckoutDraft(storeId);

    if (cache.settings || cache.menu.length > 0) {
      const stdCats = ['Coffee', 'Non-Coffee', 'Snack'];
      const cats = [...new Set(cache.menu.map((m: MenuItem) => m.category))].filter((c: string | null) => c && !stdCats.includes(c)) as string[];
      set({
        storeId,
        storeSettings: cache.settings || null,
        menu:          cache.menu,
        inventory:     cache.inv,
        unitConversions: cache.unitConversions,
        transactions:  cache.trx,
        kitchenOrders: sortKitchenOrders(cache.kitchen),
        expenses:      cache.expenses,
        cashFlow:      cache.cashFlow,
        cashRegister:  cache.cashReg,
        activeChallenges: challengeCache.challenges,
        challengeProgress: challengeCache.progress,
        customCats:    cats,
        loading:       false,
        cart:          cachedCart,
        discount:      cachedDiscount,
      });
    } else {
      set({ storeId, loading: true, cart: cachedCart, discount: cachedDiscount });
    }

    try {
      const [storesResponse, menuResponse, inventoryResponse, conversionResponse] = await Promise.all([
        getStores(storeId),
        getMenuItems(storeId),
        getInventory(storeId),
        getStockUnitConversions(storeId),
      ]);

      const store = storesResponse.items[0];
      if (!store) throw new Error('Store tidak ditemukan');

      const menuData = (menuResponse.items || []) as MenuItem[];
      const invData  = (inventoryResponse.items  || []) as InventoryItem[];
      const conversionData = (conversionResponse.items || []) as StockUnitConversion[];
      const stdCats  = ['Coffee', 'Non-Coffee', 'Snack'];
      const freshCats = [...new Set(menuData.map(m => m.category))].filter(c => c && !stdCats.includes(c));
      const freshSettings = (store as StoreSettings) || cache.settings;
      if (freshSettings) saveSettingsToLS(storeId, freshSettings);

      set(s => ({
        storeId,
        storeSettings: freshSettings,
        menu:       menuData,
        inventory:  invData,
        unitConversions: conversionData,
        customCats: freshCats,
        loading:    false,
        transactions: s.transactions,
        kitchenOrders: s.kitchenOrders,
      }));

      persistCache(
        storeId,
        menuData,
        invData,
        get().transactions,
        get().expenses,
        get().cashFlow,
        get().cashRegister,
        conversionData,
      );
    } catch (e:any) {
      if (!navigator.onLine) {
        set({ storeId, loading: false, syncing: false });
        return;
      }
      if (e instanceof ApiError && e.status === 401) {
        import('@/utils/toast').then(m => m.showToast('Sesi kamu berakhir. Silakan login ulang.', 'error'));
        await markExplicitSignOut().catch(() => {});
        await clearStoredAuthSession().catch(() => {});
        redirectToLogin(true);
        return;
      }
      if (e instanceof ApiError && e.status === 403) {
        import('@/utils/toast').then(m => m.showToast('Akses ke data toko ditolak.', 'error'));
        await markExplicitSignOut().catch(() => {});
        await clearStoredAuthSession().catch(() => {});
        redirectToLogin(true);
        return;
      }
      const msg = e instanceof Error ? e.message : 'Koneksi bermasalah. Coba lagi.';
      import('@/utils/toast').then(m => m.showToast(msg, 'error'));
      set({ storeId, loading: false, syncing: false });
    }

    const loadSecondary = async () => {
      try {
        const [trx, kitchen, exp, cf, cr, challengeResponse] = await Promise.all([
          getTransactions(storeId),
          getKitchenOrders(storeId),
          getExpenses(storeId),
          getCashFlow(storeId),
          getCashRegister(storeId),
          getMyChallengeProgress(storeId),
        ]);

        const trxData = mergeById((trx.items || []) as Transaction[], get().transactions);
        const kitchenData = sortKitchenOrders((kitchen.items || []) as KitchenOrder[]);
        const expData = mergeById((exp.items || []) as Expense[], get().expenses);
        const cfData = mergeById((cf.items || []) as CashFlowEntry[], get().cashFlow);
        const crData = mergeById((cr.items || []) as CashRegister[], get().cashRegister);
        set({
          transactions: trxData,
          kitchenOrders: kitchenData,
          expenses:     expData,
          cashFlow:     cfData,
          cashRegister: crData,
          activeChallenges: challengeResponse.challenges || [],
          challengeProgress: challengeResponse.items || [],
          syncing: false,
        });
        persistCache(
          storeId,
          get().menu,
          get().inventory,
          trxData,
          expData,
          cfData,
          crData,
        );
        saveKitchenToLS(storeId, kitchenData);
        saveChallengesToLS(storeId, challengeResponse.challenges || [], challengeResponse.items || []);
        get().connectKitchenRealtime(storeId);
      } catch {
        set({ syncing: false });
      }
    };

    set({ syncing: true });
    loadSecondary();
    })().finally(() => {
      loadAllPromises.delete(storeId);
    });

    loadAllPromises.set(storeId, run);
    return run;
  },

  loadChallenges: async (storeIdArg) => {
    const storeId = storeIdArg || get().storeId;
    if (!storeId) return;
    const cached = loadChallengesFromLS(storeId);
    if (cached.challenges.length > 0) {
      set({ activeChallenges: cached.challenges, challengeProgress: cached.progress });
    }
    try {
      const response = await getMyChallengeProgress(storeId);
      set({
        activeChallenges: response.challenges || [],
        challengeProgress: response.items || [],
      });
      saveChallengesToLS(storeId, response.challenges || [], response.items || []);
    } catch (error) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      throw error;
    }
  },

  saveStoreSettings: async (settings) => {
    const { storeId, storeSettings } = get();
    if (!storeId) throw new Error('Store belum dimuat');
    try {
      const mergedSettings = storeSettings
        ? { ...storeSettings, ...settings }
        : ({ ...settings } as StoreSettings);
      set({ storeSettings: mergedSettings });
      saveSettingsToLS(storeId, mergedSettings);

      const toSave: Partial<StoreSettings> = { ...settings };
      if (toSave.logo_base64 && (toSave.logo_base64?.length ?? 0) > 100_000) {
        delete toSave.logo_base64;
      }
      try {
        await updateStore(storeId, toSave);
      } catch {
        await enqueueOfflineOperation(storeId, {
          operation: 'store.settings.update',
          payload: toSave as Record<string, unknown>,
          idempotencyKey: `store-settings:${storeId}`,
        });
        await updateSyncIndicators(storeId);
        import('@/utils/toast').then(m => m.showToast('Pengaturan disimpan offline dan akan disinkronkan otomatis', 'success'));
      }
    } catch (e:any) {
      const msg = e?.message || 'Gagal menyimpan pengaturan toko';
      import('@/utils/toast').then(m => m.showToast(msg, 'error'));
      throw e;
    }
  },

  saveCustomCats: (cats) => set({ customCats: cats }),

  resetState: () => {
    get().cleanup();
    recentlyInserted.clear();
    clearSessionStorage();
    clearIndexedDbCache();
    loadAllPromises.clear();
    set({
      ...initialState,
      ...getPersistedThemeState(),
      ...getLiveConnectivity(),
    });
  },
});
