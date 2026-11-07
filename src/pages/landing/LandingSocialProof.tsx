import { CheckCircle2, MapPin, Plus, ShieldCheck, Star, TrendingUp } from 'lucide-react';
import { TESTIMONIALS, FAQS } from './content';

/**
 * Editorial Social Proof + Split FAQ sections of the KaffePOS v2 landing page.
 * Built following anti-slop layout diversification (asymmetric grid, squircle avatars,
 * tabular-nums metrics, and split-column FAQ architecture).
 */
export function LandingSocialProof() {
  const [featured, ...secondary] = TESTIMONIALS;

  return (
    <>
      <section className="bg-white px-5 py-16 sm:px-6 md:py-22">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-8 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/70 bg-orange-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#FF6A00]">
                <CheckCircle2 size={12} />
                <span>Studi Kasus Operasional</span>
              </div>
              <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
                Dibangun untuk Operasional Cafe yang Nyata
              </h2>
            </div>
            <p className="max-w-xl text-sm font-medium leading-7 text-slate-600">
              Bukan sekadar pencatat struk. KaffePOS dipakai oleh kedai kopi, roastery, dan outlet multi-cabang untuk menjaga kecepatan bar, presisi gramasi HPP, dan loyalitas pelanggan.
            </p>
          </div>

          {/* Asymmetric Bento Testimonial Layout (5 cols featured + 7 cols stacked/paired) */}
          <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-12">
            {featured && (
              <div className="kaffe-double-bezel lg:col-span-5">
                <article className="kaffe-double-bezel-inner flex h-full flex-col justify-between p-6 sm:p-7">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex gap-1 text-[#FF6A00]">
                        {Array.from({ length: featured.rating }).map((_, index) => (
                          <Star key={index} size={15} fill="#FF6A00" />
                        ))}
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-mono text-[11px] font-bold tabular-nums text-emerald-700 ring-1 ring-emerald-200/70">
                        <TrendingUp size={12} />
                        {featured.impactMetric}
                      </span>
                    </div>

                    <p className="mt-5 text-[15px] font-semibold leading-7 text-slate-800 sm:text-base">
                      &ldquo;{featured.body}&rdquo;
                    </p>
                  </div>

                  <div className="mt-6 border-t border-slate-100 pt-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 font-mono text-xs font-extrabold text-white">
                          {featured.initials}
                        </div>
                        <div>
                          <p className="text-sm font-extrabold text-slate-900">{featured.name}</p>
                          <p className="text-xs font-semibold text-slate-600">
                            {featured.role} &bull; <span className="text-[#FF6A00]">{featured.outlet}</span>
                          </p>
                        </div>
                      </div>
                      <span className="hidden items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 sm:inline-flex">
                        <MapPin size={12} className="text-[#FF6A00]" />
                        {featured.location}
                      </span>
                    </div>
                    <p className="mt-3 font-mono text-[11px] font-semibold text-slate-500">
                      Metrik terverifikasi: {featured.impactLabel}
                    </p>
                  </div>
                </article>
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-7">
              {secondary.map((item) => (
                <div key={item.name} className="kaffe-double-bezel">
                  <article className="kaffe-double-bezel-inner flex h-full flex-col justify-between p-6">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex gap-1 text-[#FF6A00]">
                          {Array.from({ length: item.rating }).map((_, index) => (
                            <Star key={index} size={14} fill="#FF6A00" />
                          ))}
                        </div>
                        <span className="rounded-full bg-orange-50 px-2.5 py-0.5 font-mono text-[11px] font-bold tabular-nums text-[#FF6A00] ring-1 ring-orange-200/60">
                          {item.impactMetric}
                        </span>
                      </div>

                      <p className="mt-4 text-sm font-semibold leading-7 text-slate-700">
                        &ldquo;{item.body}&rdquo;
                      </p>
                    </div>

                    <div className="mt-6 border-t border-slate-100 pt-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 font-mono text-xs font-extrabold text-[#FF6A00] ring-1 ring-orange-200/70">
                          {item.initials}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold text-slate-900">{item.name}</p>
                          <p className="truncate text-xs font-semibold text-slate-600">
                            {item.outlet} ({item.location})
                          </p>
                        </div>
                      </div>
                      <p className="mt-2.5 font-mono text-[11px] font-semibold text-slate-500">
                        {item.impactLabel}
                      </p>
                    </div>
                  </article>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="px-5 pb-18 pt-6 sm:px-6 md:pb-24">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#FF6A00]">FAQ & Teknis</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
              Pertanyaan yang Sering Muncul
            </h2>
            <p className="mt-4 text-sm font-medium leading-7 text-slate-600">
              Jawaban transparan seputar masa percobaan 14 hari, sinkronisasi database InsForge Cloud saat internet mati, hingga pembayaran otomatis via Mayar QRIS & Virtual Account.
            </p>

            <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF6A00]">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Jaminan Keamanan & Kepemilikan Data</h3>
                  <p className="mt-1 text-xs font-medium leading-6 text-slate-600">
                    Seluruh transaksi, resep HPP, dan database member Kopi Passport dapat diekspor kapan saja dalam format PDF maupun JSON backup.
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
