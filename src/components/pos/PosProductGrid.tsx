// src/components/pos/PosProductGrid.tsx — left column of the POS screen:
// catalog header (low-stock + connectivity badges), search, category pills,
// the product card grid, and the mobile floating cart button. Owns its own
// search/category/filter state; reads the menu/inventory slices it needs.
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Plus, ChevronRight, Search, Utensils, Wallet } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import ProductPlaceholder from '@/components/ui/ProductPlaceholder';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { buildStockDeductionPlan } from '@/lib/stockEngine';
import type { MenuItem, Variant, Modifier } from '@/types';
import { fRp } from './posHelpers';
import { CoffeeCupIcon, POSSkeleton } from './PosIcons';
import PosVariantPicker from './PosVariantPicker';

type Props = {
  total: number;
  onOpenMobileCart: () => void;
  onOpenTableModal?: () => void;
  onOpenShiftModal?: () => void;
  openBillsCount?: number;
  selectedTable?: string;
  toast: { showToast: (m: string, t?: 'success' | 'error' | 'warning' | 'info') => void };
};

export default function PosProductGrid({
  total,
  onOpenMobileCart,
  onOpenTableModal,
  onOpenShiftModal,
  openBillsCount = 0,
  selectedTable = '',
  toast,
}: Props) {
  const menu = useStore((s) => s.menu);
  const inventory = useStore((s) => s.inventory);
  const unitConversions = useStore((s) => s.unitConversions);
  const cart = useStore((s) => s.cart);
  const isOnline = useStore((s) => s.isOnline);
  const addToCart = useStore((s) => s.addToCart);

  const [cat,    setCat]    = useState('All');
  const [search, setSearch] = useState('');
  const [variantItem, setVariantItem] = useState<MenuItem | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const triggerCardFlash = useCallback((itemId: string) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashId(itemId);
    flashTimerRef.current = setTimeout(() => setFlashId(null), 180);
  }, []);

  const cats = useMemo(() =>
    ['All', ...new Set(menu.map(m => m.category))],
    [menu]
  );

  const filtered = useMemo(() =>
    menu.filter(m =>
      m.is_available &&
      (cat === 'All' || m.category === cat) &&
      (!dSearch || m.name.toLowerCase().includes(dSearch.toLowerCase()))
    ),
    [menu, cat, dSearch]
  );

  const lowStock = useMemo(() =>
    inventory.filter(i => i.stock <= i.min_stock),
    [inventory]
  );

  // Pre-aggregate cart quantity by base product id once per cart change, so the grid does
  // an O(1) lookup per card instead of scanning the whole cart for every menu item
  // (was O(menu × cart) on every render — a tap-latency hazard with large menus).
  const cartQtyByBase = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cart) {
      const baseId = c._baseId || c.id;
      map.set(baseId, (map.get(baseId) || 0) + c.qty);
    }
    return map;
  }, [cart]);

  // ── Stock check — handles variants correctly ──────────────────
  const checkStock = useCallback((item: MenuItem): boolean => {
    if (!item.recipe?.length) return true;
    // Find how many of this item (base ID) are already in cart
    const inCartQty = cart
      .filter(c => c.id === item.id || c._baseId === item.id)
      .reduce((s, c) => s + c.qty, 0);
    const plan = buildStockDeductionPlan(
      [{ id: item.id, name: item.name, qty: inCartQty + 1, menu_item_id: item.id }],
      menu,
      inventory,
      unitConversions,
    );
    return plan.ok;
  }, [cart, inventory, menu, unitConversions]);

  const handleAdd = useCallback((item: MenuItem) => {
    if (!checkStock(item)) {
      toast.showToast('Stok bahan tidak cukup', 'warning');
      return;
    }
    triggerCardFlash(item.id);
    // Products with variants (S/M/L) or modifiers (Extra Shot, Oat Milk) open the options
    // sheet so the cashier chooses size/add-ons; addToCart(item, variant, modifiers) applies
    // them. Plain products go straight to the cart.
    if (item.variants?.length || item.modifiers?.length) {
      setVariantItem(item);
    } else {
      addToCart(item);
    }
  }, [checkStock, addToCart, toast, triggerCardFlash]);

  const handleOptionsConfirm = useCallback((variant?: Variant, modifiers?: Modifier[]) => {
    if (variantItem) addToCart(variantItem, variant, modifiers);
    setVariantItem(null);
  }, [variantItem, addToCart]);

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative">

      {/* Catalog header */}
      <div className="z-10 border-b border-[var(--brand-panel-border)] bg-white px-4 pt-4 pb-3 sm:px-6 sm:pt-5">
        <div className="mb-3 flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Katalog Menu</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold text-slate-500">
              <span className="kaffe-num">{filtered.length} menu</span>
              {lowStock.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-rose-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden="true" />
                  {lowStock.length} bahan kritis
                </span>
              )}
              <button
                type="button"
                onClick={() => { if (!isOnline) window.location.reload(); }}
                className={`kaffe-btn-compact inline-flex items-center gap-1.5 rounded-md ${isOnline ? 'cursor-default text-emerald-700' : 'font-bold text-rose-700 underline underline-offset-2'}`}
                aria-label={isOnline ? 'Status koneksi terhubung' : 'Muat ulang karena offline'}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} aria-hidden="true" />
                {isOnline ? 'Terhubung' : 'Offline, ketuk untuk muat ulang'}
              </button>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {onOpenTableModal && (
              <button
                type="button"
                onClick={onOpenTableModal}
                aria-label={selectedTable ? `Meja ${selectedTable}` : 'Meja & Bill'}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--brand-panel-border)] bg-white px-3 text-[13px] font-bold text-slate-700 transition-colors hover:border-orange-200 hover:bg-[var(--brand-orange-soft)]"
              >
                <Utensils size={16} className="text-[var(--brand-orange-text)]" />
                <span className="hidden xl:inline">{selectedTable ? `Meja ${selectedTable}` : 'Meja & Bill'}</span>
                {openBillsCount > 0 && (
                  <span className="rounded-full bg-[#FF6A00] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white kaffe-num">
                    {openBillsCount}
                  </span>
                )}
              </button>
            )}
            {onOpenShiftModal && (
              <button
                type="button"
                onClick={onOpenShiftModal}
                aria-label="Shift & Laci"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--brand-panel-border)] bg-white px-3 text-[13px] font-bold text-slate-700 transition-colors hover:border-orange-200 hover:bg-[var(--brand-orange-soft)]"
              >
                <Wallet size={16} className="text-[var(--brand-orange-text)]" />
                <span className="hidden xl:inline">Shift & Laci</span>
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <label className="sr-only" htmlFor="pos-menu-search">Cari menu</label>
          <input
            id="pos-menu-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari menu kopi, snack..."
            className="h-11 w-full rounded-xl border border-[var(--brand-panel-border)] bg-[var(--brand-canvas)] pl-11 pr-4 font-medium text-slate-800 placeholder:text-slate-500 transition-colors focus:border-[#FF6A00]/60 focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FF6A00]/15"
          />
        </div>

        <div className="kaffe-scroll-tabs kaffe-command-bar -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-0.5 scrollbar-hide sm:-mx-6 sm:px-6">
          {cats.map(c => {
            const active = cat === c;
            return (
              <button
                type="button"
                key={c}
                onClick={() => setCat(c)}
                aria-pressed={active}
                className={`h-9 shrink-0 rounded-full px-4 text-[13px] font-bold transition-colors ${
                  active
                    ? 'border border-[#FF6A00]/50 bg-[var(--brand-orange-soft)] text-[var(--brand-orange-text)]'
                    : 'border border-[var(--brand-panel-border)] bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {c === 'All' ? 'Semua' : c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto bg-[var(--brand-canvas)] p-3 sm:p-4 md:p-5">
        {search !== dSearch ? (
          <POSSkeleton />
        ) : filtered.length === 0 ? (
          <div className="kaffe-empty-state flex h-full flex-col items-center justify-center gap-3 rounded-[20px] px-6">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-[var(--brand-canvas)]">
              <CoffeeCupIcon className="h-8 w-8 text-stone-300"/>
            </div>
            <div className="text-center">
              <p className="font-display text-base font-extrabold text-slate-800">Menu tidak ditemukan</p>
              <p className="mt-1 max-w-xs text-[13px] font-medium leading-relaxed text-slate-500">Coba kata kunci lain atau tambah produk baru dari tab Produk.</p>
            </div>
          </div>
        ) : (
          <div className="kaffe-card-grid kaffe-quick-grid grid grid-cols-2 gap-3 pb-24 sm:grid-cols-3 md:grid-cols-2 md:pb-4 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map(item => {
              const totalQty = cartQtyByBase.get(item.id) || 0;
              const isFlashing = flashId === item.id;
              const inCart = totalQty > 0;
              return (
                <button type="button" key={item.id} onClick={() => handleAdd(item)}
                  className={`kaffe-action-card group relative flex min-w-0 flex-col overflow-hidden rounded-[20px] text-left transition-[border-color,box-shadow,transform] duration-200 active:scale-[0.98] ${
                    inCart ? '!border-[#FF6A00]/60 ring-1 ring-[#FF6A00]/30' : ''
                  } ${isFlashing ? 'scale-[1.02]' : ''}`}
                  aria-label={`Tambah ${item.name} ke keranjang`}>
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F6F2EE]">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        decoding="async"
                        className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <ProductPlaceholder category={item.category} className="absolute inset-0" iconSize={30} />
                    )}
                    {inCart && (
                      <span className="absolute left-2.5 top-2.5 z-10 flex h-7 min-w-7 items-center justify-center rounded-full bg-[#FF6A00] px-2 text-[12px] font-extrabold text-white shadow-[0_2px_6px_rgba(196,69,0,0.3)] kaffe-num">
                        {totalQty}
                      </span>
                    )}
                    <span className="absolute bottom-2.5 right-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[var(--brand-orange-text)] shadow-[0_1px_3px_rgba(31,41,51,0.15)] transition-colors group-hover:bg-[#FF6A00] group-hover:text-white" aria-hidden="true">
                      <Plus size={16} strokeWidth={2.6} />
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <p className="line-clamp-2 text-[13.5px] font-bold leading-snug text-slate-900">
                      {item.name}
                    </p>
                    <div className="mt-auto flex items-baseline gap-1.5 pt-1">
                      {(item.variants?.length || item.modifiers?.length) ? (
                        <span className="text-[11px] font-semibold text-slate-500">mulai</span>
                      ) : null}
                      <p className="text-[14px] font-extrabold kaffe-num" style={{color:'var(--brand-orange-text)'}}>{fRp(item.price)}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MOBILE: BUTTON KERANJANG MENGAMBANG ── */}
      {cart.length > 0 && (
        <div className="kaffe-sticky-action md:hidden absolute bottom-4 left-4 right-4 z-20">
          <button type="button" onClick={onOpenMobileCart}
            className="kaffe-gradient-cta flex h-14 w-full items-center justify-between rounded-2xl px-4 active:scale-[0.98]">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-white text-sm font-extrabold text-[var(--brand-orange-text)] kaffe-num">{cart.reduce((n, c) => n + c.qty, 0)}</div>
              <span className="text-[15px] font-bold">Lihat Pesanan</span>
            </div>
            <div className="flex items-center gap-1.5 text-[15px] font-extrabold kaffe-num">{fRp(total)} <ChevronRight size={18}/></div>
          </button>
        </div>
      )}

      {variantItem && (
        <PosVariantPicker
          item={variantItem}
          onConfirm={handleOptionsConfirm}
          onClose={() => setVariantItem(null)}
        />
      )}
    </div>
  );
}
