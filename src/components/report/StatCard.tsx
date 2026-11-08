// src/components/report/StatCard.tsx
import type { ReactNode } from 'react';

const STAT_CARD_CLASSES: Record<string, string> = {
  orange: 'bg-orange-50 text-[#FF6A00] border-orange-100',
  green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  blue: 'bg-blue-50 text-blue-600 border-blue-100',
  red: 'bg-rose-50 text-rose-600 border-rose-100',
};

type StatCardProps = { label: string; value: string; sub?: string; icon: ReactNode; color?: string };

export function StatCard({ label, value, sub, icon, color='orange' }: StatCardProps) {
  return (
    <div className="kaffe-action-card min-w-0 bg-white rounded-[28px] border border-slate-100 p-5 shadow-soft hover:shadow-premium transition-all group">
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-4 border transition-transform group-hover:scale-110 ${STAT_CARD_CLASSES[color] || STAT_CARD_CLASSES.orange}`}>{icon}</div>
      <p className="font-black text-[18px] text-slate-800 leading-tight tracking-tight tabular-nums">{value}</p>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{label}</p>
      {sub&&<p className="text-[10px] text-slate-500 font-bold mt-1.5 opacity-80">{sub}</p>}
    </div>
  );
}
