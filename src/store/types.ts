// src/store/types.ts — KaffePOS store contract split into domain slices.
// The public `useStore` hook composes every slice below, so `AppStore` stays
// the single source of truth for field names and action signatures.
import type { StateCreator } from 'zustand';
import type {
  MenuItem, InventoryItem, Transaction, Expense,
  CashFlowEntry, StoreSettings, CartItem, CashRegister,
  InventoryItemUpdate, KitchenOrder, KitchenOrderStatus, KitchenRealtimeEvent, KitchenRealtimeStatus,
  StockUnitConversion,
} from '@/types';
import type { Challenge, UserChallengeProgress } from '@/lib/challenges';
import type { CustomThemeConfig, ThemePresetId } from '@/lib/theme';
import type { ConnectivityMode } from '@/lib/offlineQueue';
import type { BulkImportMode, BulkImportPreview, BulkImportRow } from '@/lib/stockEngine';

export interface ThemeSlice {
  appTheme:      ThemePresetId;
  customTheme:   CustomThemeConfig;
  setAppTheme:         (theme: ThemePresetId) => void;
  setCustomTheme:      (theme: Partial<CustomThemeConfig>) => void;
}

export interface MenuSlice {
  menu:          MenuItem[];
  saveMenuItem:        (item: Partial<MenuItem>) => Promise<void>;
  deleteMenuItem:      (id: string) => Promise<void>;
}

export interface InventorySlice {
  inventory:     InventoryItem[];
  unitConversions: StockUnitConversion[];
  saveInventoryItem:   (item: InventoryItemUpdate) => Promise<void>;
  adjustInventoryStock: (input: { inventoryId: string; countedStock: number; reason: string; note?: string | null }) => Promise<InventoryItem>;
  deleteInventoryItem: (id: string) => Promise<void>;
  saveStockUnitConversion: (conversion: Partial<StockUnitConversion> & { from_unit: string; to_unit: string; ratio: number }) => Promise<StockUnitConversion>;
  deleteStockUnitConversion: (id: string) => Promise<void>;
  commitStockBulkImportRows: (mode: BulkImportMode, rows: BulkImportRow[]) => Promise<{
    success: boolean;
    summary: BulkImportPreview['summary'];
    committed: BulkImportPreview['summary'];
  }>;
}

export interface TransactionSlice {
  transactions:  Transaction[];
  cart:          CartItem[];
  discount:      string;
  setCartItemNote:      (id: string, note: string) => void;
  addToCart:           (item: MenuItem, variant?: { name: string; price: number }, modifiers?: Array<{ name: string; price: number }>) => void;
  removeFromCart:      (id: string) => void;
  updateQty:           (id: string, qty: number) => void;
  clearCart:           () => void;
  setDiscount:         (d: string) => void;
  saveTransaction:     (tx: Omit<Transaction, 'store_id'>) => Promise<Transaction>;
  voidTransaction:     (id: string, reason: string, by: string) => Promise<Transaction>;
}

export interface KitchenSlice {
  kitchenOrders: KitchenOrder[];
  kitchenRealtimeStatus: KitchenRealtimeStatus;
  cleanup:             () => void;
  loadKitchenOrders:    (storeId?: string) => Promise<void>;
  connectKitchenRealtime: (storeId?: string) => void;
  applyKitchenEvent:    (event: KitchenRealtimeEvent) => void;
  updateKitchenOrder:   (id: string, status: KitchenOrderStatus, reason?: string | null) => Promise<KitchenOrder>;
  updateKitchenItem:    (id: string, status: KitchenOrderStatus) => Promise<KitchenOrder>;
}

export interface CashSlice {
  expenses:      Expense[];
  cashFlow:      CashFlowEntry[];
  cashRegister:  CashRegister[];
  saveExpense:         (exp: Partial<Expense>) => Promise<void>;
  deleteExpense:       (id: string) => Promise<void>;
  saveCashFlow:        (entry: Partial<CashFlowEntry>) => Promise<void>;
  saveCashRegister:    (entry: Partial<CashRegister>) => Promise<void>;
  updateCashRegister:  (id: string, entry: Partial<CashRegister>) => Promise<void>;
}

export interface SyncSlice {
  syncing:       boolean;
  isOnline:      boolean;
  syncStatus:    ConnectivityMode;
  pendingSyncCount: number;
  failedSyncCount: number;
  flushPending:        () => Promise<void>;
}

export interface CoreSlice {
  storeId:       string | null;
  storeSettings: StoreSettings | null;
  activeChallenges: Challenge[];
  challengeProgress: UserChallengeProgress[];
  customCats:    string[];
  loading:       boolean;
  setStoreId:          (id: string) => void;
  loadAll:             (storeId: string) => Promise<void>;
  loadChallenges:        (storeId?: string) => Promise<void>;
  saveStoreSettings:   (settings: Partial<StoreSettings>) => Promise<void>;
  saveCustomCats:      (cats: string[]) => void;
  resetState:          () => void;
}

// ── Full store interface (identical public API to the legacy single file) ──
export interface AppStore extends
  CoreSlice,
  ThemeSlice,
  MenuSlice,
  InventorySlice,
  TransactionSlice,
  KitchenSlice,
  CashSlice,
  SyncSlice {}

// Every slice creator operates on the full store via `set`/`get`, so cross-slice
// calls (e.g. `get().loadAll()`) stay available exactly as before.
export type AppSlice<TSlice> = StateCreator<AppStore, [], [], TSlice>;
