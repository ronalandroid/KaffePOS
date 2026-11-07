import type { Dispatch, SetStateAction, MouseEvent as ReactMouseEvent } from 'react';
import { Instagram, MessageCircle } from 'lucide-react';
import { LOGO_ICON, type SafeContentKey } from './content';

type LandingFooterProps = {
  scrollToSection: (e: ReactMouseEvent<HTMLElement>, id: string) => void;
  setSelectedSafeItem: Dispatch<SetStateAction<SafeContentKey | null>>;
  setIsSafeDetailOpen: Dispatch<SetStateAction<boolean>>;
};

export function LandingFooter({ scrollToSection, setSelectedSafeItem, setIsSafeDetailOpen }: LandingFooterProps) {
  return (
      <footer className="kaffe-footer relative z-10 px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
            <div>
              <button type="button" className="mb-5 flex items-center gap-3" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 ring-1 ring-orange-100">
                  <img src={LOGO_ICON} alt="" className="h-7 w-7" />
                </span>
                <span className="text-2xl font-extrabold text-slate-900">Kaffe<span className="text-[#FF6A00]">POS</span></span>
              </button>
              <p className="max-w-sm text-sm font-medium leading-7 text-slate-600">
                Sistem kasir modern yang membantu bisnis Anda berkembang lebih cepat dan efisien.
              </p>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-extrabold text-slate-900">Produk</h4>
              <ul className="space-y-3 text-sm font-semibold text-slate-600">
                <li><a href="#features" onClick={(e) => scrollToSection(e, '#features')}>Fitur</a></li>
                <li><a href="#pricing" onClick={(e) => scrollToSection(e, '#pricing')}>Harga</a></li>
                <li>Update</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-extrabold text-slate-900">Perusahaan</h4>
              <ul className="space-y-3 text-sm font-semibold text-slate-600">
                <li><a href="#about" onClick={(e) => scrollToSection(e, '#about')}>Tentang Kami</a></li>
                <li>Karir</li>
                <li><a href="#contact" onClick={(e) => scrollToSection(e, '#contact')}>Kontak</a></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-extrabold text-slate-900">Bantuan</h4>
              <ul className="space-y-3 text-sm font-semibold text-slate-600">
                <li><button type="button" className="text-left" onClick={() => { setSelectedSafeItem('ADVISORY'); setIsSafeDetailOpen(true); }}>Pusat Bantuan</button></li>
                <li><button type="button" className="text-left" onClick={() => { setSelectedSafeItem('TERMS'); setIsSafeDetailOpen(true); }}>Panduan</button></li>
                <li><button type="button" className="text-left" onClick={() => { setSelectedSafeItem('PRIVACY'); setIsSafeDetailOpen(true); }}>Kebijakan Privasi</button></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-extrabold text-slate-900">Ikuti Kami</h4>
              <div className="flex gap-3">
                <a href="https://wa.me/6285186076224" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-[#FF6A00] ring-1 ring-orange-100 hover:bg-orange-100" aria-label="WhatsApp KaffePOS">
                  <MessageCircle size={18} />
                </a>
                <a href="https://instagram.com/kaffepos" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-[#FF6A00] ring-1 ring-orange-100 hover:bg-orange-100" aria-label="Instagram KaffePOS">
                  <Instagram size={18} />
                </a>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-orange-100 pt-6 text-center text-xs font-medium text-slate-500">
            © 2026 kaffePOS. All rights reserved.
          </div>
        </div>
      </footer>
  );
}
