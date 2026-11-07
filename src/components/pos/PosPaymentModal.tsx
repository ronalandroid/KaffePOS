// src/components/pos/PosPaymentModal.tsx — checkout modal: gradient total card,
// order summary, QRIS payment-status live region, customer + loyalty + discount
// inputs, payment-method selector, cash-received panel, and the confirm CTA.
// Presentational: all checkout/loyalty/payment state and handlers stay in the
// POSTab container and are passed in; the modal reads only the cart/discount
// slices it renders directly.
import { useState, useMemo } from 'react';
import { X, RefreshCw, CheckCircle2, Banknote, Gift, Landmark, Smartphone, AlertCircle, Split } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import LoyaltyCheckoutModal from '@/components/loyalty/LoyaltyCheckoutModal';
import { canProcessPosPaymentOffline } from '@/lib/offlinePolicy';
import type { SecurePaymentCreateResponse, SecurePaymentOrderStatus } from '@/lib/backendApi';
import type { LoyaltyPassport, LoyaltyReward, LoyaltySettings } from '@/lib/loyalty';
import type { OrderType } from '@/types';
import { ORDER_TYPE_META, fRp, quickAmounts, getPaymentMessage, type PaymentPhase, type PosModalBehavior } from './posHelpers';

type PaymentMethod = 'Tunai' | 'Transfer' | 'QRIS';

type Props = {
  paymentModal: PosModalBehavior;
  onClose: () => void;
  onCheckout: (splitItemIds?: string[]) => void;
  onOpenVouchers: () => void;
  subtotal: number;
  discAmt: number;
  taxAmt: number;
  total: number;
  method: PaymentMethod;
  setMethod: (method: PaymentMethod) => void;
  cash: string;
  setCash: (value: string) => void;
  paid: number;
  change: number;
  custName: string;
  setCustName: (value: string) => void;
  checkingOut: boolean;
  paymentPhase: PaymentPhase;
  paymentOrder: SecurePaymentCreateResponse | null;
  paymentStatus: SecurePaymentOrderStatus | null;
  loyaltyPhone: string;
  setLoyaltyPhone: (value: string) => void;
  onLoyaltySearch: () => void;
  loyaltySearching: boolean;
  loyaltyPassport: LoyaltyPassport | null;
  loyaltySettings: LoyaltySettings | null | undefined;
  loyaltyRewards: LoyaltyReward[];
  loyaltyReward: LoyaltyReward | null;
  onApplyLoyaltyReward: (reward: LoyaltyReward) => void;
  onClearLoyaltyReward: () => void;
  orderType?: OrderType;
  tableNumber?: string;
  pax?: number;
};

export default function PosPaymentModal({
  paymentModal,
  onClose,
  onCheckout,
  onOpenVouchers,
  subtotal,
  discAmt,
  taxAmt,
  total,
  method,
  setMethod,
  cash,
  setCash,
  paid,
  change,
  custName,
  setCustName,
  checkingOut,
  paymentPhase,
  paymentOrder,
  paymentStatus,
  loyaltyPhone,
  setLoyaltyPhone,
  onLoyaltySearch,
  loyaltySearching,
  loyaltyPassport,
  loyaltySettings,
  loyaltyRewards,
  loyaltyReward,
  onApplyLoyaltyReward,
  onClearLoyaltyReward,
  orderType = 'dine_in',
  tableNumber = '',
  pax = 1,
}: Props) {
  const cart = useStore((s) => s.cart);
  const discount = useStore((s) => s.discount);
  const setDiscount = useStore((s) => s.setDiscount);
  const isOnline = useStore((s) => s.isOnline);
  const paymentMessage = getPaymentMessage(paymentPhase);

  const [splitMode, setSplitMode] = useState<'none' | 'equal' | 'items'>('none');
  const [splitParts, setSplitParts] = useState<number>(2);
  const [selectedSplitIds, setSelectedSplitIds] = useState<string[]>([]);

  const splitItemsTotal = useMemo(() => {
    if (splitMode !== 'items' || selectedSplitIds.length === 0) return total;
    const rawSub = cart
      .filter((c) => selectedSplitIds.includes(c.id))
      .reduce((s, c) => s + c.price * c.qty, 0);
    return rawSub;
  }, [cart, selectedSplitIds, splitMode, total]);

  const isSplitItemsActive = splitMode === 'items' && selectedSplitIds.length > 0;
  const effectiveTotal = isSplitItemsActive ? splitItemsTotal : total;
  const effectivePaid = isSplitItemsActive ? (method === 'Tunai' ? parseInt(cash) || 0 : effectiveTotal) : paid;
  const effectiveChange = isSplitItemsActive ? Math.max(0, effectivePaid - effectiveTotal) : change;

  const toggleSplitItem = (itemId: string) => {
    setSelectedSplitIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
    );
  };

  return (
    <div
      className="kaffe-modal-overlay fixed inset-0 z-[70] flex items-end justify-center bg-stone-900/60 backdrop-blur-sm md:items-center"
      onClick={paymentModal.onBackdropClick}
    >
      <div
        ref={paymentModal.panelRef}
        className="kaffe-panel kaffe-modal-panel w-full max-w-[500px] overflow-y-auto rounded-t-[28px] p-6 shadow-2xl animate-in slide-in-from-bottom-20 duration-500 sm:p-8 md:rounded-[28px]"
        aria-labelledby="pos-payment-title"
        {...paymentModal.dialogProps}
      >
        <div className="flex items-center justify-between mb-7">
          <div>
            <h3 id="pos-payment-title" className="font-display text-2xl font-black text-stone-900 tracking-tight">Pembayaran</h3>
            <p className="text-stone-400 text-[11px] font-bold uppercase tracking-widest mt-1">Konfirmasi pesanan</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup pembayaran"
            className="p-3 bg-white border border-stone-100 rounded-2xl text-stone-400 hover:bg-orange-50 hover:text-[#FF6A00] transition-colors">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Total amount — gradient card. Shades chosen so white text meets WCAG AA
            (white on #C44500 = 5.0:1, on #CC4A00 = 4.62:1) across the full gradient. */}
        <div className="bg-gradient-to-br from-[#C44500] to-[#CC4A00] rounded-3xl p-6 text-center mb-5 shadow-[0_8px_32px_rgba(255,106,0,0.35)]">
          <div className="mb-2 flex items-center justify-center gap-2">
            <span className="rounded-full bg-white/20 px-3 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">
              {ORDER_TYPE_META[orderType]?.shortLabel || 'Dine-In'}
            </span>
            {tableNumber && (
              <span className="rounded-full bg-white/20 px-3 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">
                Meja {tableNumber} • {pax} Pax
              </span>
            )}
          </div>
          <p className="text-[11px] font-black text-white/80 uppercase tracking-widest mb-1">
            {splitMode === 'items' && selectedSplitIds.length > 0 ? 'Tagihan Split Item Dipilih' : 'Total Tagihan'}
          </p>
          <h3 className="text-4xl sm:text-5xl font-black text-white tracking-tight">{fRp(effectiveTotal)}</h3>
          {splitMode === 'equal' && (
            <p className="mt-2 text-xs font-black text-white/90">
              Bagi Rata {splitParts} Orang: {fRp(Math.ceil(total / splitParts))} / orang
            </p>
          )}
        </div>

        {/* Majoo Split Bill Control */}
        {cart.length > 0 && (
          <div className="mb-5 rounded-2xl border border-stone-200 bg-stone-50/80 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-stone-700">
                <Split size={14} className="text-[#FF6A00]" /> Split Bill (Bayar Pisah)
              </span>
              <div className="flex gap-1.5">
                {[
                  { id: 'none', label: 'Bayar Penuh' },
                  { id: 'equal', label: 'Bagi Rata' },
                  { id: 'items', label: 'Pisah Item' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSplitMode(m.id as 'none' | 'equal' | 'items');
                      if (m.id === 'items' && selectedSplitIds.length === 0 && cart[0]) {
                        setSelectedSplitIds([cart[0].id]);
                      }
                    }}
                    className={`rounded-xl px-2.5 py-1 text-[10px] font-black uppercase transition-colors ${
                      splitMode === m.id
                        ? 'bg-[#FF6A00] text-white'
                        : 'bg-white text-stone-500 border border-stone-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {splitMode === 'equal' && (
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-stone-200/70 pt-3">
                <div className="flex items-center gap-1.5">
                  {[2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSplitParts(n)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-black ${
                        splitParts === n ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200 text-stone-600'
                      }`}
                    >
                      {n}x
                    </button>
                  ))}
                </div>
                <span className="font-mono text-xs font-black text-[#FF6A00]">
                  {fRp(Math.ceil(total / splitParts))} / orang
                </span>
              </div>
            )}

            {splitMode === 'items' && (
              <p className="mt-2 text-[11px] font-semibold text-stone-500">
                Centang item di Ringkasan Order bawah yang ingin dibayar sekarang. Sisa item tetap tersimpan di keranjang/meja.
              </p>
            )}
          </div>
        )}

        {/* Order summary */}
        <div className="mb-7 rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-widest text-stone-400">Ringkasan Order</p>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-orange-600">{cart.length} item</span>
          </div>
          <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
            {cart.map((item) => {
              const isChecked = selectedSplitIds.includes(item.id);
              return (
                <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="flex items-start gap-2.5 min-w-0">
                    {splitMode === 'items' && (
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSplitItem(item.id)}
                        aria-label={`Pilih ${item.name} untuk split bill`}
                        className="mt-1 size-4 rounded border-stone-300 text-[#FF6A00] focus:ring-[#FF6A00]"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-bold text-stone-700">{item.qty}x {item.name}</p>
                      {item.note && <p className="truncate text-[11px] font-semibold text-amber-600">Catatan: {item.note}</p>}
                    </div>
                  </div>
                  <p className="shrink-0 font-black text-stone-800">{fRp(item.price * item.qty)}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 space-y-2 border-t border-stone-100 pt-3 text-sm">
            <div className="flex justify-between text-stone-400"><span>Subtotal</span><span>{fRp(subtotal)}</span></div>
            {discAmt > 0 && <div className="flex justify-between font-bold text-rose-500"><span>Diskon</span><span>-{fRp(discAmt)}</span></div>}
            {taxAmt > 0 && <div className="flex justify-between text-stone-400"><span>Pajak</span><span>{fRp(taxAmt)}</span></div>}
            <div className="flex justify-between text-base font-black text-stone-900"><span>Total</span><span style={{color:'var(--brand-orange-text)'}}>{fRp(effectiveTotal)}</span></div>
          </div>
        </div>

        {/* QRIS payment status banner. The live region stays mounted (empty when idle)
            so screen readers announce each payment-phase change to the cashier. */}
        <div role="status" aria-live="polite" aria-atomic="true">
          {paymentMessage && method === 'QRIS' && (
            <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-bold ${paymentPhase==='success'?'border-emerald-200 bg-emerald-50 text-emerald-700':['failed','cancelled','expired','denied'].includes(paymentPhase)?'border-rose-200 bg-rose-50 text-rose-700':'border-orange-200 bg-orange-50 text-orange-700'}`}>
              <div className="flex items-start gap-2">
                {['failed','cancelled','expired','denied'].includes(paymentPhase)?<AlertCircle size={18} aria-hidden="true"/>:<RefreshCw size={18} aria-hidden="true" className={checkingOut?'animate-spin':''}/>}
                <div>
                  <p>{paymentMessage}</p>
                  {paymentOrder && <p className="mt-1 text-[11px] font-black uppercase tracking-wider opacity-70">{paymentOrder.order_id}</p>}
                  {paymentStatus?.transaction_status && <p className="mt-1 text-[11px] font-black uppercase tracking-wider opacity-70">Status: {paymentStatus.transaction_status}</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Customer name + loyalty + discount */}
        <div className="space-y-4 mb-7">
          <div>
            <label htmlFor="pos-customer-name" className="text-[11px] font-black tracking-wider text-stone-400 uppercase block mb-2 ml-1">Nama Pelanggan (Opsional)</label>
            <input id="pos-customer-name" value={custName} onChange={e => setCustName(e.target.value)} placeholder="Contoh: Budi - Meja 05" className="h-14 w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-5 text-[16px] font-bold focus:outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-[#FF6A00]/40 transition-all"/>
          </div>

          <LoyaltyCheckoutModal
            phone={loyaltyPhone}
            onPhoneChange={setLoyaltyPhone}
            onSearch={onLoyaltySearch}
            searching={loyaltySearching}
            passport={loyaltyPassport}
            settings={loyaltySettings}
            rewards={loyaltyRewards}
            activeReward={loyaltyReward}
            onApplyReward={onApplyLoyaltyReward}
            onClearReward={onClearLoyaltyReward}
          />

          <div>
            <div className="flex items-center justify-between mb-2 ml-1">
              <label htmlFor="pos-discount" className="text-[11px] font-black tracking-wider text-stone-400 uppercase">
                Promo & Diskon
              </label>
              <button type="button" onClick={onOpenVouchers}
                className="inline-flex items-center gap-1.5 text-[11px] font-black text-orange-500 uppercase tracking-widest hover:underline">
                <Gift size={13} /> Pilih Promo
              </button>
            </div>
            <div className="relative">
              <input
                id="pos-discount"
                value={discount || ''}
                onChange={e => setDiscount(e.target.value)}
                placeholder="10% atau 5000"
                className={`w-full h-14 bg-stone-50 border-2 rounded-2xl px-5 text-[16px] focus:outline-none focus:ring-4 focus:ring-[#FF6A00]/40 transition-all font-bold ${
                  discAmt > 0 ? 'border-green-300 bg-green-50 text-green-600' : 'border-stone-100 focus:border-[#FF6A00]'
                }`}
              />
              {discAmt > 0 && <CheckCircle2 size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-green-500" />}
            </div>
          </div>
        </div>

        {/* Payment method — compact 3-column grid */}
        <div className="space-y-3 mb-7">
          <p className="text-[11px] font-black text-stone-400 uppercase tracking-widest ml-1">Metode Pembayaran</p>
          <div className="grid grid-cols-3 gap-2.5">
            {([
              { id: 'Tunai', icon: Banknote, label: 'Tunai' },
              { id: 'QRIS', icon: Smartphone, label: 'QRIS' },
              { id: 'Transfer', icon: Landmark, label: 'Transfer' },
            ] as const).map((m) => {
              const Icon = m.icon;
              return (
                <button type="button" key={m.id} onClick={() => setMethod(m.id)}
                  disabled={!isOnline && !canProcessPosPaymentOffline(m.id)}
                  aria-pressed={method === m.id}
                  className={`flex flex-col items-center justify-center gap-2 py-4 rounded-2xl border-2 font-black text-[12px] transition-all disabled:opacity-30 ${method===m.id?'border-[#FF6A00] bg-orange-50 shadow-[0_4px_16px_rgba(255,106,0,0.15)]':'border-stone-100 text-stone-500 bg-white hover:border-stone-200'}`}
                  style={method===m.id?{color:'var(--brand-orange-text)'}:undefined}>
                  <span className={`flex size-9 items-center justify-center rounded-xl ${method===m.id?'bg-[#FF6A00] text-white':'bg-stone-50 text-stone-400'}`}><Icon size={18}/></span>
                  <span className="leading-none">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cash received section */}
        {method === 'Tunai' && (
          <div className="mb-8 animate-in slide-in-from-bottom-2 duration-300">
            <label htmlFor="pos-cash-received" className="text-[11px] font-black tracking-wider text-stone-400 uppercase block mb-2 ml-1">Uang Diterima</label>
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-stone-400">Rp</span>
              <input id="pos-cash-received" type="number" value={cash} onChange={e => setCash(e.target.value)} placeholder={String(effectiveTotal)} className="w-full border-2 border-stone-100 rounded-2xl pl-12 pr-5 py-5 text-3xl font-black tabular-nums focus:outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-[#FF6A00]/40 transition-colors bg-stone-50" inputMode="numeric"/>
            </div>
            {effectivePaid >= effectiveTotal && effectivePaid > 0 && (
              <div className="mt-4 flex justify-between items-center bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                <span className="text-sm font-bold text-emerald-700 uppercase tracking-widest">Kembalian</span>
                <span className="text-2xl font-black text-emerald-600 tabular-nums">{fRp(effectiveChange)}</span>
              </div>
            )}
            <div className="flex gap-2 mt-4 overflow-x-auto scrollbar-hide pb-1">
              {quickAmounts(effectiveTotal).map(amt => (
                <button type="button" key={amt} onClick={() => setCash(String(amt))} className="shrink-0 px-5 py-3 bg-white border-2 border-stone-100 rounded-xl text-xs font-black text-stone-600 tabular-nums active:scale-95 hover:border-[#FF6A00]/30 transition-colors">
                  {fRp(amt)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Payment CTA */}
        <button
          type="button"
          onClick={() => onCheckout(splitMode === 'items' && selectedSplitIds.length > 0 ? selectedSplitIds : undefined)}
          disabled={checkingOut || !cart.length || (method === 'Tunai' && effectivePaid < effectiveTotal) || paymentPhase === 'creating' || paymentPhase === 'pending'}
          className="w-full py-5 text-white font-black text-base rounded-2xl active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 transition-transform hover:scale-[1.01] uppercase tracking-wider bg-gradient-to-r from-[#FF6A00] to-[#FF8A1C] shadow-[0_8px_24px_rgba(255,106,0,0.4)] hover:shadow-[0_12px_32px_rgba(255,106,0,0.5)]"
        >
          {checkingOut
            ? <><RefreshCw size={22} className="animate-spin" /> MEMPROSES...</>
            : <>{splitMode === 'items' && selectedSplitIds.length > 0 ? `BAYAR SPLIT (${selectedSplitIds.length} ITEM)` : 'KONFIRMASI BAYAR'} <CheckCircle2 size={22} /></>
          }
        </button>
      </div>
    </div>
  );
}
