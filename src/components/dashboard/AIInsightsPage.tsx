import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Clock3,
  LineChart as LineChartIcon,
  Lock,
  Package,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  getEnhancedAiInsights,
  type EnhancedAiInsightCard,
  type EnhancedAiInsightsResponse,
  type EnhancedAiInsightType,
} from '@/lib/backendApi';
import { normalizeUserFacingError } from '@/lib/errorMessages';
import { dispatchUpgradePrompt } from '@/lib/upgradePrompts';
import { useStore } from '@/hooks/useStore';
import { buildInsightContext } from '@/lib/insightContext';
import { getAIInsightCached, type AIInsight } from '@/lib/aiInsight';

const fRp = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value || 0);

const TYPE_META: Record<EnhancedAiInsightType, { label: string; icon: typeof TrendingUp }> = {
  sales_trend: { label: 'Tren penjualan', icon: TrendingUp },
  menu_optimization: { label: 'Menu', icon: BarChart3 },
  staff_performance: { label: 'Performa staf', icon: Users },
  stock_waste: { label: 'Stok', icon: Package },
  peak_hour: { label: 'Jam ramai', icon: Clock3 },
};

type Props = {
  storeId: string | null;
  canUseAiInsight: boolean;
  hasBusinessData: boolean;
};

export function InsightCard({ insight }: { insight: EnhancedAiInsightCard }) {
  const meta = TYPE_META[insight.type] ?? TYPE_META.sales_trend;
  const Icon = meta.icon;

  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-100 hover:shadow-[var(--brand-panel-shadow-hover)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Icon size={20} className="shrink-0 text-orange-700" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#FF6A00]">{meta.label}</p>
            <h4 className="mt-1 line-clamp-2 text-sm font-black leading-tight text-slate-900">{insight.title}</h4>
          </div>
        </div>
      </div>
      <p className="text-xs font-semibold leading-relaxed text-slate-500">{insight.description}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-orange-50 px-3 py-2 ring-1 ring-orange-100">
          <p className="text-[9px] font-black uppercase tracking-widest text-orange-600">{insight.metricLabel}</p>
          <p className="mt-1 truncate text-sm font-black text-slate-900">{insight.metricValue}</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Dampak</p>
          <p className="mt-1 line-clamp-2 text-[11px] font-bold leading-tight text-slate-700">{insight.impact}</p>
        </div>
      </div>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="kaffe-panel rounded-2xl p-5 md:p-6">
      <div className="flex items-center gap-3">
        <RefreshCw size={20} className="animate-spin text-orange-700" aria-hidden="true" />
        <p className="text-sm font-bold text-slate-900">Memuat analisis penjualan...</p>
      </div>
    </div>
  );
}

function LockedState({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <section className="kaffe-panel rounded-2xl p-5 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <Lock size={24} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="font-display text-xl font-extrabold text-slate-900">Analisis penjualan tersedia di paket Signature</h3>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-slate-500">
              Lihat tren penjualan, menu terlaris, jam ramai, performa staf, dan saran stok.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onUpgrade}
          className="kaffe-gradient-cta inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-[14px] font-bold"
        >
          Lihat paket Signature
        </button>
      </div>
    </section>
  );
}

export default function AIInsightsPage({ storeId, canUseAiInsight, hasBusinessData }: Props) {
  const [data, setData] = useState<EnhancedAiInsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Real AI narrative from Gemini (falls back to a local heuristic if the key is unset/offline).
  // The rule-based cards below are the structured analysis; this is the genuine AI summary that
  // makes the "AI Insights" label honest — with a source badge so users know which they're seeing.
  const transactions = useStore((s) => s.transactions);
  const inventory = useStore((s) => s.inventory);
  const expenses = useStore((s) => s.expenses);
  const storeSettings = useStore((s) => s.storeSettings);
  const [aiNarrative, setAiNarrative] = useState<AIInsight | null>(null);
  useEffect(() => {
    if (!canUseAiInsight || !storeId || !hasBusinessData) return;
    let cancelled = false;
    const ctx = buildInsightContext({
      transactions,
      inventory,
      expenses,
      storeName: storeSettings?.store_name || 'Kafe Saya',
    });
    getAIInsightCached(ctx)
      .then((insight) => { if (!cancelled) setAiNarrative(insight); })
      .catch(() => { /* keep the structured cards even if the narrative fetch fails */ });
    return () => { cancelled = true; };
  }, [canUseAiInsight, storeId, hasBusinessData, transactions, inventory, expenses, storeSettings?.store_name]);

  const openUpgrade = useCallback(() => {
    dispatchUpgradePrompt({
      trigger: 'ai_insight',
      promptKey: 'feature:ai_insight_dashboard',
      recommendedPlan: 'signature',
      title: 'Analisis penjualan tersedia di paket Signature',
      description: 'Upgrade untuk melihat tren penjualan, menu terlaris, jam ramai, performa staf, dan saran stok.',
    });
  }, []);

  const loadInsights = useCallback(async (refresh = false) => {
    if (!storeId || !canUseAiInsight) return;
    setError('');
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await getEnhancedAiInsights(storeId, { refresh });
      setData(response);
    } catch (err) {
      setError(normalizeUserFacingError(err, 'Analisis penjualan belum bisa dimuat. Ketuk Segarkan untuk mencoba lagi.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canUseAiInsight, storeId]);

  useEffect(() => {
    if (!canUseAiInsight || !storeId || !hasBusinessData) return;
    void loadInsights(false);
  }, [canUseAiInsight, hasBusinessData, loadInsights, storeId]);

  if (!canUseAiInsight) {
    return <LockedState onUpgrade={openUpgrade} />;
  }

  if (!hasBusinessData) {
    return (
      <section className="kaffe-panel rounded-2xl p-5 md:p-6">
        <div className="flex items-start gap-4">
          <LineChartIcon size={20} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
          <div>
            <p className="text-sm font-black text-slate-900">Belum ada analisis penjualan.</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">
              Analisis muncul setelah ada beberapa transaksi, menu, dan stok yang tercatat.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (loading && !data) return <LoadingState />;

  return (
    <section className="kaffe-panel rounded-2xl p-5 md:p-6">
      {aiNarrative && (
        <div className="mb-5 rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50/80 to-white p-4 md:p-5">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <span className="text-[12px] font-semibold text-slate-600">
              {aiNarrative.source === 'gemini' ? 'Dianalisis oleh Google Gemini' : 'Dihitung dari data transaksi, tanpa AI'}
            </span>
          </div>
          <p className="text-sm font-semibold leading-relaxed text-slate-700">{aiNarrative.summary}</p>
          {aiNarrative.tips.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {aiNarrative.tips.slice(0, 3).map((tip, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs font-semibold text-slate-600">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#FF6A00]" aria-hidden="true" />
                  {tip}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-extrabold text-slate-900">Analisis penjualan</h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold leading-relaxed text-slate-500">
            {data?.summary || 'Tren penjualan, menu, staf, stok, dan jam ramai outlet kamu.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadInsights(true)}
          disabled={!storeId || refreshing}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--brand-panel-border)] bg-white px-4 text-[13px] font-bold text-[var(--brand-orange-text)] transition-colors hover:bg-[var(--brand-orange-soft)] disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
          Segarkan
        </button>
      </div>

      {error ? (
        <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {error}
        </div>
      ) : null}

      {data ? (
        <div className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-[var(--brand-panel-border)] bg-white p-5">
              <p className="text-[13px] font-bold text-slate-900">Kondisi outlet</p>
              <ul className="mt-3 space-y-2">
                {data.kopiScore.drivers.map((driver) => (
                  <li key={driver} className="text-[13px] font-medium leading-relaxed text-slate-700">{driver}</li>
                ))}
              </ul>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Tren penjualan</p>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.charts.salesTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                      <YAxis hide />
                      <Tooltip formatter={(value: number) => [fRp(value), 'Penjualan']} />
                      <Line type="monotone" dataKey="value" stroke="#FF6A00" strokeWidth={3} dot={{ r: 3, fill: '#FF6A00' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Jam ramai</p>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.charts.peakHours}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 700 }} />
                      <YAxis hide />
                      <Tooltip formatter={(value: number) => [fRp(value), 'Penjualan']} />
                      <Bar dataKey="revenue" fill="#FF6A00" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <div className="mb-4 flex items-center gap-3">
              <p className="text-sm font-black text-slate-900">Yang bisa dilakukan minggu ini</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {data.recommendations.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-slate-900">{item.title}</p>
                    <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${
                      item.priority === 'high' ? 'bg-orange-100 text-orange-700' : item.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {item.priority === 'high' ? 'Penting' : item.priority === 'medium' ? 'Sedang' : 'Nanti'}
                    </span>
                  </div>
                  <p className="text-xs font-semibold leading-relaxed text-slate-600">{item.action}</p>
                  <p className="mt-3 text-[11px] font-black uppercase tracking-wider text-[#FF6A00]">{item.impact}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span>{data.dataCoverage.transactions} transaksi</span>
            <span>•</span>
            <span>{data.dataCoverage.days} hari</span>
            <span>•</span>
            <span>{data.fromCache ? 'Diperbarui dalam 24 jam terakhir' : 'Baru diperbarui'}</span>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <AlertTriangle size={28} className="mx-auto text-slate-300" />
          <p className="mt-3 text-sm font-black text-slate-800">Belum ada analisis.</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Ketuk Segarkan setelah transaksi, menu, dan stok tersinkron.</p>
        </div>
      )}
    </section>
  );
}
