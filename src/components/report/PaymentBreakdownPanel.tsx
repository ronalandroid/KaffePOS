// src/components/report/PaymentBreakdownPanel.tsx
import { fRp } from './reportFormat';
import { DonutChart } from './charts/DonutChart';

type PaymentDatum = { label: string; value: number; color: string };
type PaymentBreakdownPanelProps = { paymentData: PaymentDatum[]; totalRevenue: number };

export function PaymentBreakdownPanel({ paymentData, totalRevenue }: PaymentBreakdownPanelProps) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-400 mb-3">Metode Pembayaran</p>
      {paymentData.length===0?<p className="text-center text-slate-400 text-sm font-semibold py-8">Belum ada metode pembayaran tercatat.</p>
        :<div className="space-y-3"><DonutChart data={paymentData}/>
          <div className="space-y-2">{paymentData.map((p,i)=>(
            <div key={i} className="flex justify-between items-center bg-slate-50 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor:p.color}}/><span className="text-sm font-bold text-slate-700">{p.label}</span></div>
              <div className="text-right"><p className="text-sm font-black text-slate-800">{fRp(p.value)}</p><p className="text-xs text-slate-400">{totalRevenue>0?Math.round(p.value/totalRevenue*100):0}%</p></div>
            </div>
          ))}</div>
        </div>}
    </div>
  );
}
