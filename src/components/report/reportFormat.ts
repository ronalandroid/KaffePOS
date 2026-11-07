// src/components/report/reportFormat.ts
// Shared formatters, palette, and period/chart types for the report surface.

export type Period = 'harian' | 'mingguan' | 'bulanan' | 'custom' | 'semua';
export type ChartKey = 'trend' | 'menu' | 'payment' | 'stock';

export const fRp = (n: number) => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(n||0);
export const fNum = (n: number) => new Intl.NumberFormat('id-ID').format(n||0);

export const COLORS = ['#FF6A00','#3b82f6','#10b981','#8b5cf6','#ef4444','#ec4899','#f59e0b','#06b6d4'];

export const getExpenseSource = (expense: { source?: string; category?: string }) =>
  expense.source || (expense.category === 'Bahan Baku' ? 'inventory' : 'cashier');
