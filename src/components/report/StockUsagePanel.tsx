// src/components/report/StockUsagePanel.tsx
import { fRp } from './reportFormat';

export type StockRow = { label: string; stock: number; unit: string; min: number; pct: number };
type StockUsagePanelProps = { stockData: StockRow[]; totalStockVal: number };

export function StockUsagePanel({ stockData, totalStockVal }: StockUsagePanelProps) {
  return (
    <div>
      <div className="flex justify-between mb-3"><p className="text-xs font-bold text-slate-400">Status Stok Bahan</p><span className="text-xs font-bold text-slate-600">{fRp(totalStockVal)}</span></div>
      {stockData.length===0?<p className="text-center text-slate-400 text-sm font-semibold py-8">Belum ada inventaris. Tambahkan bahan untuk melihat status stok.</p>
        :<div className="space-y-2.5">{stockData.map((item,i)=>{
          const pct=Math.min(item.pct,100),color=item.pct<=50?'#ef4444':item.pct<=100?'#f97316':'#10b981';
          return(<div key={i}><div className="flex justify-between mb-1"><span className="text-xs font-bold text-slate-700 truncate max-w-[55%]">{item.label}</span><span className="text-xs font-bold shrink-0 ml-2" style={{color}}>{item.stock} {item.unit}{item.pct<=100?' ⚠':''}</span></div><div className="w-full bg-slate-100 rounded-full h-2"><div className="h-2 rounded-full" style={{width:`${pct}%`,backgroundColor:color}}/></div></div>);
        })}</div>}
    </div>
  );
}
