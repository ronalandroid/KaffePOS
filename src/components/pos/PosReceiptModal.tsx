/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/pos/PosReceiptModal.tsx — post-checkout receipt: success badge,
// optional customer + kitchen-status panels, the thermal-style itemized receipt,
// and the print / share / new-transaction actions. Presentational; the
// transaction and kitchen-order data plus action handlers come from POSTab.
import { useState, useEffect } from 'react';
import { Printer, Share2 } from 'lucide-react';
import type { KitchenOrder, Transaction } from '@/types';
import { ORDER_TYPE_META, fRp, type PosModalBehavior } from './posHelpers';

type Props = {
  receiptModal: PosModalBehavior;
  lastTx: Transaction;
  lastTxKitchenOrder: KitchenOrder | null;
  onClose: () => void;
  onPrint: () => void;
  onShareWhatsApp: () => void;
};

export default function PosReceiptModal({
  receiptModal,
  lastTx,
  lastTxKitchenOrder,
  onClose,
  onPrint,
  onShareWhatsApp,
}: Props) {
  const [animating, setAnimating] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setAnimating(false), 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="kaffe-modal-overlay fixed inset-0 z-[80] flex items-center justify-center bg-stone-900/60 backdrop-blur-sm"
      onClick={receiptModal.onBackdropClick}
    >
      <div
        ref={receiptModal.panelRef}
        className="kaffe-modal-panel bg-white w-full max-w-[360px] overflow-y-auto rounded-[28px] p-6 shadow-2xl animate-in zoom-in-95 duration-200"
        aria-labelledby="pos-receipt-title"
        {...receiptModal.dialogProps}
      >
        <div className="text-center mb-6">
          <div className="relative mx-auto mb-4 size-20 flex items-center justify-center">
            {animating && <span className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" style={{ animationDuration: '1.6s' }} />}
            {animating && <span className="absolute inset-[6px] rounded-full bg-emerald-100/60 animate-ping" style={{ animationDuration: '1.6s', animationDelay: '0.7s' }} />}
            <span className="relative z-10 size-full bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-9 text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg></span>
          </div>
          <h3 id="pos-receipt-title" className="font-display font-black text-2xl text-stone-800 tracking-tight">Lunas!</h3>
          <p className="text-stone-400 text-xs font-medium mt-1">#{lastTx.id}</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            {lastTx.order_type && (
              <span className="rounded-full bg-orange-50 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#FF6A00] border border-orange-200">
                {ORDER_TYPE_META[lastTx.order_type]?.shortLabel || lastTx.order_type}
              </span>
            )}
            {lastTx.table_number && (
              <span className="rounded-full bg-stone-900 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                Meja {lastTx.table_number}{lastTx.pax ? ` • ${lastTx.pax} Pax` : ''}
              </span>
            )}
            {lastTx.sync_status === 'pending' && (
              <span className="rounded-full bg-amber-100 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700">
                Menunggu Sync
              </span>
            )}
          </div>
        </div>

        {lastTx.customer_name && (
          <div className="bg-stone-50 border border-stone-100 rounded-2xl py-3 px-4 mb-5 text-center">
            <p className="text-[10px] font-black text-stone-400 tracking-widest mb-1 uppercase">Pemesan</p>
            <p className="text-xl font-black text-stone-800">{lastTx.customer_name}</p>
          </div>
        )}

        {lastTxKitchenOrder && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl py-3 px-4 mb-5 text-center">
            <p className="text-[10px] font-black text-amber-500 tracking-widest mb-1 uppercase">Status Dapur</p>
            <p className="text-lg font-black text-amber-800">{lastTxKitchenOrder.overall_status}</p>
          </div>
        )}

        {/* Thermal receipt style — dashed border + monospace amounts */}
        <div className="bg-white border border-dashed border-stone-200 rounded-2xl p-4 mb-6 text-sm">
          {lastTx.items.map((i: any) => (
            <div key={`${i.id || i.menu_item_id || i.name}-${i.qty}-${i.subtotal}`} className="mb-2">
              <div className="flex justify-between">
                <span className="text-stone-600 font-medium">{i.name} <span className="font-bold text-stone-800">x{i.qty}</span></span>
                <span className="font-mono font-bold text-stone-800 text-[13px]">{fRp(i.subtotal)}</span>
              </div>
              {i.note && <p className="mt-0.5 text-xs font-bold text-amber-600">Catatan: {i.note}</p>}
            </div>
          ))}
          <div className="border-t border-dashed border-stone-200 pt-3 mt-3">
            <div className="flex justify-between font-black text-lg">
              <span className="text-stone-700">Total Tagihan</span>
              <span className="font-mono text-stone-900">{fRp(lastTx.total)}</span>
            </div>
            {lastTx.method === 'Tunai' && (
              <div className="flex justify-between text-emerald-600 font-bold mt-1 text-sm">
                <span>Uang Kembali</span>
                <span className="font-mono">{fRp(lastTx.change)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Receipt action buttons */}
        <button type="button" onClick={onPrint}
          className="w-full py-3.5 mb-3 bg-white border-2 border-stone-200 text-stone-700 hover:bg-stone-50 hover:border-stone-300 font-black rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all">
          <Printer size={16} strokeWidth={2.5}/> Cetak Struk Fisik
        </button>
        <button type="button" onClick={onShareWhatsApp}
          className="w-full py-3.5 mb-3 bg-orange-50 border-2 border-orange-100 text-orange-600 hover:bg-orange-100 font-black rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all">
          <Share2 size={16} strokeWidth={2.5}/> Share WA
        </button>
        <button type="button" onClick={onClose}
          className="w-full py-4 font-black rounded-2xl active:scale-95 transition-all text-white bg-gradient-to-r from-[#FF6A00] to-[#FF8A1C] shadow-[0_8px_24px_rgba(255,106,0,0.35)] hover:shadow-[0_12px_32px_rgba(255,106,0,0.45)]">
          Transaksi Baru
        </button>
      </div>
    </div>
  );
}
