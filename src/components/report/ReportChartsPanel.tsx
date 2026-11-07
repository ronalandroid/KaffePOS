// src/components/report/ReportChartsPanel.tsx
import type { ChartKey } from './reportFormat';
import { LineChart } from './charts/LineChart';
import { BarChart } from './charts/BarChart';
import { DonutChart } from './charts/DonutChart';
import { HBar } from './charts/HBar';
import { PaymentBreakdownPanel } from './PaymentBreakdownPanel';
import { StockUsagePanel, type StockRow } from './StockUsagePanel';

const CHART_TABS: { id: ChartKey; l: string; e: string }[] = [
  { id: 'trend', l: 'Tren', e: '📈' },
  { id: 'menu', l: 'Produk', e: '🥧' },
  { id: 'payment', l: 'Bayar', e: '💳' },
  { id: 'stock', l: 'Stok', e: '📦' },
];

type ChartDatum = { label: string; value: number };
type ColoredDatum = { label: string; value: number; color: string };
type RankingDatum = { label: string; value: number; sub?: string };

type ReportChartsPanelProps = {
  activeChart: ChartKey;
  onSelectChart: (key: ChartKey) => void;
  trendData: ChartDatum[];
  menuPieData: ColoredDatum[];
  menuRanking: RankingDatum[];
  paymentData: ColoredDatum[];
  stockData: StockRow[];
  totalRevenue: number;
  totalStockVal: number;
};

export function ReportChartsPanel({
  activeChart,
  onSelectChart,
  trendData,
  menuPieData,
  menuRanking,
  paymentData,
  stockData,
  totalRevenue,
  totalStockVal,
}: ReportChartsPanelProps) {
  return (
    <div className="bg-white rounded-[32px] border border-slate-100 shadow-soft overflow-hidden">
      <div className="px-6 pt-6 pb-2">
        <div className="grid grid-cols-4 gap-2">
          {CHART_TABS.map(c=>(
            <button type="button" key={c.id} onClick={()=>onSelectChart(c.id)} className={`flex flex-col items-center py-3 rounded-[20px] text-[11px] font-bold transition-all gap-1.5 border ${activeChart===c.id?'bg-slate-900 text-white border-slate-900 shadow-premium':'bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-200'}`}>
              <span>{c.e}</span><span>{c.l}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="px-6 pb-6 pt-4">
        {activeChart==='trend'&&(
          <div className="space-y-6">
            <div><p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">Tren Pendapatan</p><LineChart data={trendData} color="#FF6A00"/></div>
            <div><p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">Aktivitas Mingguan</p><BarChart data={trendData.slice(-7)} color="#3b82f6"/></div>
          </div>
        )}
        {activeChart==='menu'&&(
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold text-slate-400 mb-3">🥧 Proporsi Penjualan Produk</p>
              {menuPieData.length===0?<p className="text-center text-slate-400 text-sm font-semibold py-8">Belum ada menu terjual pada periode ini.</p>:<DonutChart data={menuPieData}/>}
            </div>
            {menuRanking.length>0&&<div>
              <p className="text-xs font-bold text-slate-400 mb-3">🏆 Ranking Terjual</p>
              <HBar items={menuRanking} max={menuRanking[0]?.value||1}/>
            </div>}
          </div>
        )}
        {activeChart==='payment'&&(
          <PaymentBreakdownPanel paymentData={paymentData} totalRevenue={totalRevenue}/>
        )}
        {activeChart==='stock'&&(
          <StockUsagePanel stockData={stockData} totalStockVal={totalStockVal}/>
        )}
      </div>
    </div>
  );
}
