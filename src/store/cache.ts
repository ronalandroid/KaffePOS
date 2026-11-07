// src/store/cache.ts — localStorage persistence helpers for the KaffePOS store.
// Pure side-effecting helpers (no store dependency) so every slice can reuse them.
import { DEFAULT_CUSTOM_THEME, type CustomThemeConfig, type ThemePresetId } from '@/lib/theme';
import { getStoreSettingsKey } from '@/utils/sessionIsolation';
import {
  getChallengeProgressCacheKey,
  getChallengesCacheKey,
  type Challenge,
  type UserChallengeProgress,
} from '@/lib/challenges';
import type {
  MenuItem, InventoryItem, Transaction, Expense,
  CashFlowEntry, StoreSettings, CartItem, CashRegister,
  KitchenOrder, StockUnitConversion,
} from '@/types';

export function makeClientId(prefix: string) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function getPersistedThemeState() {
  if (typeof window === 'undefined') {
    return {
      appTheme: 'classic' as ThemePresetId,
      customTheme: DEFAULT_CUSTOM_THEME,
    };
  }

  try {
    const appTheme = (localStorage.getItem('kpos_app_theme') as ThemePresetId | null) || 'classic';
    const rawCustomTheme = localStorage.getItem('kpos_app_theme_custom');
    const customTheme = rawCustomTheme
      ? { ...DEFAULT_CUSTOM_THEME, ...(JSON.parse(rawCustomTheme) as Partial<CustomThemeConfig>) }
      : DEFAULT_CUSTOM_THEME;

    return { appTheme, customTheme };
  } catch {
    return {
      appTheme: 'classic' as ThemePresetId,
      customTheme: DEFAULT_CUSTOM_THEME,
    };
  }
}

// ── localStorage helpers ──────────────────────────────────────────
export function saveSettingsToLS(storeId: string, data: StoreSettings | null) {
  try { if (data) localStorage.setItem(getStoreSettingsKey(storeId), JSON.stringify(data)); } catch { /* ignore */ }
}
export function loadSettingsFromLS(storeId: string): StoreSettings | null {
  try {
    const raw = localStorage.getItem(getStoreSettingsKey(storeId));
    return raw ? JSON.parse(raw) as StoreSettings : null;
  } catch { return null; }
}

export function getCartCacheKey(storeId: string) {
  return `kpos_cart_${storeId}`;
}

export function getDiscountCacheKey(storeId: string) {
  return `kpos_discount_${storeId}`;
}

export function getKitchenCacheKey(storeId: string) {
  return `kpos_kitchen_orders_${storeId}`;
}

export function persistCheckoutDraft(storeId: string | null, cart: CartItem[], discount: string) {
  if (!storeId) return;
  try {
    if (cart.length > 0) {
      localStorage.setItem(getCartCacheKey(storeId), JSON.stringify(cart));
    } else {
      localStorage.removeItem(getCartCacheKey(storeId));
    }

    if (discount) {
      localStorage.setItem(getDiscountCacheKey(storeId), discount);
    } else {
      localStorage.removeItem(getDiscountCacheKey(storeId));
    }
  } catch { /* ignore */ }
}

export function loadCheckoutDraft(storeId: string) {
  try {
    return {
      cart: JSON.parse(localStorage.getItem(getCartCacheKey(storeId)) || '[]') as CartItem[],
      discount: localStorage.getItem(getDiscountCacheKey(storeId)) || '',
    };
  } catch {
    return { cart: [] as CartItem[], discount: '' };
  }
}

// ── Persist seluruh state ke localStorage setelah setiap perubahan ─
export function persistCache(
  storeId: string,
  menu: MenuItem[],
  inventory: InventoryItem[],
  transactions: Transaction[],
  expenses: Expense[] = [],
  cashFlow: CashFlowEntry[] = [],
  cashRegister: CashRegister[] = [],
  unitConversions?: StockUnitConversion[],
) {
  try {
    localStorage.setItem(`kpos_menu_${storeId}`,  JSON.stringify(menu));
    localStorage.setItem(`kpos_inv_${storeId}`,   JSON.stringify(inventory));
    localStorage.setItem(`kpos_trx_${storeId}`,   JSON.stringify(transactions));
    localStorage.setItem(`kpos_exp_${storeId}`,   JSON.stringify(expenses));
    localStorage.setItem(`kpos_cf_${storeId}`,    JSON.stringify(cashFlow));
    localStorage.setItem(`kpos_cr_${storeId}`,    JSON.stringify(cashRegister));
    if (unitConversions) {
      localStorage.setItem(`kpos_unit_conversions_${storeId}`, JSON.stringify(unitConversions));
    }
  } catch { /* ignore */ }
}

export function loadCache(storeId: string) {
  const load = (key: string) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  return {
    menu:     (load(`kpos_menu_${storeId}`) || []) as MenuItem[],
    inv:      (load(`kpos_inv_${storeId}`)  || []) as InventoryItem[],
    trx:      (load(`kpos_trx_${storeId}`)  || []) as Transaction[],
    expenses: (load(`kpos_exp_${storeId}`)  || []) as Expense[],
    cashFlow: (load(`kpos_cf_${storeId}`)   || []) as CashFlowEntry[],
    cashReg:  (load(`kpos_cr_${storeId}`)   || []) as CashRegister[],
    unitConversions: (load(`kpos_unit_conversions_${storeId}`) || []) as StockUnitConversion[],
    kitchen:  (load(getKitchenCacheKey(storeId)) || []) as KitchenOrder[],
    settings: loadSettingsFromLS(storeId),
  };
}

export function saveKitchenToLS(storeId: string | null, orders: KitchenOrder[]) {
  if (!storeId) return;
  try { localStorage.setItem(getKitchenCacheKey(storeId), JSON.stringify(orders)); } catch { /* ignore */ }
}

export function saveChallengesToLS(storeId: string | null, challenges: Challenge[], progress: UserChallengeProgress[]) {
  if (!storeId) return;
  try {
    localStorage.setItem(getChallengesCacheKey(storeId), JSON.stringify(challenges));
    localStorage.setItem(getChallengeProgressCacheKey(storeId), JSON.stringify(progress));
  } catch { /* ignore */ }
}

export function loadChallengesFromLS(storeId: string) {
  try {
    return {
      challenges: JSON.parse(localStorage.getItem(getChallengesCacheKey(storeId)) || '[]') as Challenge[],
      progress: JSON.parse(localStorage.getItem(getChallengeProgressCacheKey(storeId)) || '[]') as UserChallengeProgress[],
    };
  } catch {
    return { challenges: [] as Challenge[], progress: [] as UserChallengeProgress[] };
  }
}
