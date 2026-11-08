// src/components/pos/PosVoucherModal.tsx — promo/voucher picker action sheet.
// Applies a preset discount to the cart and closes. Reads the discount slice
// directly; the modal-behavior object and toast come from POSTab.
import { Plus, X } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { PROMOS, type PosModalBehavior } from './posHelpers';

type Props = {
  voucherModal: PosModalBehavior;
  onClose: () => void;
  toast: { showToast: (m: string, t?: 'success' | 'error' | 'warning' | 'info') => void };
};

export default function PosVoucherModal({ voucherModal, onClose, toast }: Props) {
  const discount = useStore((s) => s.discount);
  const setDiscount = useStore((s) => s.setDiscount);

  return (
    <div
      className="kaffe-modal-overlay fixed inset-0 z-[90] flex items-end justify-center bg-stone-900/60 backdrop-blur-sm md:items-center"
      onClick={voucherModal.onBackdropClick}
    >
      <div
        ref={voucherModal.panelRef}
        className="kaffe-panel kaffe-modal-panel w-full max-w-[500px] overflow-y-auto rounded-t-[28px] p-6 shadow-2xl animate-in slide-in-from-bottom-20 duration-500 sm:p-8 md:rounded-[28px]"
        aria-labelledby="pos-voucher-title"
        {...voucherModal.dialogProps}
      >
        <div className="flex items-center justify-between mb-7">
          <div>
            <h3 id="pos-voucher-title" className="font-display text-2xl font-black text-stone-900 tracking-tight">Pilih Promo</h3>
            <p className="text-stone-400 text-xs font-bold uppercase tracking-widest mt-1">Diskon Terpopuler</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup promo"
            className="p-3 bg-white border border-stone-100 rounded-2xl text-stone-400 hover:bg-orange-50 hover:text-[#FF6A00] transition-colors">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 scrollbar-thin">
          {PROMOS.map((promo) => (
            <button type="button" key={promo.l}
              onClick={() => { setDiscount(promo.v); onClose(); toast.showToast(`Promo ${promo.l} diterapkan!`, 'success'); }}
              className={`w-full text-left p-5 rounded-2xl border-2 transition-all active:scale-[0.98] flex items-center justify-between group ${discount===promo.v?'border-orange-500 bg-orange-50':'border-stone-100 bg-white hover:border-orange-200 hover:bg-orange-50/40'}`}>
              <div className="flex-1">
                <p className={`font-black text-lg uppercase tracking-tight ${discount===promo.v?'text-orange-600':'text-stone-800'}`}>{promo.l}</p>
                <p className="text-stone-400 text-xs font-medium mt-0.5">{promo.d}</p>
              </div>
              <div className={`size-10 rounded-2xl flex items-center justify-center transition-all ${discount===promo.v?'bg-orange-500 text-white shadow-lg shadow-orange-500/40':'bg-white text-stone-300 border border-stone-200 group-hover:border-stone-300'}`}>
                <Plus size={20}/>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-7 pt-6 border-t border-stone-100 flex flex-col gap-4">
          <p className="text-[10px] font-black text-stone-400 uppercase text-center tracking-[0.3em]">Atau input manual di halaman checkout</p>
          <button type="button" onClick={onClose}
            className="w-full py-5 bg-stone-900 text-white font-black rounded-2xl text-sm shadow-xl active:scale-95 transition-all">
            Konfirmasi Pilihan
          </button>
        </div>
      </div>
    </div>
  );
}
