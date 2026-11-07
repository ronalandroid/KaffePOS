import { Star } from 'lucide-react';
import { TESTIMONIALS, FAQS } from './content';

/** Stateless testimonial + FAQ sections of the landing page. */
export function LandingSocialProof() {
  return (
    <>
        <section className="bg-white px-5 py-14 sm:px-6 md:py-18">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-[#FF6A00]">Testimonial</p>
                <h2 className="mt-3 font-display text-3xl font-extrabold text-slate-900 md:text-4xl">
                  Dibangun untuk Operasional Cafe yang Nyata
                </h2>
              </div>
              <p className="max-w-xl text-sm font-semibold leading-7 text-slate-500">
                KaffePOS fokus pada alur kerja yang sering dibutuhkan owner cafe: transaksi cepat, stok terkontrol, pelanggan kembali, dan laporan mudah dibaca.
              </p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {TESTIMONIALS.map((item) => (
                <div key={item.name} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
                  <div className="mb-4 flex gap-1 text-[#FF6A00]">
                    {Array.from({ length: item.rating }).map((_, index) => (
                      <Star key={index} size={16} fill="#FF6A00" />
                    ))}
                  </div>
                  <p className="text-sm font-semibold leading-7 text-slate-600">&ldquo;{item.body}&rdquo;</p>
                  <div className="mt-5">
                    <p className="text-sm font-extrabold text-slate-900">{item.name}</p>
                    <p className="text-xs font-bold text-slate-400">{item.handle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-16 sm:px-6 md:pb-20">
          <div className="mx-auto max-w-4xl">
            <div className="text-center">
              <p className="text-xs font-extrabold uppercase tracking-widest text-[#FF6A00]">FAQ</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold text-slate-900 md:text-4xl">
                Pertanyaan yang Sering Muncul
              </h2>
            </div>
            <div className="mt-8 space-y-3">
              {FAQS.map((item) => (
                <details key={item.q} className="group rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-extrabold text-slate-900">
                    {item.q}
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[#FF6A00] transition group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-4 text-sm font-semibold leading-7 text-slate-500">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
    </>
  );
}
