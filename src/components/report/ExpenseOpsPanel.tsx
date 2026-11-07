// src/components/report/ExpenseOpsPanel.tsx
import { Receipt } from 'lucide-react';
import { fRp } from './reportFormat';

type ExpenseEntry = { description: string; category: string; date: string; amount: number };
type ExpenseOpsPanelProps = { totalExpOps: number; entries: ExpenseEntry[] };

export function ExpenseOpsPanel({ totalExpOps, entries }: ExpenseOpsPanelProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-red-100 rounded-lg flex items-center justify-center">
            <Receipt size={14} className="text-red-500"/>
          </div>
          <p className="text-sm font-black text-slate-800">Pengeluaran Operasional</p>
        </div>
        <p className="text-red-500 font-black text-sm">{fRp(totalExpOps)}</p>
      </div>
      {entries.length===0
        ? <p className="px-4 py-3 text-xs text-slate-400 italic">Belum ada pengeluaran untuk periode ini. Catat biaya operasional agar laba bersih lebih akurat.</p>
        : <div className="divide-y divide-slate-50">
            {entries.slice(0,10).map((e,i)=>(
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-xs font-bold text-slate-700">{e.description}</p>
                  <p className="text-[10px] text-slate-400">
                    {e.category} · {new Date(e.date).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                  </p>
                </div>
                <p className="text-sm font-black text-red-500">-{fRp(e.amount)}</p>
              </div>
            ))}
            {entries.length>10&&<p className="px-4 py-2 text-xs text-slate-400 text-center">+{entries.length-10} lainnya</p>}
          </div>
      }
    </div>
  );
}
