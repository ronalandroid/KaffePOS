/** AppShell support: nav config, storage helpers, loading/error chrome. */
import { BarChart3, ChefHat, Handshake, History, LayoutDashboard, ListChecks, Package, Settings, ShoppingBag, Stamp, Tag, UserPlus, Users } from 'lucide-react';
import type { Tab } from '@/types';
import { getStoreCacheKey } from '@/utils/sessionIsolation';

export const NAV = [
  { id: 'dashboard' as Tab, label: 'Dashboard',  icon: LayoutDashboard },
  { id: 'performance' as Tab, label: 'Performa', icon: Users },
  { id: 'challenges' as Tab, label: 'Misi', icon: ListChecks },
  { id: 'referrals' as Tab, label: 'Ajak outlet', icon: UserPlus },
  { id: 'affiliate' as Tab, label: 'Afiliasi', icon: Handshake },
  { id: 'pos'       as Tab, label: 'Kasir',      icon: ShoppingBag },
  { id: 'loyalty'   as Tab, label: 'Loyalty',    icon: Stamp },
  { id: 'kitchen'   as Tab, label: 'Dapur',     icon: ChefHat },
  { id: 'warehouse' as Tab, label: 'Stok',       icon: Package     },
  { id: 'menu'      as Tab, label: 'Produk',     icon: Tag         },
  { id: 'history'   as Tab, label: 'Transaksi',  icon: History     },
  { id: 'report'    as Tab, label: 'Laporan',    icon: BarChart3   },
  { id: 'settings'  as Tab, label: 'Pengaturan', icon: Settings    },
] as const;

export const LS_LAST_TAB  = 'kpos_last_tab';
export const EXPLICIT_SIGNOUT_KEY = 'kaffepos_explicit_signout';

// ── Error boundary ────────────────────────────────────────────────
export function getCachedStoreId(userId: string): string | null {
  try { return localStorage.getItem(getStoreCacheKey(userId)); } catch { return null; }
}
export function setCachedStoreId(userId: string, id: string) {
  try { localStorage.setItem(getStoreCacheKey(userId), id); } catch { /* ignore */ }
}

export function getLastTabStorageKey(userId?: string) {
  return userId ? `${LS_LAST_TAB}:${userId}` : LS_LAST_TAB;
}

export function getValidTab(value: string | null): Tab | null {
  if (!value) return null;
  return NAV.some((entry) => entry.id === value) ? (value as Tab) : null;
}

export function createLoadedTabsState(initialTab: Tab): Record<Tab, boolean> {
  return {
    dashboard: initialTab === 'dashboard',
    performance: initialTab === 'performance',
    challenges: initialTab === 'challenges',
    referrals: initialTab === 'referrals',
    affiliate: initialTab === 'affiliate',
    pos: initialTab === 'pos',
    loyalty: initialTab === 'loyalty',
    kitchen: initialTab === 'kitchen',
    warehouse: initialTab === 'warehouse',
    menu: initialTab === 'menu',
    history: initialTab === 'history',
    report: initialTab === 'report',
    settings: initialTab === 'settings',
  };
}

