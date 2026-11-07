// src/components/pos/PosVariantPicker.tsx — product options sheet for the POS.
// Two modes:
//  • Quick-select — product has variants only (no modifiers): tap a variant to add it
//    straight to the cart (one tap, fast for a busy kasir).
//  • Form — product has modifiers (e.g. Extra Shot, Oat Milk): pick one variant (size)
//    plus any number of priced modifiers, see the live total, then confirm.
// The store's addToCart(item, variant, modifiers) applies the chosen options + price.
import { useEffect, useRef, useState, useMemo } from 'react';
import { X, Check, Plus } from 'lucide-react';
import type { MenuItem, Variant, Modifier } from '@/types';
import { fRp } from './posHelpers';

type Props = {
  item: MenuItem;
  onConfirm: (variant?: Variant, modifiers?: Modifier[]) => void;
  onClose: () => void;
};

export default function PosVariantPicker({ item, onConfirm, onClose }: Props) {
  const variants = item.variants ?? [];
  const modifiers = useMemo(() => item.modifiers ?? [], [item.modifiers]);
  const isFormMode = modifiers.length > 0;

  const [variant, setVariant] = useState<Variant | null>(variants[0] ?? null);
  const [selectedMods, setSelectedMods] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    panelRef.current?.querySelector<HTMLButtonElement>('button[data-option]')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const chosenMods = useMemo(
    () => modifiers.filter(m => selectedMods.includes(m.name)),
    [modifiers, selectedMods],
  );
  const total = (variant ? variant.price : item.price) + chosenMods.reduce((s, m) => s + m.price, 0);

  const toggleMod = (name: string) =>
    setSelectedMods(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);

  return (
    <div
      className="kaffe-modal-overlay fixed inset-0 z-[95] flex items-end justify-center bg-stone-900/60 backdrop-blur-sm md:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-options-title"
        className="kaffe-panel kaffe-modal-panel flex w-full max-w-[500px] flex-col overflow-hidden rounded-t-[28px] shadow-2xl animate-in slide-in-from-bottom-20 duration-300 md:rounded-[28px]"
      >
        <div className="flex items-start justify-between gap-3 p-6 pb-4 sm:px-8">
          <div className="min-w-0">
            <p className="text-stone-400 text-[11px] font-bold uppercase tracking-widest">{isFormMode ? 'Pilih Opsi' : 'Pilih Varian'}</p>
            <h3 id="pos-options-title" className="font-display text-2xl font-black text-stone-900 tracking-tight truncate">{item.name}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup pilih opsi"
            className="shrink-0 p-3 bg-white border border-stone-100 rounded-2xl text-stone-400 hover:bg-orange-50 hover:text-[#FF6A00] transition-colors">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-4 sm:px-8" style={{ maxHeight: '55vh' }}>
          {/* Variant — single select */}
          {variants.length > 0 && (
            <section aria-labelledby="pos-variant-section">
              <p id="pos-variant-section" className="mb-2 text-[11px] font-black uppercase tracking-widest text-stone-400">Ukuran</p>
              <div className="space-y-2.5">
                {variants.map((v) => {
                  const active = isFormMode && variant?.name === v.name;
                  return (
                    <button
                      type="button"
                      key={v.name}
                      data-option
                      onClick={() => (isFormMode ? setVariant(v) : onConfirm(v, undefined))}
                      aria-pressed={isFormMode ? active : undefined}
                      className={`flex w-full items-center justify-between gap-3 rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.98] ${active ? 'border-[#FF6A00] bg-orange-50' : 'border-stone-100 bg-white hover:border-orange-300 hover:bg-orange-50/50'}`}
                    >
                      <span className="font-black text-base text-stone-800 tracking-tight">{v.name}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-black text-sm" style={{ color: 'var(--brand-orange-text)' }}>{fRp(v.price)}</span>
                        {active && <Check size={18} className="text-[#FF6A00]" aria-hidden="true" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Modifiers — multi select */}
          {modifiers.length > 0 && (
            <section aria-labelledby="pos-modifier-section">
              <p id="pos-modifier-section" className="mb-2 text-[11px] font-black uppercase tracking-widest text-stone-400">Tambahan</p>
              <div className="space-y-2.5">
                {modifiers.map((m) => {
                  const active = selectedMods.includes(m.name);
                  return (
                    <button
                      type="button"
                      key={m.name}
                      data-option
                      onClick={() => toggleMod(m.name)}
                      aria-pressed={active}
                      className={`flex w-full items-center justify-between gap-3 rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.98] ${active ? 'border-[#FF6A00] bg-orange-50' : 'border-stone-100 bg-white hover:border-orange-300 hover:bg-orange-50/50'}`}
                    >
                      <span className="flex items-center gap-3">
                        <span className={`flex size-6 items-center justify-center rounded-lg border-2 transition-colors ${active ? 'border-[#FF6A00] bg-[#FF6A00] text-white' : 'border-stone-200 bg-white text-transparent'}`}>
                          <Check size={14} strokeWidth={3} aria-hidden="true" />
                        </span>
                        <span className="font-bold text-base text-stone-800">{m.name}</span>
                      </span>
                      <span className="font-black text-sm" style={{ color: 'var(--brand-orange-text)' }}>+{fRp(m.price)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Confirm — only in form mode (quick-select variants add on tap above) */}
        {isFormMode && (
          <div className="border-t border-stone-100 bg-white p-5 sm:px-8">
            <button
              type="button"
              onClick={() => onConfirm(variant ?? undefined, chosenMods.length ? chosenMods : undefined)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF6A00] to-[#FF8A1C] py-4 font-black uppercase tracking-widest text-white shadow-[0_8px_24px_rgba(255,106,0,0.35)] transition-all active:scale-[0.98]"
            >
              <Plus size={18} strokeWidth={3} aria-hidden="true" />
              <span>Tambah • {fRp(total)}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
