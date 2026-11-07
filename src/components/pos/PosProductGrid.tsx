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

      {/* Menu header — warm gradient wash */}
      <div className="bg-gradient-to-b from-white to-stone-50/60 border-b border-stone-200/50 px-4 sm:px-6 pt-5 pb-4 z-10">
        <div className="flex min-w-0 items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-black text-stone-800 tracking-tight">Katalog Menu</h2>
            {lowStock.length > 0 && (
              <p className="text-[11px] text-rose-500 font-bold mt-0.5 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
                {lowStock.length} bahan kritis
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {onOpenTableModal && (
              <button
                type="button"
                onClick={onOpenTableModal}
                className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-2 text-[11px] font-black text-stone-700 shadow-sm transition-colors hover:border-[#FF6A00] hover:text-[#FF6A00]"
              >
                <Utensils size={13} className="text-[#FF6A00]" />
                <span>{selectedTable ? `Meja ${selectedTable}` : 'Meja & Bill'}</span>
                {openBillsCount > 0 && (
                  <span className="ml-0.5 rounded-full bg-[#FF6A00] px-1.5 py-0.5 text-[9px] font-black text-white">
                    {openBillsCount}
                  </span>
                )}
              </button>
            )}
            {onOpenShiftModal && (
              <button
                type="button"
                onClick={onOpenShiftModal}
                className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-2 text-[11px] font-black text-stone-700 shadow-sm transition-colors hover:border-[#FF6A00] hover:text-[#FF6A00]"
              >
                <Wallet size={13} className="text-[#FF6A00]" />
                <span className="hidden sm:inline">Shift & Laci</span>
              </button>
            )}
            {/* Online / Offline badge */}
            <button type="button" onClick={() => { if (!isOnline) window.location.reload(); }}
              className={`flex shrink-0 items-center gap-2 px-3.5 py-2 rounded-full border cursor-pointer active:scale-95 transition-transform duration-200 ${isOnline?'bg-emerald-50 border-emerald-100 text-emerald-700':'bg-rose-500 border-rose-600 text-white animate-bounce shadow-[0_6px_20px_rgba(239,68,68,0.45)]'}`}
              aria-label={isOnline ? 'Status koneksi terhubung' : 'Muat ulang karena offline'}>
              <div className={`size-1.5 rounded-full ${isOnline?'bg-emerald-500 animate-pulse':'bg-white animate-ping'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest">{isOnline?'Terhubung':'OFFLINE!'}</span>
            </button>
          </div>
        </div>

        {/* Search bar — rounded-full, warm focus ring */}
        <div className="relative">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <label className="sr-only" htmlFor="pos-menu-search">Cari menu</label>
          <input
            id="pos-menu-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari menu kopi, snack…"
            className="w-full h-12 bg-stone-50 border border-stone-200/70 rounded-full pl-12 pr-5 text-[14px] focus:outline-none focus:ring-4 focus:ring-[#FF6A00]/40 focus:border-[#FF6A00]/60 transition-all duration-200 font-medium text-stone-700 placeholder:text-stone-400 shadow-inner"
          />
        </div>

        <div className="kaffe-scroll-tabs kaffe-command-bar flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide">
          {cats.map(c => {
            const isAll = c === 'All'; const active = cat === c;
            const sz = `h-9 ${isAll ? 'px-6 font-display text-[13px] font-black tracking-wide' : 'px-5 text-[12px] font-bold'}`;
            const st = active ? 'bg-[#FF6A00] text-white shadow-[0_4px_12px_rgba(255,106,0,0.35)]' : `bg-white border border-stone-200 ${isAll ? 'text-stone-700' : 'text-stone-500'} hover:bg-stone-50 hover:border-stone-300`;
            return <button type="button" key={c} onClick={() => setCat(c)} aria-pressed={active} className={`shrink-0 rounded-full transition-all duration-200 ${sz} ${st}`}>{c}</button>;
          })}
        </div>
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-4 md:p-5">
        {search !== dSearch ? (
          <POSSkeleton />
        ) : filtered.length === 0 ? (
          <div className="kaffe-empty-state flex flex-col items-center justify-center h-full rounded-3xl gap-4">
            <div className="size-24 bg-gradient-to-b from-stone-50 to-stone-100 rounded-[40px] flex items-center justify-center shadow-inner">
              <CoffeeCupIcon className="w-9 h-9 text-stone-300"/>
            </div>
            <div className="text-center">
              <p className="font-black text-stone-700 text-base tracking-tight">Menu tidak ditemukan</p>
              <p className="max-w-xs text-center text-xs font-medium text-stone-400 mt-1 leading-relaxed">Coba kata kunci lain atau tambah produk baru dari tab Produk.</p>
            </div>
          </div>
        ) : (
          <div className="kaffe-card-grid kaffe-quick-grid grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 pb-24 md:pb-4">
            {filtered.map(item => {
              const totalQty = cartQtyByBase.get(item.id) || 0;
              const isFlashing = flashId === item.id;
              return (
                <button type="button" key={item.id} onClick={() => handleAdd(item)}
                  className={`kaffe-action-card group min-w-0 bg-white rounded-[20px] overflow-hidden border border-stone-100 shadow-sm cursor-pointer text-left transition-all duration-300 hover:shadow-[0_8px_24px_rgba(255,106,0,0.12)] hover:-translate-y-0.5 active:scale-[0.98] active:ring-2 active:ring-[#FF6A00]/40 flex flex-col relative ${isFlashing ? 'ring-2 ring-[#FF6A00]/50 scale-[1.03]' : ''}`}
                  aria-label={`Tambah ${item.name} ke keranjang`}>
                  {item.image_url ? (
                    <div className="relative pt-[75%] w-full overflow-hidden bg-stone-50">
                      <img
                        src={item.image_url}
                        alt={item.name}
                        decoding="async"
                        className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    </div>
                  ) : (
                    <div className="pt-[75%] w-full relative">
                      <ProductPlaceholder category={item.category} className="absolute inset-0" iconSize={32} />
                    </div>
                  )}
                  <div className="p-3.5 flex-1 flex flex-col">
                    <p className="font-display font-bold text-stone-800 text-[13px] leading-tight mb-2 group-hover:text-[#FF6A00] transition-colors duration-200">
                      {item.name}
                    </p>
                    <div className="mt-auto flex items-center gap-1.5">
                      {(item.variants?.length || item.modifiers?.length) ? (
                        <span className="text-[9px] font-black uppercase tracking-wider text-stone-400">mulai</span>
                      ) : null}
                      <p className="font-black text-[14px] tabular-nums" style={{color:'var(--brand-orange-text)'}}>{fRp(item.price)}</p>
                    </div>
                  </div>

                  {/* Quantity badge — vibrant orange pill */}
                  {totalQty > 0 && (
                    <div className="absolute top-2.5 right-2.5 bg-[#FF6A00] text-white rounded-full shadow-[0_4px_12px_rgba(255,106,0,0.4)] px-2.5 py-1 flex items-center gap-1.5 z-10 animate-in zoom-in-95 duration-150">
                      <span className="font-black text-[11px] leading-none tabular-nums">{totalQty}</span>
                      <Plus size={10} strokeWidth={3} />
                    </div>
                  )}
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
            className="w-full bg-gradient-to-r from-[#FF6A00] to-[#FF8A1C] text-white p-4 rounded-3xl flex items-center justify-between shadow-[0_12px_40px_rgba(255,106,0,0.45)] hover:shadow-[0_16px_48px_rgba(255,106,0,0.55)] active:scale-[0.97] transition-all">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-full bg-white flex items-center justify-center font-black text-sm text-[#FF6A00] shadow-sm">{cart.length}</div>
              <span className="font-bold text-sm tracking-wide">Keranjang</span>
            </div>
            <div className="flex items-center gap-2 font-black text-base text-white/90">{fRp(total)} <ChevronRight size={18}/></div>
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
