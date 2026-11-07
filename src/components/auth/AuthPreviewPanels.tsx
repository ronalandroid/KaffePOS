/** Presentational preview panels on the auth page (desktop stage + mobile strip). */
import { authPreviewCards } from './authContent';

export function AuthPreviewStage() {
  return (
    <div data-testid="auth-preview-stage" className="kaffe-auth-preview mb-5">
      <div className="relative z-10 flex items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-white/80 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#FF6A00]">
            <span className="h-2 w-2 rounded-full bg-[#16A34A] shadow-[0_0_0_5px_rgba(22,163,74,0.12)]" aria-hidden="true" />
            Sinkronisasi outlet aktif
          </div>
          <h2 className="text-[18px] font-extrabold leading-snug text-slate-900">
            Preview operasional yang selalu tersambung
          </h2>
          <p className="mt-1.5 text-[12px] font-medium leading-5 text-slate-500">
            UI web, mobile web, dan APK dibuat senada supaya tim tetap familiar di perangkat apa pun.
          </p>
        </div>
        <div className="hidden shrink-0 rounded-2xl border border-orange-100 bg-white/80 px-3 py-2 text-right shadow-sm xl:block">
          <p className="text-[11px] font-bold text-slate-400">Sync status</p>
          <p className="text-lg font-extrabold text-slate-900">99.9%</p>
          <p className="text-[11px] font-semibold text-[#16A34A]">Real-time</p>
        </div>
      </div>

      <div className="relative z-10 mt-4 grid grid-cols-3 gap-2.5">
        {authPreviewCards.map((card, index) => {
          const Icon = card.icon;
          const SupportIcon = card.supportIcon;
          return (
            <article
              key={card.title}
              data-testid="auth-preview-card"
              className="kaffe-preview-card kaffe-float-soft"
              style={{ animationDelay: `${index * -1.35}s` }}
            >
              <div className="kaffe-preview-icon-panel flex h-28 w-full items-center justify-center rounded-[16px] border border-orange-100 bg-white shadow-sm">
                <div
                  data-testid="auth-preview-card-icon"
                  className={`relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br shadow-sm ring-1 ${card.accent}`}
                >
                  <Icon size={30} strokeWidth={2.35} aria-hidden="true" />
                  <span className={`absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-xl border-2 border-white shadow-sm ${card.supportAccent}`}>
                    <SupportIcon size={14} strokeWidth={2.7} aria-hidden="true" />
                  </span>
                </div>
              </div>
              <div className="mt-3 min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#FF6A00]">{card.label}</p>
                <h3 className="mt-1 truncate text-[13px] font-extrabold text-slate-900">{card.title}</h3>
                <p className="mt-1 hidden text-[11px] font-medium leading-5 text-slate-500 2xl:block">{card.copy}</p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function AuthMobilePreviewStrip() {
  return (
    <div data-testid="auth-mobile-preview-strip" className="kaffe-mobile-preview-strip lg:hidden" aria-label="Preview fitur KaffePOS">
      {authPreviewCards.map((card, index) => {
        const Icon = card.icon;
        const SupportIcon = card.supportIcon;
        return (
          <div key={card.title} className="kaffe-mobile-preview-card kaffe-float-soft" style={{ animationDelay: `${index * -1.2}s` }}>
            <div className={`kaffe-mobile-preview-icon bg-gradient-to-br ${card.accent}`}>
              <Icon size={22} strokeWidth={2.4} aria-hidden="true" />
              <span className={`kaffe-mobile-preview-badge ${card.supportAccent}`}>
                <SupportIcon size={11} strokeWidth={2.7} aria-hidden="true" />
              </span>
            </div>
            <span>{card.title}</span>
          </div>
        );
      })}
    </div>
  );
}
