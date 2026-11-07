// src/store/index.ts — KaffePOS global store.
// Composes the domain slices into a single Zustand store. The public `useStore`
// API and all field names are identical to the legacy src/hooks/useStore.ts, so
// existing call sites (e.g. `useStore(s => s.cart)`) keep working unchanged.
import { create } from 'zustand';
import type { AppStore } from './types';
import { createCoreSlice } from './slices/coreSlice';
import { createThemeSlice } from './slices/themeSlice';
import { createMenuSlice } from './slices/menuSlice';
import { createInventorySlice } from './slices/inventorySlice';
import { createTransactionSlice } from './slices/transactionSlice';
import { createKitchenSlice } from './slices/kitchenSlice';
import { createCashSlice } from './slices/cashSlice';
import { createSyncSlice } from './slices/syncSlice';

export const useStore = create<AppStore>((...a) => ({
  ...createCoreSlice(...a),
  ...createThemeSlice(...a),
  ...createMenuSlice(...a),
  ...createInventorySlice(...a),
  ...createTransactionSlice(...a),
  ...createKitchenSlice(...a),
  ...createCashSlice(...a),
  ...createSyncSlice(...a),
}));

// Connectivity/visibility listeners are no longer attached at import time.
// main.tsx calls this once during bootstrap to wire them up explicitly.
export { initStoreListeners } from './sync';
export type { AppStore } from './types';
