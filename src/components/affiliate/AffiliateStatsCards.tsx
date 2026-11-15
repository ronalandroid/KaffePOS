import { CheckCircle2, Clock3, CreditCard, MousePointerClick, Percent, Users, Wallet } from 'lucide-react';
import { fRp } from '@/utils/format';
import type { AffiliateDashboardData } from '@/types/affiliate';

export default function AffiliateStatsCards({ data }: { data: AffiliateDashboardData }) {
  const top = [
    { label: 'Klik', value: data.total_clicks, icon: MousePointerClick },
    { label: 'Pendaftaran', value: data.total_registrations, icon: Users },
    { label: 'Berbayar', value: data.total_paid_conversions, icon: CreditCard },
    { label: 'Persentase komisi', value: `${data.commission_rate || data.affiliate_profile.commission_rate || 20}%`, icon: Percent },
  ];
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {top.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
            <Icon size={20} className="mb-3 text-orange-700" aria-hidden="true" />
            <p className="text-2xl font-black text-slate-900">{value}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 rounded-3xl border border-orange-100 bg-white p-4 shadow-sm sm:grid-cols-4">
        <CommissionStat icon={<Clock3 size={20} />} label="Menunggu" value={fRp(data.pending_commission)} />
        <CommissionStat icon={<Wallet size={20} />} label="Bisa dicairkan" value={fRp(data.eligible_commission)} />
        <CommissionStat icon={<CheckCircle2 size={20} />} label="Disetujui" value={fRp(data.approved_commission)} />
        <CommissionStat icon={<CreditCard size={20} />} label="Dibayar" value={fRp(data.paid_commission)} />
      </div>
    </section>
  );
}

function CommissionStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-orange-50/70 px-4 py-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#FF6A00] shadow-sm">{icon}</div>
      <div><p className="text-xs font-bold text-slate-500">Komisi {label}</p><p className="text-lg font-black text-slate-900">{value}</p></div>
    </div>
  );
}
