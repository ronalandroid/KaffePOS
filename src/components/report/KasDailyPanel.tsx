// src/components/report/KasDailyPanel.tsx
// Panel Kas Harian: Saldo Kasir Awal → Pengeluaran → Selisih
// Menampilkan detail akuntansi per hari dengan status sumber dana

import { useMemo, useState } from 'react';
import { Wallet, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

const fRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);

interface CashRegisterEntry { id: string; date: string; amount: number; note?: string|null; opened_by: string; }
interface ExpenseEntry      { id: string; date: string; amount: number; description: string; category: string; cashier?: string; }
interface TransactionEntry  { id: string; date: string; total: number; is_void?: boolean; }

interface Props {
  cashRegister:  CashRegisterEntry[];
  expenses:      ExpenseEntry[];
  transactions:  TransactionEntry[];
  period:        string;
}

function getExpenseSource(expense: { source?: string; category?: string }) {
  return expense.source || (expense.category === 'Bahan Baku' ? 'inventory' : 'cashier');
}

/** Kelompokkan transaksi+expense+kasir per hari */
function groupByDay(cashRegister: CashRegisterEntry[], expenses: ExpenseEntry[], transactions: TransactionEntry[], period: string) {
  const now = new Date();

  function inPeriod(dateStr: string) {
    const d = new Date(dateStr);
    if (period === 'harian')   return d.toDateString() === now.toDateString();
    if (period === 'mingguan') { const w = new Date(now); w.setDate(w.getDate() - 7); return d >= w; }
    if (period === 'bulanan')  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return true;
  }

  const dayMap = new Map<string, {
    dateStr: string;
    label:   string;
    opens:   CashRegisterEntry[];
    exps:    ExpenseEntry[];
    revenue: number;
  }>();

  // Kumpulkan semua tanggal relevan
  const allDates = new Set<string>();
  cashRegister.filter(c => inPeriod(c.date)).forEach(c => allDates.add(new Date(c.date).toDateString()));
  expenses
    .filter(e => inPeriod(e.date) && getExpenseSource(e) === 'cashier')
    .forEach(e => allDates.add(new Date(e.date).toDateString()));

  allDates.forEach(ds => {
    const d = new Date(ds);
    const label = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
    dayMap.set(ds, { dateStr: ds, label, opens: [], exps: [], revenue: 0 });
  });

  cashRegister.filter(c => inPeriod(c.date)).forEach(c => {
    const ds = new Date(c.date).toDateString();
    if (dayMap.has(ds)) dayMap.get(ds)!.opens.push(c);
  });

  expenses.filter(e => inPeriod(e.date) && getExpenseSource(e) === 'cashier').forEach(e => {
    const ds = new Date(e.date).toDateString();
    if (dayMap.has(ds)) dayMap.get(ds)!.exps.push(e);
  });

  transactions.filter(t => !t.is_void && inPeriod(t.date)).forEach(t => {
    const ds = new Date(t.date).toDateString();
    if (dayMap.has(ds)) dayMap.get(ds)!.revenue += t.total;
  });

  return Array.from(dayMap.values())
    .sort((a, b) => new Date(b.dateStr).getTime() - new Date(a.dateStr).getTime());
}

interface DayRowProps {
  day: ReturnType<typeof groupByDay>[0];
  defaultOpen?: boolean;
}

function DayRow({ day, defaultOpen = false }: DayRowProps) {
  const [open, setOpen] = useState(defaultOpen);

  const saldoAwal   = day.opens.reduce((s, c) => s + c.amount, 0);
  const totalExp    = day.exps.reduce((s, e) => s + e.amount, 0);
  const selisih     = saldoAwal - totalExp;       // sisa saldo kasir setelah pengeluaran
  const fromSales   = selisih < 0 ? Math.abs(selisih) : 0;  // porsi ambil dari pendapatan
  const netKas      = saldoAwal + day.revenue - totalExp;    // posisi kas akhir hari

  // Status
  const status = totalExp === 0
    ? 'aman'
    : selisih >= 0
    ? 'aman'
    : 'ambil-penjualan';

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--brand-panel-border)]">
      {/* Header baris hari */}
      <button type="button" aria-expanded={open} className="flex w-full items-center justify-between gap-3 bg-[var(--brand-canvas)] px-4 py-3 transition-colors hover:bg-[#F3EFEB]"
        onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 shrink-0 rounded-full ${status === 'aman' ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden="true" />
          <div className="text-left">
            <p className="text-[14px] font-bold text-slate-900">{day.label}</p>
            <p className="text-[12px] text-slate-500">
              {saldoAwal > 0 ? `Kasir: ${fRp(saldoAwal)}` : 'Tanpa saldo awal'} · {day.exps.length} pengeluaran
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className={`text-[14px] font-bold kaffe-num ${selisih >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
              {selisih >= 0 ? '+' : ''}{fRp(selisih)}
            </p>
            <p className="text-[11px] text-slate-500">selisih</p>
          </div>
          {open ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
        </div>
      </button>

      {/* Detail expand */}
      {open && (
        <div className="space-y-4 bg-white px-4 pb-4 pt-3">
          {/* Summary bar */}
          <div className="grid grid-cols-3 divide-x divide-[var(--brand-hairline)] rounded-xl border border-[var(--brand-panel-border)]">
            <div className="px-3 py-2.5">
              <p className="text-[11.5px] font-medium text-slate-500">Saldo awal</p>
              <p className="mt-0.5 text-[13.5px] font-bold text-slate-900 kaffe-num">{fRp(saldoAwal)}</p>
            </div>
            <div className="px-3 py-2.5">
              <p className="text-[11.5px] font-medium text-slate-500">Pengeluaran</p>
              <p className="mt-0.5 text-[13.5px] font-bold text-rose-700 kaffe-num">-{fRp(totalExp)}</p>
            </div>
            <div className="px-3 py-2.5">
              <p className="text-[11.5px] font-medium text-slate-500">
                {selisih >= 0 ? 'Sisa kasir' : 'Defisit'}
              </p>
              <p className={`mt-0.5 text-[13.5px] font-bold kaffe-num ${selisih >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {fRp(Math.abs(selisih))}
              </p>
            </div>
          </div>

          {/* Ambil dari penjualan notice */}
          {fromSales > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-700" />
              <div>
                <p className="text-[12px] font-bold text-amber-800">Diambil dari saldo penjualan</p>
                <p className="text-[12px] text-amber-800">
                  Saldo kasir tidak cukup — {fRp(fromSales)} diambil dari pendapatan hari ini ({fRp(day.revenue)})
                </p>
              </div>
            </div>
          )}

          {/* Kas awal detail */}
          {day.opens.length > 0 && (
            <div>
              <p className="mb-1 text-[12px] font-semibold text-slate-600">Saldo kasir awal</p>
              {day.opens.map((c, i) => (
                <div key={i} className="flex justify-between py-1">
                  <div>
                    <p className="text-[13px] text-slate-800">{c.opened_by}</p>
                    {c.note && <p className="text-[12px] text-slate-500">{c.note}</p>}
                  </div>
                  <p className="text-[13px] font-bold text-slate-900 kaffe-num">{fRp(c.amount)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Pengeluaran detail */}
          {day.exps.length > 0 && (
            <div>
              <p className="mb-1 text-[12px] font-semibold text-slate-600">Detail pengeluaran</p>
              <div className="space-y-1">
                {day.exps.map((e, i) => (
                  <div key={i} className="flex justify-between items-start py-1 border-b border-[var(--brand-hairline)] last:border-0">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="truncate text-[13px] font-semibold text-slate-800">{e.description}</p>
                      <p className="text-[12px] text-slate-500">
                        {e.category} · {new Date(e.date).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        {e.cashier ? ` · ${e.cashier}` : ''}
                        {e.amount > saldoAwal && saldoAwal > 0
                          ? <span className="ml-1 text-amber-700">· dari penjualan</span>
                          : ''}
                      </p>
                    </div>
                    <p className="shrink-0 text-[13px] font-bold text-rose-700 kaffe-num">-{fRp(e.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Posisi kas akhir hari */}
          <div className="flex items-center justify-between border-t border-[var(--brand-panel-border)] pt-3">
            <div>
              <p className="text-[13px] font-bold text-slate-900">Kas akhir hari</p>
              <p className="text-[12px] text-slate-500">Saldo + Penjualan - Pengeluaran</p>
            </div>
            <div className="text-right">
              <p className={`text-[15px] font-extrabold kaffe-num ${netKas >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {fRp(netKas)}
              </p>
              <p className="text-[11.5px] text-slate-500 kaffe-num">{`${fRp(saldoAwal)} + ${fRp(day.revenue)} - ${fRp(totalExp)}`}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function KasDailyPanel({ cashRegister, expenses, transactions, period }: Props) {
  const days = useMemo(
    () => groupByDay(cashRegister, expenses, transactions, period),
    [cashRegister, expenses, transactions, period]
  );

  const totalSaldoAwal = days.reduce((s, d) => s + d.opens.reduce((a, c) => a + c.amount, 0), 0);
  const totalExp       = days.reduce((s, d) => s + d.exps.reduce((a, e) => a + e.amount, 0), 0);
  const totalSelisih   = totalSaldoAwal - totalExp;
  const totalFromSales = totalSelisih < 0 ? Math.abs(totalSelisih) : 0;

  if (days.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--brand-panel-border)] p-6 text-center">
        <Wallet size={24} className="mx-auto mb-2 text-stone-300" />
        <p className="text-[13px] text-slate-500">Belum ada data kas untuk periode ini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--brand-panel-border)] bg-[var(--brand-hairline)] md:grid-cols-4">
        {[
          { label: 'Total saldo awal', value: fRp(totalSaldoAwal), tone: 'text-slate-900' },
          { label: 'Total pengeluaran', value: `-${fRp(totalExp)}`, tone: 'text-rose-700' },
          { label: totalSelisih >= 0 ? 'Sisa saldo kasir' : 'Total defisit', value: fRp(Math.abs(totalSelisih)), tone: totalSelisih >= 0 ? 'text-emerald-700' : 'text-amber-700' },
          { label: 'Dari penjualan', value: fRp(totalFromSales), tone: 'text-slate-900' },
        ].map((item) => (
          <div key={item.label} className="bg-white px-4 py-3">
            <p className="text-[12px] font-medium text-slate-500">{item.label}</p>
            <p className={`mt-0.5 text-[16px] font-extrabold kaffe-num ${item.tone}`}>{item.value}</p>
          </div>
        ))}
      </div>
      {totalFromSales > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <AlertTriangle size={14} className="shrink-0 text-amber-700" />
          <p className="text-[12.5px] text-amber-800">
            {fRp(totalFromSales)} pengeluaran diambil dari saldo penjualan karena saldo kasir tidak mencukupi.
          </p>
        </div>
      )}

      {/* Detail per hari */}
      <div className="space-y-2">
        {days.map((day, i) => (
          <DayRow key={day.dateStr} day={day} defaultOpen={i === 0} />
        ))}
      </div>
    </div>
  );
}
