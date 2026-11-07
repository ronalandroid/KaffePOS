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
    {l:'(-) HPP',v:-totalCogs,color:'text-red-500',bold:false},
    {l:'Laba Kotor',v:grossProfit,color:grossProfit>=0?'text-green-600':'text-red-500',bold:true,sep:true},
    {l:'(-) Pengeluaran',v:-totalExpenses,color:'text-red-500',bold:false},
    {l:'LABA BERSIH',v:netProfit,color:netProfit>=0?'text-green-600':'text-red-500',bold:true,sep:true},
  ];
  const summary: { l: string; v: string }[] = [
    {l:'Avg Trx',v:fRp(avgTrx)},{l:'Margin',v:`${grossMargin}%`},{l:'Jumlah Trx',v:`${txCount}`},{l:'Nilai Stok',v:fRp(totalStockVal)},
  ];
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4">
      <p className="text-xs font-black text-slate-400 mb-3">LABA RUGI</p>
      <div className="space-y-0">
        {rows.map((row,i)=>(
          <div key={i} className={`flex justify-between py-2 ${row.sep?'border-t border-slate-100 mt-1':''}`}>
            <span className={`text-sm ${row.bold?'font-black text-slate-800':'text-slate-500'}`}>{row.l}</span>
            <span className={`text-sm font-black ${row.color}`}>{row.v<0?`-${fRp(Math.abs(row.v))}`:fRp(row.v)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {summary.map((s,i)=>(
          <div key={i} className="bg-slate-50 rounded-xl p-2.5 text-center">
            <p className="text-[11px] text-slate-400">{s.l}</p>
            <p className="font-black text-sm text-slate-800">{s.v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
