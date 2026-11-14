// src/components/report/ProfitLossPanel.tsx
import { fRp } from './reportFormat';

type ProfitLossPanelProps = {
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  avgTrx: number;
  grossMargin: number;
  txCount: number;
  totalStockVal: number;
};

type PnlRow = { l: string; v: number; color: string; bold: boolean; sep?: boolean };

export function ProfitLossPanel({ totalRevenue, totalCogs, grossProfit, totalExpenses, netProfit, avgTrx, grossMargin, txCount, totalStockVal }: ProfitLossPanelProps) {
  const rows: PnlRow[] = [
    {l:'Pendapatan Kotor',v:totalRevenue,color:'text-slate-700',bold:false},
    {l:'HPP',v:-totalCogs,color:'text-rose-700',bold:false},
    {l:'Laba Kotor',v:grossProfit,color:grossProfit>=0?'text-slate-900':'text-rose-700',bold:true,sep:true},
    {l:'Pengeluaran',v:-totalExpenses,color:'text-rose-700',bold:false},
    {l:'Laba Bersih',v:netProfit,color:netProfit>=0?'text-emerald-700':'text-rose-700',bold:true,sep:true},
  ];
  const summary: { l: string; v: string }[] = [
    {l:'Rata-rata transaksi',v:fRp(avgTrx)},{l:'Margin',v:`${grossMargin}%`},{l:'Jumlah transaksi',v:`${txCount}`},{l:'Nilai Stok',v:fRp(totalStockVal)},
  ];
  return (
    <div className="kaffe-card p-5">
      <h3 className="mb-2 font-display text-[16px] font-extrabold text-slate-900">Laba Rugi</h3>
      <div className="space-y-0">
        {rows.map((row,i)=>(
          <div key={i} className={`flex justify-between py-2.5 ${row.sep?'mt-1 border-t border-[var(--brand-panel-border)]':''}`}>
            <span className={`text-[14px] ${row.bold?'font-bold text-slate-900':'font-medium text-slate-600'}`}>{row.l}</span>
            <span className={`text-[14px] kaffe-num ${row.bold?'font-extrabold':'font-semibold'} ${row.color}`}>{row.v<0?`-${fRp(Math.abs(row.v))}`:fRp(row.v)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--brand-panel-border)] pt-4 sm:grid-cols-4">
        {summary.map((s,i)=>(
          <div key={i} className="rounded-xl bg-[var(--brand-canvas)] px-3 py-2.5">
            <p className="text-[12px] font-medium text-slate-500">{s.l}</p>
            <p className="mt-0.5 text-[14px] font-bold text-slate-900 kaffe-num">{s.v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
