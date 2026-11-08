// src/components/report/CashRegisterPanel.tsx
import { Wallet } from 'lucide-react';
import { fRp } from './reportFormat';

type CashEntry = { opened_by?: string | null; date: string; note?: string | null; amount: number };
type CashRegisterPanelProps = { totalCashRegister: number; entries: CashEntry[] };

export function CashRegisterPanel({ totalCashRegister, entries }: CashRegisterPanelProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center">
            <Wallet size={14} className="text-orange-500"/>
          </div>
          <p className="text-sm font-black text-slate-800">Saldo Kasir Awal</p>
        </div>
        <p className="text-orange-500 font-black text-sm">{fRp(totalCashRegister)}</p>
      </div>
      {entries.length===0
        ? <p className="px-4 py-3 text-xs text-slate-400">Belum ada saldo kasir untuk periode ini. Buka kasir harian untuk mulai mencatat modal dan closing.</p>
        : <div className="divide-y divide-slate-50">
            {entries.map((c,i)=>(
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-xs font-bold text-slate-700">{c.opened_by||'Kasir'}</p>
                  <p className="text-[10px] text-slate-400">
                    {new Date(c.date).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                    {c.note?` · ${c.note}`:''}
                  </p>
                </div>
                <p className="text-sm font-black text-orange-500">{fRp(c.amount)}</p>
              </div>
            ))}
          </div>
      }
    </div>
  );
}
