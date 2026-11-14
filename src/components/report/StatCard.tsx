// src/components/report/StatCard.tsx
import type { ReactNode } from 'react';

const STAT_ICON_COLORS: Record<string, string> = {
  orange: 'bg-orange-50 text-[var(--brand-orange-text)]',
  green: 'bg-emerald-50 text-emerald-700',
  blue: 'bg-blue-50 text-blue-700',
  red: 'bg-rose-50 text-rose-700',
};

type StatCardProps = { label: string; value: string; sub?: string; icon: ReactNode; color?: string };

export function StatCard({ label, value, sub, icon, color='orange' }: StatCardProps) {
  return (
    <div className="kaffe-metric-card kaffe-card-interactive flex min-w-0 flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-slate-600 sm:truncate">{label}</p>
        <span className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:flex ${STAT_ICON_COLORS[color] || STAT_ICON_COLORS.orange}`} aria-hidden="true">{icon}</span>
      </div>
      <p className="mt-2 truncate font-display text-[20px] font-extrabold leading-tight text-slate-900 kaffe-num sm:mt-3 sm:text-[24px]">{value}</p>
      {sub && <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-snug text-slate-500">{sub}</p>}
    </div>
  );
}
