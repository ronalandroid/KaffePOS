import type { Dispatch, SetStateAction, MouseEvent as ReactMouseEvent } from 'react';
import { CreditCard, Database, Instagram, MessageCircle, ShieldCheck } from 'lucide-react';
import { LOGO_ICON, type SafeContentKey } from './content';

type LandingFooterProps = {
  scrollToSection: (e: ReactMouseEvent<HTMLElement>, id: string) => void;
  setSelectedSafeItem: Dispatch<SetStateAction<SafeContentKey | null>>;
  setIsSafeDetailOpen: Dispatch<SetStateAction<boolean>>;
};

export function LandingFooter({
  scrollToSection,
  setSelectedSafeItem,
  setIsSafeDetailOpen,
}: LandingFooterProps) {
  const openSafeDoc = (key: SafeContentKey) => {
    setSelectedSafeItem(key);
    setIsSafeDetailOpen(true);
  };

  return (
    <footer className="kaffe-footer relative z-10 px-6 py-14">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
          <div>
            <button
              type="button"
              className="mb-4 flex items-center gap-3 text-left"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-200/70">
                <img src={LOGO_ICON} alt="" className="h-7 w-7" />
              </span>
              <span className="text-2xl font-extrabold tracking-tight text-slate-900">
                Kaffe<span className="text-[#FF6A00]">POS</span>
              </span>
            </button>
            <p className="max-w-sm text-sm font-medium leading-7 text-slate-600">
              Platform Point-of-Sale (POS) offline-first, manajemen resep HPP, Kitchen Display (KDS), dan Kopi Passport Loyalty untuk industri kopi &amp; F&amp;B Indonesia.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1 font-mono text-[10px] font-bold text-slate-700">
                <Database size={12} className="text-[#FF6A00]" />
                InsForge Cloud RLS
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1 font-mono text-[10px] font-bold text-slate-700">
                <CreditCard size={12} className="text-[#FF6A00]" />
                Mayar API v2
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 font-mono text-[10px] font-bold text-emerald-800">
                <ShieldCheck size={12} />
                AES-GCM Secured
              </span>
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-extrabold text-slate-900">Produk &amp; Modul</h4>
            <ul className="space-y-2.5 text-sm font-semibold text-slate-600">
              <li>
                <a
                  href="#features"
                  onClick={(e) => scrollToSection(e, '#features')}
                  className="kaffe-btn-compact inline-flex py-1 transition-colors hover:text-[#FF6A00]"
                >
                  Fitur Operasional
                </a>
              </li>
              <li>
                <a
                  href="#architecture"
                  onClick={(e) => scrollToSection(e, '#architecture')}
                  className="kaffe-btn-compact inline-flex py-1 transition-colors hover:text-[#FF6A00]"
                >
                  Arsitektur Cloud &amp; Sync
                </a>
              </li>
              <li>
                <a
                  href="#pricing"
                  onClick={(e) => scrollToSection(e, '#pricing')}
                  className="kaffe-btn-compact inline-flex py-1 transition-colors hover:text-[#FF6A00]"
                >
                  Paket Berlangganan
                </a>
              </li>
              <li>
                <a
                  href="#faq"
                  onClick={(e) => scrollToSection(e, '#faq')}
                  className="kaffe-btn-compact inline-flex py-1 transition-colors hover:text-[#FF6A00]"
                >
                  Tanya Jawab (FAQ)
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-extrabold text-slate-900">Perusahaan</h4>
            <ul className="space-y-2.5 text-sm font-semibold text-slate-600">
              <li>
                <a
                  href="#about"
                  onClick={(e) => scrollToSection(e, '#about')}
                  className="kaffe-btn-compact inline-flex py-1 transition-colors hover:text-[#FF6A00]"
                >
                  AI Insights &amp; Visi
                </a>
              </li>
              <li>
                <a
                  href="#contact"
                  onClick={(e) => scrollToSection(e, '#contact')}
                  className="kaffe-btn-compact inline-flex py-1 transition-colors hover:text-[#FF6A00]"
                >
                  Hubungi Tim Kami
                </a>
              </li>
              <li>
                <button
                  type="button"
                  className="kaffe-btn-compact inline-flex py-1 text-left transition-colors hover:text-[#FF6A00]"
                  onClick={() => openSafeDoc('AUDIT')}
                >
                  Audit &amp; Keamanan
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-extrabold text-slate-900">Kepatuhan &amp; Panduan</h4>
            <ul className="space-y-2.5 text-sm font-semibold text-slate-600">
              <li>
                <button
                  type="button"
                  className="kaffe-btn-compact inline-flex py-1 text-left transition-colors hover:text-[#FF6A00]"
                  onClick={() => openSafeDoc('ADVISORY')}
                >
                  Konsultasi Operasional
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="kaffe-btn-compact inline-flex py-1 text-left transition-colors hover:text-[#FF6A00]"
                  onClick={() => openSafeDoc('TERMS')}
                >
                  Ketentuan Layanan
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="kaffe-btn-compact inline-flex py-1 text-left transition-colors hover:text-[#FF6A00]"
                  onClick={() => openSafeDoc('PRIVACY')}
                >
                  Kebijakan Privasi
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-extrabold text-slate-900">Saluran Resmi</h4>
            <p className="mb-3 text-xs font-medium leading-6 text-slate-600">
              Konsultasi langsung untuk setup menu, printer thermal, atau migrasi outlet.
            </p>
            <div className="flex gap-3">
              <a
                href="https://wa.me/6285186076224"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#FF6A00] ring-1 ring-orange-200/70 transition-colors hover:bg-orange-100"
                aria-label="WhatsApp KaffePOS"
              >
                <MessageCircle size={18} />
              </a>
              <a
                href="https://instagram.com/kaffepos"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#FF6A00] ring-1 ring-orange-200/70 transition-colors hover:bg-orange-100"
                aria-label="Instagram KaffePOS"
              >
                <Instagram size={18} />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-orange-100 pt-6 text-xs font-medium text-slate-500 sm:flex-row">
          <p>© 2026 KaffePOS v2. Seluruh hak cipta dilindungi undang-undang.</p>
          <p className="font-mono text-[11px] text-slate-500">
            Powered by InsForge Cloud PostgreSQL &amp; Mayar Headless API v2
          </p>
        </div>
      </div>
    </footer>
  );
}
