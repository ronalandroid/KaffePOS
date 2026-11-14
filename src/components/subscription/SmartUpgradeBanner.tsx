import { ArrowRight, X } from 'lucide-react';
import { formatRupiah, getPlanPrice } from '@/lib/subscriptionPlans';

type Props = {
  used: number;
  limit: number;
  percent: number;
  role?: 'owner_admin' | 'cashier' | null;
  onUpgrade: () => void;
  onDismiss: () => void;
};

export default function SmartUpgradeBanner({ used, limit, percent, role, onUpgrade, onDismiss }: Props) {
  const width = Math.max(8, Math.min(100, percent));
  return (
    <div className="flex-shrink-0 border-b border-orange-100 bg-[var(--brand-orange-soft)] px-3 py-2 sm:px-5">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <div className="hidden h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-orange-100 sm:block" aria-hidden="true">
          <div className="h-full rounded-full bg-[#FF6A00]" style={{ width: `${width}%` }} />
        </div>
        <p className="min-w-0 flex-1 text-[12.5px] font-semibold leading-snug text-orange-950">
          <span className="font-extrabold">{used}/{limit} transaksi gratis terpakai.</span>{' '}
          <span className="text-orange-900/90">
            {role === 'cashier'
              ? 'Minta Owner/Admin upgrade agar kasir tetap bisa transaksi.'
              : `Upgrade mulai ${formatRupiah(getPlanPrice('kopi_susu', 'monthly'))}/bulan untuk transaksi tanpa batas.`}
          </span>
        </p>
        <button
          type="button"
          onClick={onUpgrade}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 text-[12px] font-bold text-[var(--brand-orange-text)] ring-1 ring-orange-200 hover:bg-orange-50"
        >
          {role === 'cashier' ? 'Beritahu Owner' : 'Lihat Paket'}
          <ArrowRight size={14} />
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-orange-800 hover:bg-orange-100"
          aria-label="Tutup banner upgrade"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
