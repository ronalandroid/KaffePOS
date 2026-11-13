// src/components/pos/PosCartPanel.tsx — right-hand checkout sidebar (also the
// full-screen cart on mobile): header with two-tap clear, active kitchen-order
// strip, cart line items with qty steppers + notes, and the totals/checkout
// footer. Owns its own clear-confirm + kitchen-strip state; totals are derived
// once by the parent and passed in.
import { useState, useCallback, useMemo } from 'react';
import { Plus, Minus, X, ChevronRight, ChefHat, Utensils, BookmarkCheck } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import type { OrderType } from '@/types';
import { ORDER_TYPE_META, fRp } from './posHelpers';
import { CoffeeCupIcon } from './PosIcons';

type Props = {
  subtotal: number;
  discAmt: number;
  taxAmt: number;
  taxPct: number;
  total: number;
  showMobileCart: boolean;
  onCloseMobileCart: () => void;
  onOpenPay: () => void;
  orderType?: OrderType;
  onChangeOrderType?: (type: OrderType) => void;
  tableNumber?: string;
  pax?: number;
  openBillsCount?: number;
  activeOpenBillId?: string | null;
  onOpenTableModal?: () => void;
  onSaveOpenBill?: () => void;
  savingOpenBill?: boolean;
};

const COMPACT_ORDER_LABEL: Partial<Record<OrderType, string>> = {
  grabfood: 'Grab',
  shopeefood: 'Shopee',
};

function PosOrderTypeAndTableBar({
  orderType,
  onChangeOrderType,
  tableNumber,
  pax,
  openBillsCount,
  onOpenTableModal,
}: {
  orderType: OrderType;
  onChangeOrderType?: ((type: OrderType) => void) | undefined;
  tableNumber: string;
  pax: number;
  openBillsCount: number;
  onOpenTableModal?: (() => void) | undefined;
}) {
  return (
    <div className="space-y-2.5 border-b border-[var(--brand-panel-border)] bg-white px-4 py-3">
      <div className="kaffe-segmented grid w-full grid-cols-5" role="group" aria-label="Tipe pesanan">
        {(['dine_in', 'takeaway', 'gofood', 'grabfood', 'shopeefood'] as const).map((type) => {
          const meta = ORDER_TYPE_META[type];
          const isActive = orderType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onChangeOrderType?.(type)}
              aria-pressed={isActive}
              title={meta.label}
              className="min-w-0 truncate whitespace-nowrap !px-1 !text-[12px]"
            >
              {COMPACT_ORDER_LABEL[type] ?? meta.shortLabel}
            </button>
          );
        })}
      </div>

      {onOpenTableModal && (
        <button
          type="button"
          onClick={onOpenTableModal}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--brand-panel-border)] bg-white px-3 text-[13px] font-semibold text-slate-700 transition-colors hover:border-orange-200 hover:bg-[var(--brand-orange-soft)]"
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <Utensils size={15} className="shrink-0 text-[var(--brand-orange-text)]" />
            {tableNumber ? (
              <span className="font-bold text-slate-900">
                Meja {tableNumber} · {pax} pax
              </span>
            ) : (
              <span className="text-slate-600">Pilih meja</span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[12px] font-bold text-[var(--brand-orange-text)]">
            {openBillsCount > 0 ? `${openBillsCount} open bill` : 'Denah'}
            <ChevronRight size={14} />
          </span>
        </button>
      )}
    </div>
  );
}

export default function PosCartPanel({
  subtotal,
  discAmt,
  taxAmt,
  taxPct,
  total,
  showMobileCart,
  onCloseMobileCart,
  onOpenPay,
  orderType = 'dine_in',
  onChangeOrderType,
  tableNumber = '',
  pax = 1,
  openBillsCount = 0,
  activeOpenBillId = null,
  onOpenTableModal,
  onSaveOpenBill,
  savingOpenBill = false,
}: Props) {
  const cart = useStore((s) => s.cart);
  const updateQty = useStore((s) => s.updateQty);
  const clearCart = useStore((s) => s.clearCart);
  const setCartItemNote = useStore((s) => s.setCartItemNote);
  const kitchenOrders = useStore((s) => s.kitchenOrders);

  const [clearConfirm, setClearConfirm] = useState(false);

  const handleClearCart = useCallback(() => {
    // Require a second tap to confirm — clearing a live cart is irreversible and a
    // mis-tap mid-order would wipe the cashier's in-progress sale. Auto-resets after 3s.
    if (!clearConfirm) {
      setClearConfirm(true);
      setTimeout(() => setClearConfirm(false), 3000);
      return;
    }
    setClearConfirm(false);
    clearCart();
    onCloseMobileCart();
  }, [clearConfirm, clearCart, onCloseMobileCart]);

  const activeKitchenOrders = useMemo(
    () => kitchenOrders.filter((order) => !['served', 'completed', 'cancelled'].includes(order.overall_status)).slice(0, 4),
    [kitchenOrders],
  );

  return (
    <div className={`kaffe-checkout-panel min-w-0 flex-col border-[var(--brand-panel-border)] z-[60] md:z-20
      ${showMobileCart
        ? 'fixed inset-0 w-full h-full flex animate-in slide-in-from-bottom duration-300'
        : 'hidden md:flex w-[340px] xl:w-[380px] 2xl:w-[400px] border-l relative'
      }`}
    >
      {/* Sidebar header */}
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[var(--brand-panel-border)] bg-white px-4" style={showMobileCart ? { paddingTop: 'env(safe-area-inset-top,0px)', height: 'calc(4rem + env(safe-area-inset-top,0px))' } : undefined}>
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={onCloseMobileCart}
            className="md:hidden flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
            aria-label="Tutup keranjang"><X size={18} /></button>
          <div className="min-w-0">
            <h2 className="font-display text-[17px] font-extrabold leading-tight text-slate-900">Pesanan</h2>
            <p className="text-[12px] font-semibold text-slate-500 kaffe-num">
              {cart.length === 0 ? 'Belum ada item' : `${cart.reduce((n, c) => n + c.qty, 0)} item`}
            </p>
          </div>
        </div>
        {cart.length > 0 && (
          <button type="button" onClick={handleClearCart}
            aria-label={clearConfirm ? 'Konfirmasi kosongkan keranjang' : 'Kosongkan keranjang'}
            className={`rounded-xl px-3 text-[12.5px] font-bold transition-colors ${clearConfirm ? 'bg-rose-50 text-rose-700' : 'text-slate-500 hover:bg-rose-50 hover:text-rose-700'}`}>
            {clearConfirm ? 'Ketuk lagi untuk hapus' : 'Kosongkan'}
          </button>
        )}
      </div>

      {/* Majoo Order Type & Table Management Bar */}
      <PosOrderTypeAndTableBar
        orderType={orderType}
        onChangeOrderType={onChangeOrderType}
        tableNumber={tableNumber}
        pax={pax}
        openBillsCount={openBillsCount}
        onOpenTableModal={onOpenTableModal}
      />

      {/* Kitchen orders strip */}
      {activeKitchenOrders.length > 0 && (
        <div className="border-b border-[var(--brand-panel-border)] bg-white px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-stone-500">
              <ChefHat size={13} />
              Status Dapur
            </div>
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('kaffepos-open-tab', { detail: { tab: 'kitchen' } }))}
              className="text-[10px] font-black uppercase tracking-wider text-[#FF6A00]">Buka</button>
          </div>
          <div className="space-y-2">
            {activeKitchenOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-stone-800">{order.order_number}</p>
                  <p className="truncate text-[10px] font-bold text-stone-400">{order.customer_name || order.table_number || 'Walk-in'}</p>
                </div>
                <span className={`ml-2 rounded-lg px-2 py-1 text-[10px] font-black uppercase border ${order.overall_status==='pending'?'bg-amber-50 text-amber-700 border-amber-200':order.overall_status==='preparing'?'bg-sky-50 text-sky-700 border-sky-200':'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                  {order.overall_status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty cart state — atmospheric */}
      {cart.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-[var(--brand-canvas)]">
            <CoffeeCupIcon className="h-8 w-8 text-stone-300"/>
          </div>
          <p className="font-display text-base font-extrabold text-slate-800">Belum ada pesanan</p>
          <p className="mt-1 max-w-[220px] text-[13px] font-medium leading-relaxed text-slate-500">
            Ketuk menu di katalog untuk mulai mencatat pesanan.
          </p>
        </div>
      ) : (
        /* Cart items */
        <ul className="flex-1 divide-y divide-[var(--brand-hairline)] overflow-y-auto px-4">
          {cart.map(c => (
            <li key={c.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-slate-900">{c.name}</p>
                  <p className="mt-0.5 text-[12px] font-medium text-slate-500 kaffe-num">{fRp(c.price)} / item</p>
                </div>
                <p className="shrink-0 text-[14px] font-extrabold text-slate-900 kaffe-num">{fRp(c.price * c.qty)}</p>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={c.note || ''}
                  onChange={(e) => setCartItemNote(c.id, e.target.value)}
                  aria-label={`Catatan untuk ${c.name}`}
                  placeholder="Tambah catatan"
                  className="h-10 min-w-0 flex-1 rounded-xl border border-transparent bg-[var(--brand-canvas)] px-3 font-medium text-slate-700 placeholder:text-slate-500 outline-none transition focus:border-[#FF6A00]/60 focus:bg-white focus:ring-4 focus:ring-[#FF6A00]/15"
                  style={{ fontSize: 13 }}
                />
                <div className="flex shrink-0 items-center rounded-xl border border-[var(--brand-panel-border)] bg-white">
                  <button type="button" onClick={() => updateQty(c.id, c.qty - 1)} className="flex h-11 w-11 items-center justify-center rounded-l-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900" aria-label={c.qty <= 1 ? `Hapus ${c.name}` : `Kurangi ${c.name}`}>
                    {c.qty <= 1 ? <X size={15} strokeWidth={2.6} /> : <Minus size={15} strokeWidth={2.6}/>}
                  </button>
                  <span className="w-7 text-center text-[14px] font-extrabold text-slate-900 kaffe-num">{c.qty}</span>
                  <button type="button" onClick={() => updateQty(c.id, c.qty + 1)} className="flex h-11 w-11 items-center justify-center rounded-r-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900" aria-label={`Tambah ${c.name}`}><Plus size={15} strokeWidth={2.6}/></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Bottom checkout panel */}
      {cart.length > 0 && (
        <div className="shrink-0 border-t border-[var(--brand-panel-border)] bg-white px-4 pt-3" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom,0px))' }}>
          <dl className="space-y-1.5 text-[13px]">
            <div className="flex justify-between font-medium text-slate-600">
              <dt>Subtotal</dt>
              <dd className="kaffe-num">{fRp(subtotal)}</dd>
            </div>
            {discAmt > 0 && (
              <div className="flex justify-between font-semibold text-rose-700">
                <dt>Diskon</dt>
                <dd className="kaffe-num">-{fRp(discAmt)}</dd>
              </div>
            )}
            {taxAmt > 0 && (
              <div className="flex justify-between font-medium text-slate-600">
                <dt>Pajak ({taxPct}%)</dt>
                <dd className="kaffe-num">{fRp(taxAmt)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t border-dashed border-[var(--brand-panel-border)] pt-2.5">
              <dt className="text-[14px] font-bold text-slate-800">Total</dt>
              <dd className="font-display text-[26px] font-extrabold leading-none tracking-tight text-slate-900 kaffe-num">{fRp(total)}</dd>
            </div>
          </dl>

          <div className="mt-3 flex gap-2">
            {onSaveOpenBill && (
              <button
                type="button"
                onClick={onSaveOpenBill}
                disabled={savingOpenBill}
                className="flex h-14 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-[var(--brand-panel-border)] bg-white px-3 text-[13px] font-bold text-slate-700 transition-colors hover:border-orange-200 hover:bg-[var(--brand-orange-soft)] disabled:opacity-50"
              >
                <BookmarkCheck size={16} className="text-[var(--brand-orange-text)]" />
                <span>{activeOpenBillId ? 'Update Bill' : 'Simpan Bill'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenPay}
              className="kaffe-gradient-cta flex h-14 flex-[1.6] items-center justify-center gap-2 rounded-2xl text-[19px] font-extrabold"
            >
              Bayar <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
