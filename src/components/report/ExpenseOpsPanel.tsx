// src/components/report/ExpenseOpsPanel.tsx
import { Receipt } from 'lucide-react';
import { fRp } from './reportFormat';

type ExpenseEntry = { description: string; category: string; date: string; amount: number };
type ExpenseOpsPanelProps = { totalExpOps: number; entries: ExpenseEntry[] };

export function ExpenseOpsPanel({ totalExpOps, entries }: ExpenseOpsPanelProps) {
  return (
    <div className="kaffe-card overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--brand-hairline)]">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-canvas)] text-slate-600" aria-hidden="true">
            <Receipt size={16}/>
          </div>
          <h3 className="font-display text-[15px] font-extrabold text-slate-900">Pengeluaran Operasional</h3>
        </div>
        <p className="text-[15px] font-extrabold text-rose-700 kaffe-num">{fRp(totalExpOps)}</p>
      </div>
      {entries.length===0
        ? <p className="px-5 py-4 text-[13px] text-slate-500">Belum ada pengeluaran untuk periode ini. Catat biaya operasional agar laba bersih lebih akurat.</p>
        : <div className="divide-y divide-[var(--brand-hairline)]">
            {entries.slice(0,10).map((e,i)=>(
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-[13px] font-semibold text-slate-800">{e.description}</p>
                  <p className="text-[12px] text-slate-500">
                    {e.category} · {new Date(e.date).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                  </p>
                </div>
                <p className="text-[14px] font-bold text-rose-700 kaffe-num">-{fRp(e.amount)}</p>
              </div>
            ))}
            {entries.length>10&&<p className="px-5 py-2.5 text-center text-[12px] text-slate-500">+{entries.length-10} lainnya</p>}
          </div>
      }
    </div>
  );
}
