
import { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  Package,
  ShoppingCart,
  Wallet,
  AlertTriangle,
  Clock3,
  RefreshCw,
  CheckCircle2,
  X,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { useStore } from '@/hooks/useStore';
import { useAuth } from '@/contexts/AuthContext';
import { getInventoryUsageMap } from '@/utils/receipt';
import { getOnboardingChecklist } from '@/lib/onboarding';
import type { Tab, Transaction, Expense, InventoryItem, CashRegister, TransactionItem } from '@/types';
import AIInsightsPage from './AIInsightsPage';

const fRp = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n || 0);

type RangeKey = 'today' | 'week' | 'month';

const COLORS = ['#FF6A00', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#eab308'];

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function DashboardCard({
  title,
  value,
  sub,
  icon,
  color,
}: {
  title: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="kaffe-metric-card kaffe-card-interactive flex min-w-0 flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-slate-600 sm:truncate">{title}</p>
        <span
          className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:flex"
          style={{ backgroundColor: `${color}14`, color }}
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>
      <p className="mt-2 truncate font-display text-[20px] font-extrabold leading-tight text-slate-900 kaffe-num sm:mt-3 sm:text-[26px]">{value}</p>
      <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-snug text-slate-500">{sub}</p>
    </div>
  );
}

function openDashboardTab(targetTab: Tab) {
  window.dispatchEvent(new CustomEvent('kaffepos-open-tab', { detail: { tab: targetTab } }));
}

export default function Dashboard() {
  const { subscriptionAccess } = useAuth();
  // Individual selectors so kitchen realtime events and cart changes don't re-run the
  // dashboard's expensive analytics memos — only the slices read here trigger a re-render.
  const storeId = useStore((s) => s.storeId);
  const transactions = useStore((s) => s.transactions);
  const expenses = useStore((s) => s.expenses);
  const inventory = useStore((s) => s.inventory);
  const unitConversions = useStore((s) => s.unitConversions);
  const menu = useStore((s) => s.menu);
  const cashRegister = useStore((s) => s.cashRegister);
  const storeSettings = useStore((s) => s.storeSettings);
  const loading = useStore((s) => s.loading);
  const syncing = useStore((s) => s.syncing);
  const isOnline = useStore((s) => s.isOnline);
  const loadAll = useStore((s) => s.loadAll);
  const [range, setRange] = useState<RangeKey>('today');
  const [refreshing, setRefreshing] = useState(false);
  const [showBetaBadge, setShowBetaBadge] = useState(() => {
    try {
      return localStorage.getItem('kpos_dashboard_beta_badge_dismissed') !== '1';
    } catch {
      return true;
    }
  });

  // Refresh the "today" baseline when the calendar day rolls over or the tab regains
  // focus — otherwise a POS left open past midnight keeps showing yesterday under "Hari Ini".
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const d = new Date();
      const nextMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 5).getTime();
      timerId = setTimeout(() => {
        setNowTs(Date.now());
        scheduleMidnight();
      }, nextMidnight - d.getTime());
    };
    scheduleMidnight();
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNowTs(Date.now());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timerId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const { now, startToday, startWeek, startMonth } = useMemo(() => {
    const d = new Date(nowTs);
    return {
      now: d,
      startToday: startOfDay(d),
      startWeek: startOfWeek(d),
      startMonth: startOfMonth(d),
    };
  }, [nowTs]);

  const nonVoidTransactions = useMemo(
    () => transactions.filter((t: Transaction) => !t.is_void),
    [transactions]
  );

  const salesToday = useMemo(
    () =>
      nonVoidTransactions
        .filter((t: Transaction) => isSameDay(new Date(t.date), now))
        .reduce((sum: number, t: Transaction) => sum + (t.total || 0), 0),
    [nonVoidTransactions, now]
  );

  const salesWeek = useMemo(
    () =>
      nonVoidTransactions
        .filter((t: Transaction) => new Date(t.date) >= startWeek)
        .reduce((sum: number, t: Transaction) => sum + (t.total || 0), 0),
    [nonVoidTransactions, startWeek]
  );

  const salesMonth = useMemo(
    () =>
      nonVoidTransactions
        .filter((t: Transaction) => new Date(t.date) >= startMonth)
        .reduce((sum: number, t: Transaction) => sum + (t.total || 0), 0),
    [nonVoidTransactions, startMonth]
  );

  const rangeStart = range === 'today' ? startToday : range === 'week' ? startWeek : startMonth;

  const filteredTransactions = useMemo(
    () => nonVoidTransactions.filter((t: Transaction) => new Date(t.date) >= rangeStart),
    [nonVoidTransactions, rangeStart]
  );

  const filteredExpenses = useMemo(
    () => expenses.filter((e: Expense) => new Date(e.date) >= rangeStart),
    [expenses, rangeStart]
  );

  const topProducts = useMemo(() => {
    const buckets = new Map<string, { qty: number; revenue: number }>();
    filteredTransactions.forEach((trx: Transaction) => {
      (trx.items || []).forEach((item: TransactionItem) => {
        const prev = buckets.get(item.name) || { qty: 0, revenue: 0 };
        buckets.set(item.name, {
          qty: prev.qty + (item.qty || 0),
          revenue: prev.revenue + (item.subtotal || 0),
        });
      });
    });
    return [...buckets.entries()]
      .map(([label, data]) => ({ label, value: data.qty, revenue: data.revenue }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredTransactions]);

  const paymentData = useMemo(() => {
    const buckets = new Map<string, number>();
    filteredTransactions.forEach((trx: Transaction) => {
      buckets.set(trx.method, (buckets.get(trx.method) || 0) + (trx.total || 0));
    });
    return [...buckets.entries()].map(([label, value], index) => ({
      label,
      value,
      color: COLORS[index % COLORS.length],
    }));
  }, [filteredTransactions]);

  const trendData = useMemo(() => {
    if (range === 'today') {
      return Array.from({ length: 8 }, (_, index) => {
        const hour = 7 + index * 2;
        const nextHour = hour + 2;
        const value = filteredTransactions
          .filter((trx: Transaction) => {
            const d = new Date(trx.date);
            return isSameDay(d, now) && d.getHours() >= hour && d.getHours() < nextHour;
          })
          .reduce((sum: number, trx: Transaction) => sum + (trx.total || 0), 0);
        return { label: `${String(hour).padStart(2, '0')}:00`, value };
      });
    }

    const days = range === 'week' ? 7 : Math.min(14, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
    return Array.from({ length: days }, (_, index) => {
      const dayDate = new Date(rangeStart);
      dayDate.setDate(dayDate.getDate() + index);
      const value = filteredTransactions
        .filter((trx: Transaction) => isSameDay(new Date(trx.date), dayDate))
        .reduce((sum: number, trx: Transaction) => sum + (trx.total || 0), 0);
      return {
        label: range === 'month'
          ? `${dayDate.getDate()}`
          : dayDate.toLocaleDateString('id-ID', { weekday: 'short' }).slice(0, 3),
        value,
      };
    });
  }, [filteredTransactions, now, range, rangeStart]);

  const lowStockItems = useMemo(
    () =>
      inventory
        .filter((item: InventoryItem) => item.stock <= item.min_stock)
        .sort((a: InventoryItem, b: InventoryItem) => (a.stock / Math.max(a.min_stock, 1)) - (b.stock / Math.max(b.min_stock, 1)))
        .slice(0, 5),
    [inventory]
  );

  const onboarding = useMemo(
    () => getOnboardingChecklist({ storeSettings, menu, inventory, transactions }),
    [storeSettings, menu, inventory, transactions],
  );

  const stockUsageRows = useMemo(
    () => getInventoryUsageMap(inventory, menu, transactions, unitConversions),
    [inventory, menu, transactions, unitConversions]
  );

  const stockUsageMap = useMemo(
    () => new Map(stockUsageRows.map((row) => [row.itemId, row])),
    [stockUsageRows]
  );

  const activeCashier = useMemo(() => {
    const todayRegister = cashRegister
      .filter((entry: CashRegister) => isSameDay(new Date(entry.date), now))
      .sort((a: CashRegister, b: CashRegister) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return todayRegister[0] || null;
  }, [cashRegister, now]);

  const totalRangeRevenue = filteredTransactions.reduce((sum: number, trx: Transaction) => sum + (trx.total || 0), 0);
  const totalRangeExpenses = filteredExpenses.reduce((sum: number, exp: Expense) => sum + (exp.amount || 0), 0);
  const avgTransaction = filteredTransactions.length > 0 ? totalRangeRevenue / filteredTransactions.length : 0;
  const hasAnyBusinessData =
    nonVoidTransactions.length > 0 || expenses.length > 0 || inventory.length > 0 || cashRegister.length > 0;

  const handleRefresh = async () => {
    if (!storeId || refreshing) return;
    setRefreshing(true);
    try {
      await loadAll(storeId);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading && transactions.length === 0 && inventory.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 text-slate-400">
        <div className="w-10 h-10 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
        <p className="text-sm font-semibold">Memuat dashboard toko...</p>
      </div>
    );
  }

  return (
    <div className="kaffe-app-bg kaffe-responsive-surface flex-1 min-h-0 overflow-y-auto">
      <div className="min-w-0 p-4 sm:p-5 md:p-6 lg:p-8 pb-24 lg:pb-8 max-w-7xl mx-auto space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-500">
              {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-extrabold text-slate-900 sm:text-[28px]">Dashboard</h1>
              {showBetaBadge ? (
                <span className="inline-flex h-7 items-center gap-0.5 rounded-full border border-orange-200 bg-[var(--brand-orange-soft)] pl-2.5 text-[11px] font-bold text-[var(--brand-orange-text)]">
                  Closed Beta
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        localStorage.setItem('kpos_dashboard_beta_badge_dismissed', '1');
                      } catch {
                        /* ignore */
                      }
                      setShowBetaBadge(false);
                    }}
                    className="kaffe-btn-compact flex h-7 w-7 items-center justify-center rounded-full hover:bg-orange-100"
                    aria-label="Sembunyikan badge beta"
                    title="Sembunyikan badge beta"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              ) : null}
            </div>
            <p className="mt-1 flex items-center gap-2 text-[13px] font-semibold text-slate-600">
              <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} aria-hidden="true" />
              {storeSettings?.store_name || 'KaffePOS'} · {isOnline ? 'Terhubung cloud' : 'Mode offline'}
            </p>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <div className="kaffe-scroll-tabs kaffe-segmented min-w-0 overflow-x-auto no-scrollbar" role="group" aria-label="Periode">
              {[
                { id: 'today', label: 'Hari Ini' },
                { id: 'week', label: '7 Hari' },
                { id: 'month', label: '30 Hari' },
              ].map((item) => (
                <button type="button"
                  key={item.id}
                  onClick={() => setRange(item.id as RangeKey)}
                  aria-pressed={range === item.id}
                  className="shrink-0"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button type="button"
              onClick={handleRefresh}
              disabled={!storeId || refreshing || syncing}
              aria-label="Segarkan data"
              title="Segarkan data"
              className="kaffe-icon-btn shrink-0 disabled:opacity-50"
            >
              <RefreshCw size={18} aria-hidden="true" className={refreshing || syncing ? 'animate-spin text-[var(--brand-orange-text)]' : ''} />
            </button>
          </div>
        </div>

        {!hasAnyBusinessData && (
          <div className="kaffe-empty-state rounded-[20px] p-10 text-center">
            <div className="w-14 h-14 bg-[var(--brand-canvas)] rounded-2xl flex items-center justify-center mx-auto mb-4 text-stone-300">
               <Package size={40} />
            </div>
            <p className="font-display text-lg font-extrabold text-slate-800 mb-2">Dashboard masih kosong</p>
            <p className="text-[13px] text-slate-400 max-w-md mx-auto font-medium leading-relaxed">
              Mulai dengan input menu dan lakukan transaksi pertama agar overview ini terisi otomatis secara realtime.
            </p>
          </div>
        )}

        {subscriptionAccess.isTrial && subscriptionAccess.daysRemaining !== null && (
          <div className="kaffe-card px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="kaffe-eyebrow !text-[var(--brand-orange-text)]">Trial Signature</p>
                <h2 className="mt-1 font-display text-xl font-extrabold text-slate-900">
                  {subscriptionAccess.daysRemaining} hari full fitur premium tersisa
                </h2>
                <p className="mt-1 text-[13px] font-medium leading-relaxed text-slate-600">
                  Gratis 14 Hari • Full Akses Signature • Otomatis Rp49.000/bulan setelah trial berakhir
                </p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-orange-100">
                  <div
                    className="h-full rounded-full bg-[#FF6A00] transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, ((14 - subscriptionAccess.daysRemaining) / 14) * 100))}%` }}
                  />
                </div>
                <p className="mt-2 text-[12px] font-semibold text-slate-600">
                  Hari ke-{Math.min(14, Math.max(1, 14 - subscriptionAccess.daysRemaining + 1))} dari 14. Upgrade bisa kapan saja tanpa mengganggu transaksi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openDashboardTab('settings')}
                className="kaffe-gradient-cta inline-flex h-11 shrink-0 items-center justify-center rounded-xl px-5 text-[14px] font-bold"
              >
                Lihat Paket
              </button>
            </div>
          </div>
        )}

        {!onboarding.complete && (
          <div className="kaffe-panel rounded-[20px] p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="kaffe-eyebrow !text-[var(--brand-orange-text)]">Checklist onboarding</p>
                <h2 className="mt-1 font-display text-lg font-extrabold text-slate-900">
                  {onboarding.completedCount}/{onboarding.totalCount} langkah siap dipakai
                </h2>
                <p className="mt-1 text-[13px] font-semibold text-slate-500">
                  Selesaikan setup inti agar toko siap transaksi, stok, dan laporan.
                </p>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 md:w-44">
                <div className="h-full rounded-full bg-[#FF6A00]" style={{ width: `${onboarding.progressPercent}%` }} />
              </div>
            </div>
            <div className="kaffe-card-grid mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {onboarding.steps.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => openDashboardTab(step.targetTab)}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    step.done
                      ? 'border-[var(--brand-panel-border)] bg-[var(--brand-canvas)]'
                      : 'border-[var(--brand-panel-border)] bg-white hover:border-orange-200 hover:bg-[var(--brand-orange-soft)]'
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className={`text-[13px] font-bold ${step.done ? 'text-slate-600 line-through decoration-slate-300' : 'text-slate-900'}`}>{step.title}</span>
                    {step.done ? <CheckCircle2 size={18} className="text-emerald-600" /> : <span className="h-4 w-4 rounded-full border-2 border-slate-200" />}
                  </div>
                  <p className="min-h-[34px] text-[12px] font-medium leading-relaxed text-slate-600">{step.description}</p>
                  <p className={`mt-3 text-[12px] font-bold ${step.done ? 'text-emerald-700' : 'text-[var(--brand-orange-text)]'}`}>
                    {step.done ? 'Selesai' : step.ctaLabel}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {lowStockItems.length > 0 && (
          <div className="flex flex-col gap-3 rounded-[20px] border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-rose-600">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-[14px] font-bold text-rose-800">Stok kritis perlu dicek</p>
                <p className="mt-0.5 text-[13px] font-medium text-rose-700">
                  {lowStockItems.slice(0, 3).map((item) => `${item.name} ${item.stock} ${item.unit}`).join(' · ')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openDashboardTab('warehouse')}
              className="h-11 w-full shrink-0 rounded-xl border border-rose-200 bg-white px-4 text-[13px] font-bold text-rose-700 hover:bg-rose-100 sm:w-auto"
            >
              Buka Stok
            </button>
          </div>
        )}

        <div className="kaffe-card-grid grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <DashboardCard
            title="Penjualan Hari Ini"
            value={fRp(salesToday)}
            sub={`${nonVoidTransactions.filter((t: Transaction) => isSameDay(new Date(t.date), now)).length} transaksi`}
            icon={<TrendingUp size={17} />}
            color="#C44500"
          />
          <DashboardCard
            title="Penjualan Minggu Ini"
            value={fRp(salesWeek)}
            sub="Live dari transaksi toko"
            icon={<ShoppingCart size={17} />}
            color="#1d4ed8"
          />
          <DashboardCard
            title="Penjualan Bulan Ini"
            value={fRp(salesMonth)}
            sub={`${fRp(avgTransaction)} rata-rata transaksi`}
            icon={<Wallet size={17} />}
            color="#047857"
          />
          <DashboardCard
            title="Kasir Aktif"
            value={activeCashier?.opened_by || 'Belum buka kas'}
            sub={activeCashier ? `Modal ${fRp(activeCashier.amount || 0)}` : 'Belum ada sesi hari ini'}
            icon={<Clock3 size={17} />}
            color="#6d28d9"
          />
        </div>

        <AIInsightsPage
          storeId={storeId}
          canUseAiInsight={subscriptionAccess.features.ai_insight}
          hasBusinessData={hasAnyBusinessData}
        />

        <div className="kaffe-card-grid grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-5">
          <div className="kaffe-panel xl:col-span-2 rounded-[20px] p-5 md:p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-display text-[16px] font-extrabold text-slate-900 flex items-center gap-2">
                  <TrendingUp size={17} className="text-slate-500" />
                  Grafik Penjualan
                </h3>
                <p className="text-[12px] font-medium text-slate-500 mt-0.5">Live dari transaksi toko</p>
              </div>
              {syncing && <RefreshCw size={18} className="text-[#FF6A00] animate-spin" />}
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid vertical={false} stroke="#F1EDE9" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                    tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                  />
                  <Tooltip formatter={(value: number) => [fRp(value), 'Penjualan']} />
                  <Line type="monotone" dataKey="value" stroke="#FF6A00" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffffff', fill: '#FF6A00' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="kaffe-panel rounded-[20px] p-5 md:p-6">
            <h3 className="font-display text-[16px] font-extrabold text-slate-900 mb-5 flex items-center gap-2">
              <Wallet size={17} className="text-slate-500" />
              Metode Bayar
            </h3>
            {paymentData.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-sm text-slate-400">
                Belum ada transaksi untuk periode ini
              </div>
            ) : (
              <>
                <div className="h-[210px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={2}
                        stroke="none"
                        dataKey="value"
                      >
                        {paymentData.map((entry, index) => (
                          <Cell key={`${entry.label}-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [fRp(value), 'Nominal']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[11px] font-semibold text-slate-500">Total</span>
                    <span className="text-[17px] font-extrabold text-slate-900 kaffe-num">{fRp(totalRangeRevenue)}</span>
                  </div>
                </div>
                <div className="space-y-3 mt-4">
                  {paymentData.map((p) => (
                    <div key={p.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="text-[13px] font-medium text-slate-600">{p.label}</span>
                      </div>
                      <span className="text-[13px] font-bold text-slate-900 kaffe-num">{fRp(p.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="kaffe-card-grid grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-5">
          <div className="kaffe-panel rounded-[20px] p-5 md:p-6">
            <h3 className="font-display text-[16px] font-extrabold text-slate-900 mb-5 flex items-center gap-2">
              <Package size={17} className="text-slate-500" />
              Terlaris
            </h3>
            {topProducts.length === 0 ? (
              <p className="text-sm text-slate-400">Belum ada produk terjual pada periode ini.</p>
            ) : (
              <div className="divide-y divide-[var(--brand-hairline)]">
                {topProducts.map((product, index) => (
                  <div key={product.label} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[var(--brand-canvas)] flex items-center justify-center text-slate-600 font-bold text-[12px] shrink-0 kaffe-num">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-bold text-slate-900 truncate">{product.label}</p>
                        <p className="text-[12px] text-slate-500 kaffe-num">{product.value} item terjual</p>
                      </div>
                    </div>
                    <p className="text-[13.5px] font-extrabold text-slate-900 shrink-0 ml-3 kaffe-num">{fRp(product.revenue)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="kaffe-panel rounded-[20px] p-5 md:p-6">
            <h3 className="font-display text-[16px] font-extrabold text-slate-900 mb-5 flex items-center gap-2">
              <AlertTriangle size={17} className="text-slate-500" />
              Peringatan Stok
            </h3>
            {lowStockItems.length === 0 ? (
              <p className="text-sm text-slate-400">Semua stok utama masih aman.</p>
            ) : (
              <div className="space-y-4">
                {lowStockItems.map((item) => {
                  const usage = stockUsageMap.get(item.id);
                  const pct = usage?.percent ?? (item.min_stock > 0 ? Math.min(100, Math.round((item.stock / item.min_stock) * 100)) : 100);
                  return (
                    <div key={item.id} className="space-y-2">
                      <div className="flex justify-between items-end gap-3">
                        <span className="text-[13px] font-bold text-slate-800">{item.name}</span>
                        <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md kaffe-num">
                          {item.stock} {item.unit}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct < 50 ? 'bg-rose-500' : 'bg-amber-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[11.5px] text-slate-500">
                        Terpakai {Math.round(usage?.used || 0).toLocaleString('id-ID')} {item.unit} dari total tercatat {Math.round(usage?.baseline || item.stock).toLocaleString('id-ID')} {item.unit}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="kaffe-panel rounded-[20px] p-5 md:p-6">
            <h3 className="font-display text-[16px] font-extrabold text-slate-900 mb-5 flex items-center gap-2">
              <TrendingUp size={17} className="text-slate-500" />
              Operasional
            </h3>
            <div className="divide-y divide-[var(--brand-hairline)]">
              <div className="flex items-center justify-between gap-3 py-3 first:pt-0">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-600"><span className="h-2 w-2 rounded-full bg-blue-600" aria-hidden="true" />Revenue periode</p>
                <p className="text-[15px] font-extrabold text-slate-900 kaffe-num">{fRp(totalRangeRevenue)}</p>
              </div>
              <div className="flex items-center justify-between gap-3 py-3">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-600"><span className="h-2 w-2 rounded-full bg-rose-600" aria-hidden="true" />Pengeluaran operasional</p>
                <p className="text-[15px] font-extrabold text-slate-900 kaffe-num">{fRp(totalRangeExpenses)}</p>
              </div>
              <div className="flex items-center justify-between gap-3 py-3 last:pb-0">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-600"><span className="h-2 w-2 rounded-full bg-emerald-600" aria-hidden="true" />Nilai stok gudang</p>
                <p className="text-[15px] font-extrabold text-slate-900 kaffe-num">
                  {fRp(inventory.reduce((sum: number, item: InventoryItem) => sum + (item.stock || 0) * (item.cost_per_unit || 0), 0))}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="px-4 py-2 text-center text-[12px] font-medium text-slate-500">
          Terima kasih telah ikut Closed Beta. Feedback kamu membantu KaffePOS makin siap untuk cafe owner Indonesia.
        </div>
      </div>
    </div>
  );
}
