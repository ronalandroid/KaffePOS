// src/components/report/CashRegisterPanel.tsx
import { Wallet } from 'lucide-react';
import { fRp } from './reportFormat';

type CashEntry = { opened_by?: string | null; date: string; note?: string | null; amount: number };
type CashRegisterPanelProps = { totalCashRegister: number; entries: CashEntry[] };

export function CashRegisterPanel({ totalCashRegister, entries }: CashRegisterPanelProps) {
  return (
    <div className="kaffe-card overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--brand-hairline)]">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-canvas)] text-slate-600" aria-hidden="true">
            <Wallet size={16}/>
          </div>
          <h3 className="font-display text-[15px] font-extrabold text-slate-900">Saldo Kasir Awal</h3>
        </div>
        <p className="font-extrabold text-[15px] text-slate-900 kaffe-num">{fRp(totalCashRegister)}</p>
      </div>
      {entries.length===0
        ? <p className="px-5 py-4 text-[13px] text-slate-500">Belum ada saldo kasir untuk periode ini. Buka kasir harian untuk mulai mencatat modal dan closing.</p>
        : <div className="divide-y divide-[var(--brand-hairline)]">
            {entries.map((c,i)=>(
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-[13px] font-semibold text-slate-800">{c.opened_by||'Kasir'}</p>
                  <p className="text-[12px] text-slate-500">
                    {new Date(c.date).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                    {c.note?` · ${c.note}`:''}
                  </p>
                </div>
                <p className="text-[14px] font-bold text-slate-900 kaffe-num">{fRp(c.amount)}</p>
              </div>
            ))}
          </div>
      }
    </div>
  );
}
