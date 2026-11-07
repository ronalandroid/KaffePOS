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
    <div className="border-b border-stone-200/60 bg-white px-4 py-3 space-y-2.5">
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
        {(['dine_in', 'takeaway', 'gofood', 'grabfood', 'shopeefood'] as const).map((type) => {
          const meta = ORDER_TYPE_META[type];
          const isActive = orderType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onChangeOrderType?.(type)}
              className={`shrink-0 rounded-xl px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider border transition-colors ${
                isActive
                  ? 'border-[#FF6A00] bg-[#FF6A00] text-white shadow-sm'
                  : 'border-stone-200 bg-stone-50 text-stone-600 hover:border-stone-300'
              }`}
            >
              {meta.shortLabel}
            </button>
          );
        })}
      </div>

      {onOpenTableModal && (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onOpenTableModal}
            className="flex flex-1 items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-700 transition-colors hover:border-[#FF6A00] hover:bg-orange-50/40"
          >
            <span className="flex items-center gap-1.5 truncate">
              <Utensils size={13} className="text-[#FF6A00] shrink-0" />
              {tableNumber ? (
                <span className="font-black text-stone-900">
                  Meja {tableNumber} • {pax} Pax
                </span>
              ) : (
                <span className="text-stone-500">Pilih Meja / Denah</span>
              )}
            </span>
            <span className="ml-2 rounded-lg bg-white px-2 py-0.5 text-[10px] font-black uppercase text-[#FF6A00] border border-orange-200">
              {openBillsCount > 0 ? `${openBillsCount} Open Bill` : 'Denah'}
            </span>
          </button>
        </div>
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
    <div className={`kaffe-checkout-panel min-w-0 flex-col bg-stone-50 border-stone-200/60 z-[60] md:z-20
      ${showMobileCart
        ? 'fixed inset-0 w-full h-full flex animate-in slide-in-from-bottom duration-300'
        : 'hidden md:flex w-[340px] lg:w-[420px] border-l shadow-[-10px_0_30px_rgba(0,0,0,0.02)] relative'
      }`}
    >
      {/* Sidebar header */}
      <div className="px-5 py-4 border-b border-stone-200/60 flex items-center justify-between bg-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onCloseMobileCart}
            className="md:hidden size-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200 hover:text-stone-800 min-w-0 min-h-0 kaffe-btn-compact transition-colors"
            aria-label="Tutup keranjang"><X size={16} /></button>
          <h2 className="font-black text-stone-800 tracking-tight">Pesanan Hari Ini</h2>
        </div>
        {cart.length > 0 && (
          <button type="button" onClick={handleClearCart}
            aria-label={clearConfirm ? 'Konfirmasi kosongkan keranjang' : 'Kosongkan keranjang'}
            className={`text-[10px] uppercase tracking-wider font-black transition-colors ${clearConfirm ? 'text-rose-600' : 'text-stone-400 hover:text-rose-500'}`}>
            {clearConfirm ? 'Yakin? Ketuk lagi' : 'Kosongkan'}
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
        <div className="border-b border-stone-100 bg-white px-4 py-3">
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
          <div className="size-28 bg-gradient-to-b from-stone-50 to-stone-100 rounded-[40px] flex items-center justify-center mb-7 relative shadow-inner">
            <div className="absolute inset-0 bg-stone-200/40 rounded-[40px] animate-ping" style={{ animationDuration: '3s' }} />
            <CoffeeCupIcon className="w-12 h-12 text-stone-200 relative z-10"/>
          </div>
          <p className="font-black text-stone-700 text-lg tracking-tight">Belum ada pesanan</p>
          <p className="mt-2 max-w-[200px] text-xs font-medium leading-relaxed text-stone-400">
            Ketuk menu di sebelah kiri untuk memulai
          </p>
        </div>
      ) : (
        /* Cart items */
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.map(c => (
            <div
              key={c.id}
              className="flex gap-4 bg-white p-4 rounded-2xl border border-stone-100 shadow-sm transition-all hover:border-[#FF6A00]/20 hover:shadow-[0_4px_16px_rgba(255,106,0,0.06)]"
            >
              <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-start gap-2 mb-1">
                  <p className="font-bold text-stone-800 text-[14px] truncate">{c.name}</p>
                    <button type="button" onClick={() => updateQty(c.id, 0)}
                    className="text-stone-300 hover:text-rose-500 transition-colors kaffe-btn-compact shrink-0"
                    aria-label="Hapus item"><X size={14} /></button>
                </div>
                <p className="text-stone-400 text-[12px] font-medium mb-3 tabular-nums">{fRp(c.price)}</p>
                <input
                  value={c.note || ''}
                  onChange={(e) => setCartItemNote(c.id, e.target.value)}
                  aria-label={`Catatan untuk ${c.name}`}
                  placeholder="Catatan…"
                  className="w-full rounded-xl border border-stone-100 bg-stone-50 px-3 py-2 text-[12px] font-semibold text-stone-600 outline-none transition focus:border-[#FF6A00]/60 focus:bg-white focus:ring-4 focus:ring-[#FF6A00]/40"
                />
              </div>
              <div className="flex flex-col items-end justify-between py-1">
                <p className="font-black text-stone-800 text-[14px] tabular-nums">{fRp(c.price * c.qty)}</p>
                <div className="flex items-center gap-2 mt-2 bg-stone-50 rounded-xl border border-stone-200/60 p-1 shadow-inner">
                  <button type="button" onClick={() => updateQty(c.id, c.qty - 1)} className="size-10 flex items-center justify-center text-stone-500 hover:bg-white hover:text-stone-800 rounded-lg shadow-sm transition-all kaffe-btn-compact" aria-label={`Kurangi ${c.name}`}><Minus size={16} strokeWidth={3}/></button>
                  <span className="font-black text-sm w-5 text-center text-stone-800 tabular-nums">{c.qty}</span>
                  <button type="button" onClick={() => updateQty(c.id, c.qty + 1)} className="size-10 flex items-center justify-center text-stone-500 hover:bg-white hover:text-stone-800 rounded-lg shadow-sm transition-all kaffe-btn-compact" aria-label={`Tambah ${c.name}`}><Plus size={16} strokeWidth={3}/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom checkout panel */}
      {cart.length > 0 && (
        <div className="bg-white border-t border-stone-200/60 p-5 shadow-[0_-12px_40px_rgba(0,0,0,0.03)]">
          <div className="space-y-3 mb-5">
            <div className="flex justify-between text-sm font-medium text-stone-400">
              <span>Subtotal ({cart.length} item)</span>
              <span>{fRp(subtotal)}</span>
            </div>
            {discAmt > 0 && (
              <div className="flex justify-between text-sm font-bold text-rose-500">
                <span>Diskon</span>
                <span>-{fRp(discAmt)}</span>
              </div>
            )}
            {taxAmt > 0 && (
              <div className="flex justify-between text-sm font-medium text-stone-400">
                <span>Pajak ({taxPct}%)</span>
                <span>{fRp(taxAmt)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-4 border-t border-stone-200 mt-2">
              <span className="text-sm font-black text-stone-700 uppercase tracking-wider">Total Tagihan</span>
              <span className="text-3xl font-black tracking-tight" style={{color:'var(--brand-orange-text)'}}>{fRp(total)}</span>
            </div>
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={handleClearCart}
              className="h-14 px-4 rounded-2xl border border-stone-200 text-stone-400 text-xs font-bold hover:bg-stone-50 hover:border-stone-300 transition-colors"
            >
              Batal
            </button>
            {onSaveOpenBill && (
              <button
                type="button"
                onClick={onSaveOpenBill}
                disabled={savingOpenBill}
                className="flex-1 h-14 rounded-2xl border-2 border-[#FF6A00]/30 bg-orange-50/80 px-3 text-xs font-black uppercase tracking-wider text-[#FF6A00] hover:bg-orange-100/80 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <BookmarkCheck size={16} />
                <span>{activeOpenBillId ? 'Update Bill' : 'Simpan Bill'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenPay}
              className="flex-[1.5] h-14 rounded-2xl bg-gradient-to-r from-[#FF6A00] to-[#FF8A1C] text-white font-black uppercase tracking-wider shadow-[0_8px_24px_rgba(255,106,0,0.35)] hover:shadow-[0_12px_32px_rgba(255,106,0,0.45)] hover:scale-[1.02] active:scale-100 transition-transform flex items-center justify-center gap-2"
            >
              BAYAR <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
