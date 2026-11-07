// src/store/defaults.ts — single source of truth for the store's initial state.
// Slices read their defaults from here, and `resetState` re-applies it, so the
// reset behaviour stays byte-for-byte identical to the legacy single-file store.
import type { AppStore } from './types';
import { getPersistedThemeState } from './cache';

type InitialState = Pick<
  AppStore,
  'storeId' | 'storeSettings' | 'menu' | 'inventory' | 'unitConversions' | 'transactions' | 'kitchenOrders' | 'kitchenRealtimeStatus' | 'expenses' | 'cashFlow' | 'cashRegister' | 'activeChallenges' | 'challengeProgress' | 'customCats' | 'cart' | 'discount' | 'loading' | 'syncing' | 'syncStatus' | 'pendingSyncCount' | 'failedSyncCount' | 'appTheme' | 'customTheme'
>;

export const initialState: InitialState = {
  storeId: null,
  storeSettings: null,
  menu: [],
  inventory: [],
  unitConversions: [],
  transactions: [],
  kitchenOrders: [],
  kitchenRealtimeStatus: 'idle',
  expenses: [],
  cashFlow: [],
  cashRegister: [],
  activeChallenges: [],
  challengeProgress: [],
  customCats: [],
  cart: [],
  discount: '',
  loading: false,
  syncing: false,
  syncStatus: 'online',
  pendingSyncCount: 0,
  failedSyncCount: 0,
  ...getPersistedThemeState(),
};

// Live connectivity snapshot — matches the original create()/resetState overrides.
export function getLiveConnectivity(): Pick<AppStore, 'isOnline' | 'syncStatus'> {
  return {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    syncStatus: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online',
  };
}
