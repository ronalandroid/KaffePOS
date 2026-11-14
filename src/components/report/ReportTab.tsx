// src/components/report/ReportTab.tsx — v5 + Gemini AI Insight
import { useState, useMemo, useCallback } from 'react';
import { Download, FileText, TrendingUp, ShoppingBag, DollarSign, CreditCard, Wallet, Receipt, Lock, AlertTriangle } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { useAuth } from '@/contexts/AuthContext';
import { generateProfessionalPDF, type ReportData } from '@/utils/pdfReport';
import { getAIInsightCached, type InsightContext, type AIInsight } from '@/lib/aiInsight';
import { calculateTransactionPoints } from '@/lib/gamification';
import ExpenseModal from '@/components/pos/ExpenseModal';
import CashRegisterModal from '@/components/pos/CashRegisterModal';
import type { SubscriptionAccess } from '@/lib/subscriptionAccess';
import type { Transaction, Expense, InventoryItem, MenuItem, CashRegister, TransactionItem } from '@/types';
import { dispatchUpgradePrompt } from '@/lib/upgradePrompts';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { trackOpsEvent } from '@/lib/opsMetrics';
import { fRp, COLORS, getExpenseSource, type Period, type ChartKey } from './reportFormat';
import { StatCard } from './StatCard';
import { AiInsightPanel } from './AiInsightPanel';
import { ReportChartsPanel } from './ReportChartsPanel';
import { ProfitLossPanel } from './ProfitLossPanel';
import { CashRegisterPanel } from './CashRegisterPanel';
import { KasOperasionalPanel } from './KasOperasionalPanel';
import { ExpenseOpsPanel } from './ExpenseOpsPanel';

type ToastApi = { showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void };

const REPORT_PERIODS = [
  { id: 'harian', l: 'Hari Ini', requiresAdvanced: false },
  { id: 'mingguan', l: '7 Hari', requiresAdvanced: true },
  { id: 'bulanan', l: 'Bulan Ini', requiresAdvanced: true },
  { id: 'custom', l: 'Custom', requiresAdvanced: true },
  { id: 'semua', l: 'Semua', requiresAdvanced: false },
] as const;

export default function ReportTab({ toast, subscriptionAccess }: { toast: ToastApi; subscriptionAccess: SubscriptionAccess }) {
  const { transactions, expenses, inventory, menu, storeSettings, cashRegister = [] } = useStore();
  const { user, profile } = useAuth();
  const [period, setPeriod]     = useState<Period>('harian');
  const [customStart, setCustomStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [activeChart, setChart] = useState<ChartKey>('trend');
  const [downloading, setDl]    = useState(false);

  // ── AI Insight state ──────────────────────────────────────────
  const [aiData,    setAiData]    = useState<AIInsight | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError,   setAiError]   = useState('');
  const [aiOpen,    setAiOpen]    = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showCashRegisterModal, setShowCashRegisterModal] = useState(false);
  const canExportReports = subscriptionAccess.features.report_export;
  const canUseAdvancedPeriods = subscriptionAccess.features.report_advanced_periods;
  const canUseAiInsight = subscriptionAccess.features.ai_insight;

  const filtered = useMemo(()=>{
    const now=new Date();
    const start = new Date(`${customStart}T00:00:00`);
    const end = new Date(`${customEnd}T23:59:59`);
    return transactions.filter((t: Transaction)=>{
      if(t.is_void)return false;const d=new Date(t.date);
      if(period==='harian')return d.toDateString()===now.toDateString();
      if(period==='mingguan'){const w=new Date(now);w.setDate(w.getDate()-7);return d>=w;}
      if(period==='bulanan')return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
      if(period==='custom')return d>=start&&d<=end;
      return true;
    });
  },[customEnd, customStart, transactions, period]);

  const filteredExp = useMemo(()=>{
    const now=new Date();
    const start = new Date(`${customStart}T00:00:00`);
    const end = new Date(`${customEnd}T23:59:59`);
    return expenses.filter((e: Expense)=>{
      const d=new Date(e.date);
      if(period==='harian')return d.toDateString()===now.toDateString();
      if(period==='mingguan'){const w=new Date(now);w.setDate(w.getDate()-7);return d>=w;}
      if(period==='bulanan')return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
      if(period==='custom')return d>=start&&d<=end;
      return true;
    });
  },[customEnd, customStart, expenses,period]);

  const totalRevenue  = filtered.reduce((s:number,t: Transaction)=>s+t.total,0);
  const totalCogs     = filtered.reduce((s:number,t: Transaction)=>s+(t.cogs||0),0);
  const totalExpenses = filteredExp.reduce((s:number,e: Expense)=>s+e.amount,0);
  const grossProfit   = totalRevenue-totalCogs;
  const netProfit     = grossProfit-totalExpenses;
  const avgTrx        = filtered.length>0?Math.round(totalRevenue/filtered.length):0;
  const grossMargin   = totalRevenue>0?Math.round((grossProfit/totalRevenue)*100):0;
  const totalStockVal = inventory.reduce((s:number,i: InventoryItem)=>s+i.stock*i.cost_per_unit,0);
  const lowStockCount = inventory.filter((i: InventoryItem)=>i.stock<=i.min_stock).length;

  const filteredCR = useMemo(()=>{
    const now=new Date();
    const start = new Date(`${customStart}T00:00:00`);
    const end = new Date(`${customEnd}T23:59:59`);
    return (cashRegister||[]).filter((c: CashRegister)=>{
      const d=new Date(c.date);
      if(period==='harian') return d.toDateString()===now.toDateString();
      if(period==='mingguan'){const w=new Date(now);w.setDate(w.getDate()-7);return d>=w;}
      if(period==='bulanan') return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
      if(period==='custom') return d>=start&&d<=end;
      return true;
    });
  },[cashRegister,customEnd,customStart,period]);

  const filteredExpOps = useMemo(
    () => filteredExp.filter((e: Expense) => getExpenseSource(e) === 'cashier' && e.category !== 'Bahan Baku'),
    [filteredExp]
  );
  const totalCashRegister = filteredCR.reduce((s:number,c: CashRegister)=>s+c.amount,0);
  const totalExpOps       = filteredExpOps.reduce((s:number,e: Expense)=>s+e.amount,0);
  const todayCashRegisterEntry = useMemo(() => {
    const today = new Date().toDateString();
    return [...cashRegister]
      .filter((entry: CashRegister) => new Date(entry.date).toDateString() === today)
      .sort((a: CashRegister, b: CashRegister) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] || null;
  }, [cashRegister]);

  // ── Kalkulasi Kas Operasional ────────────────────────────────
  const kasSelisih     = totalCashRegister - totalExpOps;          // sisa saldo kasir
  // const kasFromSales   = kasSelisih < 0 ? Math.abs(kasSelisih) : 0; // porsi ambil dari penjualan
  // const kasNetAkhir    = totalCashRegister + totalRevenue - totalExpOps; // total posisi kas akhir

  const trendData = useMemo(()=>{
    const customDays = Math.max(1, Math.min(31, Math.ceil((new Date(`${customEnd}T23:59:59`).getTime() - new Date(`${customStart}T00:00:00`).getTime()) / 86_400_000) + 1));
    const days=period==='harian'?8:period==='mingguan'?7:period==='custom'?customDays:14;
    return Array.from({length:days},(_,i)=>{
      const d=period==='custom'?new Date(`${customStart}T00:00:00`):new Date();d.setDate(d.getDate()+(period==='custom'?i:-(days-1-i)));
      const label=period==='bulanan'?`${d.getDate()}`:d.toLocaleDateString('id-ID',{weekday:'short'}).slice(0,3);
      const value=transactions.filter((t: Transaction)=>!t.is_void&&new Date(t.date).toDateString()===d.toDateString()).reduce((s:number,t: Transaction)=>s+t.total,0);
      return {label,value};
    });
  },[customEnd, customStart, transactions,period]);

  const menuRanking = useMemo(()=>{
    const m: Record<string, { qty: number; rev: number }> = {};
    filtered.forEach((t: Transaction)=>t.items.forEach((item: TransactionItem)=>{if(!m[item.name])m[item.name]={qty:0,rev:0};m[item.name].qty+=item.qty;m[item.name].rev+=item.subtotal;}));
    return Object.entries(m).map(([name,v])=>({label:name,value:v.qty,sub:fRp(v.rev),rev:v.rev})).sort((a,b)=>b.value-a.value).slice(0,8);
  },[filtered]);

  const menuPieData = useMemo(()=>{
    if(!menuRanking.length)return [];
    const top6=menuRanking.slice(0,6);
    const others=menuRanking.slice(6).reduce((s:number,m)=>s+m.value,0);
    const result=top6.map((m,i:number)=>({label:m.label,value:m.value,color:COLORS[i]}));
    if(others>0)result.push({label:'Lainnya',value:others,color:'#94a3b8'});
    return result;
  },[menuRanking]);

  const paymentData = useMemo(()=>{
    const m: Record<string, number> = {};
    filtered.forEach((t: Transaction)=>{m[t.method]=(m[t.method]||0)+t.total;});
    return Object.entries(m).map(([label,value],i)=>({label,value:value as number,color:COLORS[i%COLORS.length]}));
  },[filtered]);

  const categorySales = useMemo(() => {
    const menuCategory = new Map(menu.map((item: MenuItem) => [item.id, item.category || 'Lainnya']));
    const buckets = new Map<string, { qty: number; revenue: number }>();
    filtered.forEach((tx: Transaction) => {
      tx.items.forEach((item: TransactionItem) => {
        const category = menuCategory.get(item.menu_item_id ?? '') || 'Lainnya';
        const current = buckets.get(category) || { qty: 0, revenue: 0 };
        buckets.set(category, {
          qty: current.qty + (item.qty || 0),
          revenue: current.revenue + (item.subtotal || 0),
        });
      });
    });
    return [...buckets.entries()]
      .map(([label, value]) => ({ label, ...value }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filtered, menu]);

  const staffPerformance = useMemo(() => {
    const buckets = new Map<string, { transactions: number; revenue: number; points: number }>();
    filtered.forEach((tx: Transaction) => {
      const name = tx.cashier || 'Kasir';
      const current = buckets.get(name) || { transactions: 0, revenue: 0, points: 0 };
      buckets.set(name, {
        transactions: current.transactions + 1,
        revenue: current.revenue + (tx.total || 0),
        points: current.points + calculateTransactionPoints(tx),
      });
    });
    return [...buckets.entries()]
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.points - a.points || b.revenue - a.revenue)
      .slice(0, 8);
  }, [filtered]);

  const kopiScore = useMemo(() => {
    const revenueScore = totalRevenue > 0 ? Math.min(35, Math.round(totalRevenue / 100000) * 4) : 0;
    const marginScore = Math.max(0, Math.min(30, Math.round(grossMargin * 0.3)));
    const stockScore = inventory.length ? Math.max(0, 20 - lowStockCount * 4) : 12;
    const activityScore = Math.min(15, filtered.length * 2);
    const score = Math.max(0, Math.min(100, revenueScore + marginScore + stockScore + activityScore));
    const label = score >= 85 ? 'Excellent' : score >= 70 ? 'Stabil' : score >= 55 ? 'Perlu Optimasi' : 'Perlu Perhatian';
    return { score, label };
  }, [filtered.length, grossMargin, inventory.length, lowStockCount, totalRevenue]);

  const stockData = useMemo(()=>
    inventory.map((i: InventoryItem)=>({label:i.name,stock:i.stock,unit:i.unit,min:i.min_stock,pct:i.min_stock>0?Math.round((i.stock/i.min_stock)*100):999}))
      .sort((a,b)=>a.pct-b.pct).slice(0,10)
  ,[inventory]);

  // ── AI Insight fetch ──────────────────────────────────────────
  const fetchAI = useCallback(async (force = false) => {
    if (!canUseAiInsight) {
      setAiOpen(false);
      dispatchUpgradePrompt({
        trigger: 'ai_insight',
        promptKey: 'feature:ai_insight',
        recommendedPlan: 'signature',
        title: 'AI Insight ada di paket Signature',
        description: 'Upgrade saat kamu butuh analisis menu terlaris, prediksi stok, dan rekomendasi operasional yang lebih tajam.',
      });
      return;
    }
    setAiLoading(true); setAiError('');
    if (force) setAiData(null);
    try {
      const topMenus = menuRanking.slice(0,5).map((m) => ({
        name:    m.label,
        qty:     m.value,
        revenue: m.rev || 0,
      }));
      const lowStockItems = inventory
        .filter((i: InventoryItem) => i.stock <= i.min_stock)
        .slice(0,5)
        .map((i: InventoryItem) => ({ name: i.name, stock: i.stock, unit: i.unit, min: i.min_stock }));
      const paymentMix = (['Tunai','Transfer','QRIS'] as const).map(m => ({
        method: m,
        pct:    filtered.length > 0
          ? Math.round(filtered.filter((t: Transaction) => t.method === m).length / filtered.length * 100)
          : 0,
      }));

      const ctx: InsightContext = {
        period:       period === 'harian' ? 'Hari Ini' : period === 'mingguan' ? 'Minggu Ini' : period === 'bulanan' ? 'Bulan Ini' : 'Semua Waktu',
        storeName:    storeSettings?.store_name || 'Kafe Saya',
        totalRevenue, totalCogs, netProfit, grossMargin,
        txCount:      filtered.length,
        avgTrx,       topMenus, lowStockItems,
        totalExpenses,
        trendData:    trendData.slice(-7),
        paymentMix,
      };
      const result = await getAIInsightCached(ctx);
      setAiData(result);
      setAiOpen(true);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Gagal mendapatkan insight AI');
    } finally { setAiLoading(false); }
  }, [avgTrx, canUseAiInsight, filtered, grossMargin, inventory, menuRanking, netProfit, period, storeSettings, totalCogs, totalExpenses, totalRevenue, trendData]);

  const handleOpenLicense = useCallback(() => {
    dispatchUpgradePrompt({
      trigger: 'ai_insight',
      promptKey: 'feature:ai_insight',
      recommendedPlan: 'signature',
      title: 'AI Insight ada di paket Signature',
      description: 'Upgrade saat kamu butuh analisis menu terlaris, prediksi stok, dan rekomendasi operasional yang lebih tajam.',
    });
  }, []);

  const buildReportPayload = useCallback((): ReportData => {
    const periodLabel = period === 'harian'
      ? 'Hari Ini'
      : period === 'mingguan'
        ? '7 Hari Terakhir'
        : period === 'bulanan'
          ? 'Bulan Ini'
          : period === 'custom'
            ? `${new Date(`${customStart}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })} - ${new Date(`${customEnd}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`
            : 'Semua Waktu';
    const titlePeriod = period === 'bulanan'
      ? new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
      : periodLabel;
    const nowStr      = new Date().toLocaleString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const reportTitle = `Laporan Penjualan ${titlePeriod}`;

    const payload: ReportData = {
      storeName:     storeSettings?.store_name || 'KaffePOS',
      tagline:       storeSettings?.tagline,
      address:       storeSettings?.address,
      phone:         storeSettings?.whatsapp || (storeSettings as { phone?: string } | null)?.phone,
      logoData:      storeSettings?.logo_url || storeSettings?.logo_base64,
      period:        period,
      periodLabel,
      reportTitle,
      fileBaseName:  reportTitle,
      nowStr,

      totalRevenue,
      totalCogs,
      grossProfit,
      totalExpenses,
      netProfit,
      grossMargin,
      avgTrx,
      txCount:       filtered.length,

      trendData,
      menuRanking,
      paymentData,
      stockData,
      categorySales,
      staffPerformance,
      kopiScore,
      recentTransactions: filtered
        .slice()
        .sort((a: Transaction, b: Transaction) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 30),

      expensesByCategory: (() => {
        const m: Record<string, number> = {};
        filteredExp.forEach((e: Expense) => { m[e.category] = (m[e.category] || 0) + e.amount; });
        return Object.entries(m).map(([l, v]) => ({ label: l, value: v as number })).sort((a,b) => b.value - a.value);
      })(),
      expenseList: filteredExp,
      cashRegister: filteredCR,
      aiInsight: aiData?.summary ?? null,
    };

    if (aiData) {
      payload.aiTips = [
        aiData.bestMenu,
        aiData.stockAlert,
        aiData.prediction,
        ...(aiData.tips || []),
      ].filter(Boolean);
    }

    return payload;
  }, [
    period,
    storeSettings,
    totalRevenue,
    totalCogs,
    grossProfit,
    totalExpenses,
    netProfit,
    grossMargin,
    avgTrx,
    filtered,
    trendData,
    menuRanking,
    paymentData,
    stockData,
    filteredExp,
    filteredCR,
    categorySales,
    staffPerformance,
    kopiScore,
    customStart,
    customEnd,
    aiData,
  ]);

  const handleDownload = async () => {
    if (!canExportReports) {
      dispatchUpgradePrompt({
        trigger: 'report_export',
        promptKey: 'feature:report_export',
        recommendedPlan: 'kopi_susu',
        title: 'Export PDF tersedia di paket Kopi Susu',
        description: 'Upgrade untuk mengunduh laporan profesional dan membagikan ringkasan performa outlet kapan saja.',
      });
      return;
    }
    setDl(true);
    try {
      await generateProfessionalPDF(buildReportPayload());
      trackAnalyticsEvent('pdf_exported', { period, transactions: filtered.length, revenue: totalRevenue });
      void trackOpsEvent({
        event_name: 'pdf_exported',
        status: 'success',
        metadata: { period, transactions: filtered.length, revenue: totalRevenue },
      });
      toast.showToast('Laporan PDF berhasil diunduh!', 'success');
    } catch (e) {
      toast.showToast(`Gagal membuat PDF: ${e instanceof Error ? e.message : 'Error'}`, 'error');
      void trackOpsEvent({
        event_name: 'pdf_exported',
        status: 'failure',
        error_message: e instanceof Error ? e.message : 'PDF export failed',
        metadata: { period, transactions: filtered.length, revenue: totalRevenue },
      });
    } finally {
      setDl(false);
    }
  };

  const handleEmailInsight = () => {
    if (!aiData) return;
    const to = user?.email || profile?.email || '';
    const subject = encodeURIComponent(`Insight Bisnis KaffePOS - ${period}`);
    const body = encodeURIComponent(
      `Halo,\nBerikut adalah hasil analisis AI bisnis Anda:\n\n` +
      `Ringkasan: ${aiData.summary}\n\n` +
      `Menu terbaik: ${aiData.bestMenu}\n\n` +
      `Status stok: ${aiData.stockAlert}\n\n` +
      `Prediksi: ${aiData.prediction}\n\n` +
      `Tips Aksi:\n- ${aiData.tips.join('\n- ')}\n\n` +
      `-- Dikirim OTOMATIS oleh KaffePOS AI`
    );
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  };

  const hasAnyReportData = filtered.length > 0 || filteredExp.length > 0 || filteredCR.length > 0;

  return (
    <div className="kaffe-app-bg kaffe-responsive-surface flex-1 flex flex-col overflow-hidden">
      <div className="z-10 border-b border-[var(--brand-panel-border)] bg-white px-4 pt-5 sm:px-6 lg:px-8">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">Laporan</h2>
            <p className="mt-1 text-[13px] font-medium text-slate-500">Pendapatan, laba, kas, dan pengeluaran toko kamu.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button"
              onClick={() => setShowCashRegisterModal(true)}
              title="Edit saldo kasir"
              aria-label="Edit saldo kasir"
              className="kaffe-icon-btn"
            >
              <Wallet size={18} />
            </button>
            <button type="button"
              onClick={() => setShowExpenseModal(true)}
              aria-label="Catat pengeluaran"
              className="inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--brand-panel-border)] bg-white px-3 sm:px-4 text-[13px] font-bold text-slate-700 transition-colors hover:border-orange-200 hover:bg-[var(--brand-orange-soft)]"
            >
              <Receipt size={16} className="text-[var(--brand-orange-text)]" /><span className="hidden sm:inline">Catat Pengeluaran</span>
            </button>
            <button type="button" onClick={handleDownload} disabled={downloading}
              className={`inline-flex h-11 items-center gap-2 rounded-xl px-4 text-[14px] font-bold disabled:opacity-50 ${canExportReports ? 'kaffe-gradient-cta' : 'border border-[var(--brand-panel-border)] bg-white text-slate-700 hover:bg-[var(--brand-canvas)]'}`}>
              {downloading?<div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"/>:<Download size={16}/>}
              {downloading?'Memproses...':canExportReports?'Ekspor PDF':'Ekspor (Premium)'}
            </button>
          </div>
        </div>
        <nav aria-label="Periode laporan" className="kaffe-scroll-tabs kaffe-command-bar -mx-4 flex gap-1 overflow-x-auto px-4 no-scrollbar sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {REPORT_PERIODS.map((p) => {
            const locked = p.requiresAdvanced && !canUseAdvancedPeriods;
            const active = period === p.id;
            return (
              <button type="button"
                key={p.id}
                onClick={() => {
                  if (locked) {
                    dispatchUpgradePrompt({
                      trigger: 'advanced_reports',
                      promptKey: 'feature:advanced_reports',
                      recommendedPlan: 'kopi_susu',
                      title: 'Laporan lanjutan tersedia di paket Kopi Susu',
                      description: 'Buka laporan 7 hari, bulanan, dan tampilan semua periode untuk membaca performa outlet dengan lebih rapi.',
                    });
                    return;
                  }
                  setPeriod(p.id as Period);
                }}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-[13px] transition-colors ${
                  active
                    ? 'font-bold text-[var(--brand-orange-text)] after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-full after:bg-[#FF6A00]'
                    : 'font-semibold text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.l}
                {locked && <Lock size={12} className="text-slate-500" aria-label="Terkunci" />}
              </button>
            );
          })}
        </nav>
        {period === 'custom' && (
          <div className="grid gap-3 py-3 sm:grid-cols-2 md:max-w-xl">
            <label className="text-[12.5px] font-semibold text-slate-600">
              Dari Tanggal
              <input
                type="date"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-[var(--brand-panel-border)] bg-white px-3 font-medium text-slate-800 outline-none focus:border-[#FF6A00]/60 focus:ring-4 focus:ring-[#FF6A00]/15"
              />
            </label>
            <label className="text-[12.5px] font-semibold text-slate-600">
              Sampai Tanggal
              <input
                type="date"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-[var(--brand-panel-border)] bg-white px-3 font-medium text-slate-800 outline-none focus:border-[#FF6A00]/60 focus:ring-4 focus:ring-[#FF6A00]/15"
              />
            </label>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24 sm:p-5 lg:p-8 lg:pb-8 space-y-4">
        {!hasAnyReportData && (
          <div className="kaffe-empty-state rounded-[20px] p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-canvas)] text-stone-300">
               <Receipt size={28} />
            </div>
            <p className="mb-1 font-display text-base font-extrabold text-slate-800">Belum ada data laporan</p>
            <p className="mx-auto max-w-md text-[13px] font-medium leading-relaxed text-slate-500">
              Laporan terisi otomatis setelah transaksi, saldo kasir, atau pengeluaran dicatat pada periode ini.
            </p>
          </div>
        )}
        {/* KPI */}
        <div className="kaffe-card-grid grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <StatCard label="Pendapatan" value={fRp(totalRevenue)} sub={`${filtered.length} transaksi`} icon={<DollarSign size={16}/>} color="orange"/>
          <StatCard label="Laba Bersih" value={fRp(netProfit)} sub={`Margin ${grossMargin}%`} icon={<TrendingUp size={16}/>} color={netProfit>=0?'green':'red'}/>
          <StatCard label="Total HPP" value={fRp(totalCogs)} sub={`Pengeluaran ${fRp(totalExpenses)}`} icon={<CreditCard size={16}/>} color="red"/>
          <StatCard label="Rata-rata Transaksi" value={fRp(avgTrx)} sub={`Laba kotor ${fRp(grossProfit)}`} icon={<ShoppingBag size={16}/>} color="blue"/>
          <StatCard label="Saldo Kasir" value={fRp(totalCashRegister)} sub={`${filteredCR.length}× buka kasir`} icon={<Wallet size={16}/>} color="orange"/>
          <StatCard label="Pengeluaran Ops" value={fRp(totalExpOps)} sub="Di luar bahan baku" icon={<Receipt size={16}/>} color="red"/>
        </div>

        <AiInsightPanel
          aiData={aiData}
          aiLoading={aiLoading}
          aiError={aiError}
          aiOpen={aiOpen}
          canUseAiInsight={canUseAiInsight}
          onToggle={() => setAiOpen(o => !o)}
          onFetch={() => fetchAI()}
          onRefresh={() => fetchAI(true)}
          onOpenLicense={handleOpenLicense}
          onEmailCopy={handleEmailInsight}
        />

        {lowStockCount>0&&<div className="flex items-center gap-3 rounded-[20px] border border-rose-200 bg-rose-50 p-4"><AlertTriangle size={18} className="shrink-0 text-rose-600" aria-hidden="true"/><p className="text-[13.5px] font-medium text-rose-800"><span className="font-bold">{lowStockCount} bahan kritis.</span> Restock dari tab Stok.</p></div>}

        {/* Charts */}
        <ReportChartsPanel
          activeChart={activeChart}
          onSelectChart={setChart}
          trendData={trendData}
          menuPieData={menuPieData}
          menuRanking={menuRanking}
          paymentData={paymentData}
          stockData={stockData}
          totalRevenue={totalRevenue}
          totalStockVal={totalStockVal}
        />

        {/* P&L */}
        <ProfitLossPanel
          totalRevenue={totalRevenue}
          totalCogs={totalCogs}
          grossProfit={grossProfit}
          totalExpenses={totalExpenses}
          netProfit={netProfit}
          avgTrx={avgTrx}
          grossMargin={grossMargin}
          txCount={filtered.length}
          totalStockVal={totalStockVal}
        />

        {/* ── Saldo Kasir ──────────────────────────────── */}
        <CashRegisterPanel totalCashRegister={totalCashRegister} entries={filteredCR} />

        {/* ── Kas Operasional Harian ─────────────────────── */}
        <KasOperasionalPanel
          kasSelisih={kasSelisih}
          cashRegister={cashRegister}
          expenses={expenses}
          transactions={transactions}
          period={period}
        />

        {/* ── Pengeluaran Operasional ───────────────────── */}
        <ExpenseOpsPanel totalExpOps={totalExpOps} entries={filteredExpOps} />

        <p className="flex items-center justify-center gap-2 px-4 py-2 text-center text-[12px] font-medium text-slate-500">
          <FileText size={14} className="shrink-0" aria-hidden="true" />
          Ekspor PDF memuat {filtered.length} transaksi, semua grafik, dan inventaris.
        </p>
      </div>
      {showExpenseModal && (
        <ExpenseModal
          onClose={() => setShowExpenseModal(false)}
          cashierName={profile?.display_name || profile?.username || 'Kasir'}
          toast={toast}
        />
      )}
      {showCashRegisterModal && (
        <CashRegisterModal
          onClose={() => setShowCashRegisterModal(false)}
          cashierName={profile?.display_name || profile?.username || user?.email || 'Kasir'}
          toast={toast}
          existingEntry={todayCashRegisterEntry}
        />
      )}
    </div>
  );
}
