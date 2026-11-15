// src/components/report/StatCard.tsx
type StatCardProps = { label: string; value: string; sub?: string };

export function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="kaffe-metric-card kaffe-card-interactive flex min-w-0 flex-col p-4 sm:p-5">
      <p className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-slate-600 sm:truncate">{label}</p>
      <p className="mt-2 truncate font-display text-[20px] font-extrabold leading-tight text-slate-900 kaffe-num sm:mt-3 sm:text-[24px]">{value}</p>
      {sub && <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-snug text-slate-500">{sub}</p>}
    </div>
  );
}
