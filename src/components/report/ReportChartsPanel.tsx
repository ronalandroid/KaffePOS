// src/components/report/ReportChartsPanel.tsx
import { BarChart3, CreditCard, Package, PieChart, type LucideIcon } from 'lucide-react';
import type { ChartKey } from './reportFormat';
import { LineChart } from './charts/LineChart';
import { BarChart } from './charts/BarChart';
import { DonutChart } from './charts/DonutChart';
import { HBar } from './charts/HBar';
import { PaymentBreakdownPanel } from './PaymentBreakdownPanel';
import { StockUsagePanel, type StockRow } from './StockUsagePanel';

const CHART_TABS: { id: ChartKey; l: string; e: LucideIcon }[] = [
  { id: 'trend', l: 'Tren', e: BarChart3 },
  { id: 'menu', l: 'Produk', e: PieChart },
  { id: 'payment', l: 'Bayar', e: CreditCard },
  { id: 'stock', l: 'Stok', e: Package },
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
    <div className="kaffe-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[var(--brand-hairline)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-display text-[16px] font-extrabold text-slate-900">Analitik</h3>
        <div className="kaffe-segmented grid grid-cols-4 sm:inline-flex" role="group" aria-label="Jenis grafik">
          {CHART_TABS.map(c=>(
            <button type="button" key={c.id} onClick={()=>onSelectChart(c.id)} aria-pressed={activeChart===c.id} className="inline-flex items-center justify-center gap-1.5">
              <c.e size={14} strokeWidth={2} aria-hidden="true" className="hidden sm:block" /><span>{c.l}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="p-5">
        {activeChart==='trend'&&(
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div><p className="mb-3 text-[13px] font-semibold text-slate-600">Tren pendapatan</p><LineChart data={trendData} color="#FF6A00"/></div>
            <div><p className="mb-3 text-[13px] font-semibold text-slate-600">7 periode terakhir</p><BarChart data={trendData.slice(-7)} color="#FFB27A"/></div>
          </div>
        )}
        {activeChart==='menu'&&(
          <div className="space-y-4">
            <div>
              <p className="mb-3 text-[13px] font-semibold text-slate-600">Proporsi penjualan produk</p>
              {menuPieData.length===0?<p className="py-8 text-center text-[13px] font-medium text-slate-500">Belum ada menu terjual pada periode ini.</p>:<DonutChart data={menuPieData}/>}
            </div>
            {menuRanking.length>0&&<div>
              <p className="mb-3 text-[13px] font-semibold text-slate-600">Ranking terjual</p>
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
