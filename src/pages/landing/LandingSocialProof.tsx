import { Download, Plus } from 'lucide-react';
import { FAQS } from './content';

/**
 * FAQ section of the landing page. The testimonial block was removed: it showed
 * named customers and impact metrics that had no verifiable source. Bring it back
 * only with real, attributable quotes.
 */
export function LandingSocialProof() {
  return (
    <>
      <section id="faq" className="px-5 pb-18 pt-6 sm:px-6 md:pb-24">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
              Pertanyaan yang sering muncul
            </h2>
            <p className="mt-4 text-sm font-medium leading-7 text-slate-600">
              Tentang masa percobaan 14 hari, pemakaian saat internet mati, dan pembayaran langganan.
            </p>

            <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <Download size={20} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Data kamu bisa diekspor kapan saja</h3>
                  <p className="mt-1 text-xs font-medium leading-6 text-slate-600">
                    Transaksi, resep HPP, dan daftar member Kopi Passport bisa diekspor ke PDF atau cadangan JSON.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {FAQS.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-colors open:border-orange-200"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-extrabold text-slate-900 sm:text-[15px]">
                  <span>{item.q}</span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF6A00] transition-transform duration-200 group-open:rotate-45">
                    <Plus size={16} />
                  </span>
                </summary>
                <p className="mt-3.5 border-t border-slate-100 pt-3.5 text-sm font-medium leading-7 text-slate-600">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
