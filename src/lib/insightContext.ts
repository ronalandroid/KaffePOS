// src/lib/insightContext.ts — builds the InsightContext fed to the AI (Gemini) endpoint
// from raw store data over an arbitrary period. Standalone + pure so any surface (the
// dashboard AI Insights card, reports, etc.) can produce a real AI-ready context.
import type { Transaction, InventoryItem, Expense } from '@/types';
import type { InsightContext } from '@/lib/aiInsight';

const PAYMENT_METHODS = ['Tunai', 'Transfer', 'QRIS'] as const;

function buildSevenDayTrend(active: Transaction[], now: Date): { label: string; value: number }[] {
  const out: { label: string; value: number }[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    const key = day.toDateString();
    const value = active
      .filter((t) => new Date(t.date).toDateString() === key)
      .reduce((sum, t) => sum + (t.total || 0), 0);
    out.push({ label: day.toLocaleDateString('id-ID', { weekday: 'short' }), value });
  }
  return out;
}

export function buildInsightContext(params: {
  transactions: Transaction[];
  inventory: InventoryItem[];
  expenses?: Expense[];
  storeName: string;
  periodLabel?: string;
  now?: Date;
}): InsightContext {
  const { transactions, inventory, expenses = [], storeName, periodLabel = 'Semua Waktu' } = params;
  const now = params.now ?? new Date();
  const active = transactions.filter((t) => !t.is_void);

  const totalRevenue = active.reduce((sum, t) => sum + (t.total || 0), 0);
  const totalCogs = active.reduce((sum, t) => sum + (t.cogs || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netProfit = totalRevenue - totalCogs - totalExpenses;
  const grossMargin = totalRevenue > 0 ? Math.round(((totalRevenue - totalCogs) / totalRevenue) * 100) : 0;
  const txCount = active.length;
  const avgTrx = txCount > 0 ? Math.round(totalRevenue / txCount) : 0;

  const menuAgg = new Map<string, { qty: number; revenue: number }>();
  for (const t of active) {
    for (const item of t.items || []) {
      const entry = menuAgg.get(item.name) || { qty: 0, revenue: 0 };
      entry.qty += item.qty || 0;
      entry.revenue += item.subtotal || (item.price || 0) * (item.qty || 0);
      menuAgg.set(item.name, entry);
    }
  }
  const topMenus = [...menuAgg.entries()]
    .map(([name, v]) => ({ name, qty: v.qty, revenue: v.revenue }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const lowStockItems = inventory
    .filter((i) => i.stock <= i.min_stock)
    .slice(0, 5)
    .map((i) => ({ name: i.name, stock: i.stock, unit: i.unit, min: i.min_stock }));

  const paymentMix = PAYMENT_METHODS.map((method) => ({
    method,
    pct: txCount > 0 ? Math.round((active.filter((t) => t.method === method).length / txCount) * 100) : 0,
  }));

  return {
    period: periodLabel,
    storeName,
    totalRevenue,
    totalCogs,
    netProfit,
    grossMargin,
    txCount,
    avgTrx,
    topMenus,
    lowStockItems,
    totalExpenses,
    trendData: buildSevenDayTrend(active, now),
    paymentMix,
  };
}
