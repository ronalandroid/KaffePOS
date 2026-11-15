import { ScrollText } from 'lucide-react';

const rules = [
  'Affiliate mendapat komisi 20% dari pembayaran pertama customer.',
  'Komisi masuk pending setelah customer berhasil membayar.',
  'Komisi eligible setelah customer aktif 30 hari.',
  'Payout perlu persetujuan admin dan minimal Rp250.000.',
  'Fraud, spam, refund, atau pembatalan bisa membuat komisi ditolak.',
];

export default function AffiliateRulesCard() {
  return (
    <section className="rounded-3xl border border-orange-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <ScrollText size={24} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-black text-slate-900">Aturan afiliasi</h2>
          <div className="mt-3 grid gap-2 text-sm font-semibold leading-relaxed text-slate-500 sm:grid-cols-2">
            {rules.map((rule) => <p key={rule}>• {rule}</p>)}
          </div>
        </div>
      </div>
    </section>
  );
}
