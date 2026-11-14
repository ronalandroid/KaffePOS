// src/components/report/AiInsightPanel.tsx
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, Mail } from 'lucide-react';
import type { AIInsight } from '@/lib/aiInsight';

type AiInsightPanelProps = {
  aiData: AIInsight | null;
  aiLoading: boolean;
  aiError: string;
  aiOpen: boolean;
  canUseAiInsight: boolean;
  onToggle: () => void;
  onFetch: () => void;
  onRefresh: () => void;
  onOpenLicense: () => void;
  onEmailCopy: () => void;
};

export function AiInsightPanel({
  aiData,
  aiLoading,
  aiError,
  aiOpen,
  canUseAiInsight,
  onToggle,
  onFetch,
  onRefresh,
  onOpenLicense,
  onEmailCopy,
}: AiInsightPanelProps) {
  const handleActivate = () => {
    if (aiLoading) return;
    if (aiData) onToggle();
    else onFetch();
  };

  return (
    <div className="kaffe-card overflow-hidden">
      {/* Header tombol */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={aiOpen}
        aria-label="Toggle AI Insight"
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleActivate();
          }
        }}
        onClick={handleActivate}
        className="flex w-full cursor-pointer select-none items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-[#FCFBF9]"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-orange-soft)] text-[var(--brand-orange-text)]">
            <Sparkles size={16} />
           </div>
          <div className="text-left">
            <p className="font-display text-[15px] font-extrabold text-slate-900">AI Insight</p>
            <p className="text-[12px] font-medium text-slate-500">
              {aiData
                ? aiData.source === 'local'
                  ? 'Analisis pintar lokal'
                  : 'Dianalisis oleh Gemini'
                : canUseAiInsight
                ? 'Signature · analisis AI siap dipakai'
                : 'Buka di paket Signature'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {aiData && (
            <button type="button"
              onClick={e => { e.stopPropagation(); onRefresh(); }}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-[var(--brand-orange-soft)] hover:text-[var(--brand-orange-text)]"
              aria-label="Refresh analisis"
              disabled={aiLoading}
              title="Refresh analisis"
            >
              <RefreshCw size={15} className={aiLoading ? 'animate-spin' : ''} />
            </button>
          )}
          {aiLoading
            ? <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            : aiData
            ? (aiOpen ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />)
            : <span className="rounded-full border border-[var(--brand-panel-border)] bg-[var(--brand-canvas)] px-2.5 py-1 text-[12px] font-bold text-slate-600">{canUseAiInsight ? 'Analisis' : 'Terkunci'}</span>
          }
        </div>
      </div>

      {!canUseAiInsight && (
        <div className="flex flex-col gap-3 border-t border-[var(--brand-hairline)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] font-medium leading-relaxed text-slate-600">Ringkasan dan saran otomatis dari data penjualan. Tersedia mulai paket Signature.</p>
          <button
            type="button"
            onClick={onOpenLicense}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-[var(--brand-panel-border)] bg-white px-4 text-[13px] font-bold text-[var(--brand-orange-text)] transition-colors hover:bg-[var(--brand-orange-soft)]"
          >
            Buka AI Insight
          </button>
        </div>
      )}

      {/* Error */}
      {aiError && (
        <div className="px-4 pb-3">
          <div className="bg-red-50 rounded-xl px-3 py-2.5 space-y-1">
            <p className="text-xs text-red-600 font-bold">{aiError}</p>
            {aiError.includes('Kuota') || aiError.includes('quota') || aiError.includes('billing') ? (
              <p className="text-[10px] text-red-400">
                Layanan AI sedang tidak tersedia. Coba lagi beberapa saat lagi atau hubungi admin internal.
              </p>
            ) : null}
          </div>
        </div>
      )}

      {/* Hasil AI */}
      {aiData && aiOpen && (
        <div className="px-4 pb-4 space-y-3 border-t border-orange-100 pt-3">

          {/* Ringkasan */}
          <div>
            <p className="text-[10px] font-black text-orange-500 uppercase tracking-wider mb-1">Ringkasan</p>
            <p className="text-xs text-slate-700 leading-relaxed">{aiData.summary}</p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {/* Menu terbaik */}
            <div className="bg-white rounded-xl p-3">
              <p className="text-[10px] font-black text-orange-500 uppercase tracking-wider mb-1">Rekomendasi Menu</p>
              <p className="text-xs text-slate-700">{aiData.bestMenu}</p>
            </div>

            {/* Stok alert */}
            <div className="bg-white rounded-xl p-3">
              <p className="text-[10px] font-black text-red-400 uppercase tracking-wider mb-1">Status Stok</p>
              <p className="text-xs text-slate-700">{aiData.stockAlert}</p>
            </div>

            {/* Prediksi */}
            <div className="bg-white rounded-xl p-3">
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-wider mb-1">Prediksi</p>
              <p className="text-xs text-slate-700">{aiData.prediction}</p>
            </div>
          </div>

          {/* Tips */}
          {aiData.tips?.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-green-600 uppercase tracking-wider mb-2">Tips Aksi</p>
              <div className="space-y-1.5">
                {aiData.tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 bg-white rounded-xl px-3 py-2">
                    <span className="text-[10px] font-black text-orange-500 mt-0.5">{i + 1}</span>
                    <p className="text-xs text-slate-700">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-orange-100 mt-2 flex flex-col gap-2">
            <button type="button"
              onClick={onEmailCopy}
              className="w-full bg-white hover:bg-orange-50 text-orange-700 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ring-1 ring-orange-100"
            >
              <Mail size={14}/> Kirim Copy ke Email Saya
            </button>
            <p className="text-[9px] text-orange-300 text-center uppercase tracking-wider mt-1">
              {aiData.source === 'local'
                ? 'Analisis cadangan lokal · Hanya sebagai referensi'
                : 'Dianalisis oleh Google Gemini · Hanya sebagai referensi'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
